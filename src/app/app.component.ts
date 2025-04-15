import { Component, inject, OnDestroy, signal, Signal } from '@angular/core';
import { NgForOf, NgIf } from "@angular/common";
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from "@angular/cdk/drag-drop";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from "@angular/material/card";
import { MatDialogModule } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';

import { Task } from './task/task';
import { TaskComponent } from "./task/task.component";
import { TaskDialogComponent, TaskDialogResult } from './task-dialog/task-dialog.component';
import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  Firestore,
  query,
  runTransaction,
  UpdateData,
  updateDoc
} from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

type TaskListId = 'todo' | 'inProgress' | 'done';

const TODO_COLLECTION = 'todo';
const IN_PROGRESS_COLLECTION = 'inProgress';
const DONE_COLLECTION = 'done';

@Component({
  selector: 'app-root',
  standalone: true, // Добавляем standalone: true
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    DragDropModule,
    MatCardModule,
    TaskComponent,
    NgIf,
    NgForOf,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private dialog: MatDialog = inject(MatDialog);

  private collectionRefs: Record<TaskListId, CollectionReference<Task>> = {
    todo: collection(this.firestore, TODO_COLLECTION) as CollectionReference<Task>,
    inProgress: collection(this.firestore, IN_PROGRESS_COLLECTION) as CollectionReference<Task>,
    done: collection(this.firestore, DONE_COLLECTION) as CollectionReference<Task>
  };

  tasks: Record<TaskListId, Signal<Task[]>> = {
    todo: toSignal(this.getTasks(TODO_COLLECTION), { initialValue: [] }),
    inProgress: toSignal(this.getTasks(IN_PROGRESS_COLLECTION), { initialValue: [] }),
    done: toSignal(this.getTasks(DONE_COLLECTION), { initialValue: [] })
  };

  private dialogSubscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    this.dialogSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private getTasks(collectionName: TaskListId): Observable<Task[]> {
    const collRef = this.collectionRefs[collectionName];
    const q = query(collRef);
    return collectionData(q, { idField: 'id' }) as Observable<Task[]>;
  }

  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: { task: {}, enableDelete: false },
    });

    const sub = dialogRef.afterClosed().subscribe(async (result: TaskDialogResult | undefined) => {
      if (!result?.task?.title) return;
      try {
        await addDoc(this.collectionRefs.todo, result.task);
      } catch (error) { console.error('Error adding new task:', error); }
    });
    this.dialogSubscriptions.push(sub);
  }

  editTask(list: TaskListId, task: Task): void {
    if (!task.id) return;
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: { task: { ...task }, enableDelete: true },
    });

    const sub = dialogRef.afterClosed().subscribe(async (result: TaskDialogResult | undefined) => {
      if (!result || !task.id) return;
      const docRef = doc(this.firestore, `${list}/${task.id}`);
      try {
        if (result.delete) {
          await deleteDoc(docRef);
        } else if (result.task) {
          const { id, ...taskDataToUpdate } = result.task;
          await updateDoc(docRef, taskDataToUpdate as UpdateData<Task>);
        }
      } catch (error) { console.error(`Error updating/deleting task ${task.id} in ${list}:`, error); }
    });
    this.dialogSubscriptions.push(sub);
  }

  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }

    // --- Оптимистичное обновление UI для переноса между списками ---
    const previousListId = event.previousContainer.id as TaskListId;
    const currentListId = event.container.id as TaskListId;

    // Получаем *текущие* данные из сигналов для локальной модификации
    const previousData = this.tasks[previousListId](); // Доступ по ключу и вызов сигнала
    const currentData = this.tasks[currentListId]();

    // Используем утилиту CDK для *немедленного* перемещения элемента
    // между локальными массивами. CDK увидит это и не вернет элемент.
    transferArrayItem(
      previousData, // Массив-источник (из сигнала)
      currentData,  // Массив-цель (из сигнала)
      event.previousIndex,
      event.currentIndex
    );
    // --------------------------------------------------------------

    // Получаем данные задачи (теперь они точно должны быть)
    const task = event.item.data as Task;
    if (!task?.id) {
      console.error('Task or Task ID is missing after optimistic update. This should not happen.');
      // В теории, можно было бы отменить оптимистичное обновление, но ошибка транзакции ниже это сделает автоматически
      return;
    }

    // Готовим данные для транзакции Firestore
    const sourceDocRef: DocumentReference<Task> = doc(this.firestore, `${previousListId}/${task.id}`) as DocumentReference<Task>;
    const targetCollectionRef = this.collectionRefs[currentListId];

    if (!targetCollectionRef) {
      console.error('Invalid target container ID:', currentListId);
      return; // Не удалось найти целевую коллекцию
    }

    const { id, ...taskData } = task; // Данные для записи (без id)

    // Запускаем транзакцию для атомарного обновления Firestore
    try {
      await runTransaction(this.firestore, async (transaction) => {
        // Проверяем, существует ли документ перед удалением (опционально, но безопаснее)
        // const taskDoc = await transaction.get(sourceDocRef);
        // if (!taskDoc.exists()) {
        //   throw new Error(`Source document ${previousListId}/${task.id} does not exist!`);
        // }

        // Удаляем из старой коллекции
        transaction.delete(sourceDocRef);
        // Добавляем в новую коллекцию
        const newDocRef = doc(targetCollectionRef); // Firestore генерирует новый ID
        transaction.set(newDocRef, taskData);
      });
      console.log(`Task moved atomically from ${previousListId} to ${currentListId}`);
      // Сигналы обновятся автоматически, когда collectionData получит подтверждение от Firestore.
      // Визуально все уже на месте благодаря transferArrayItem.

    } catch (error) {
      console.error('Error moving task between lists using transaction:', error);
      // Если транзакция не удалась, Firestore остался в прежнем состоянии.
      // Следующее обновление от collectionData вернет данные сигналов
      // к состоянию *до* неудачной транзакции, автоматически отменяя
      // наше оптимистичное обновление UI.
      // TODO: Показать пользователю сообщение об ошибке.
    }
  }
}
