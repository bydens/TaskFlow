import { Component, inject, OnDestroy, signal, Signal } from '@angular/core'; // Импортируем signal и Signal
import { NgForOf, NgIf } from "@angular/common"; // Убираем AsyncPipe
import { CdkDragDrop, DragDropModule } from "@angular/cdk/drag-drop";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from "@angular/material/card"; // Используем MatCardModule
import { MatDialogModule } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop'; // Импортируем toSignal

import { Task } from './task/task'; // Убедитесь, что интерфейс Task определен и включает id?
import { TaskComponent } from "./task/task.component";
import { TaskDialogComponent, TaskDialogResult } from './task-dialog/task-dialog.component';
import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference, // Добавляем DocumentReference
  Firestore,
  query,
  runTransaction, // Импортируем runTransaction для транзакций
  UpdateData,
  updateDoc
} from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

// Определяем тип для идентификаторов списков
type TaskListId = 'todo' | 'inProgress' | 'done';

// Константы для имен коллекций
const TODO_COLLECTION = 'todo';
const IN_PROGRESS_COLLECTION = 'inProgress';
const DONE_COLLECTION = 'done';

@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    DragDropModule,
    MatCardModule, // Импортируем MatCardModule
    TaskComponent,
    NgIf,
    NgForOf,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'] // Используем styleUrls
})
export class AppComponent implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private dialog: MatDialog = inject(MatDialog);

  // Используем Record для хранения ссылок на коллекции
  private collectionRefs: Record<TaskListId, CollectionReference<Task>> = {
    todo: collection(this.firestore, TODO_COLLECTION) as CollectionReference<Task>,
    inProgress: collection(this.firestore, IN_PROGRESS_COLLECTION) as CollectionReference<Task>,
    done: collection(this.firestore, DONE_COLLECTION) as CollectionReference<Task>
  };

  // --- Используем Signals для хранения задач ---
  tasks: Record<TaskListId, Signal<Task[]>> = {
    todo: toSignal(this.getTasks(TODO_COLLECTION), { initialValue: [] }),
    inProgress: toSignal(this.getTasks(IN_PROGRESS_COLLECTION), { initialValue: [] }),
    done: toSignal(this.getTasks(DONE_COLLECTION), { initialValue: [] })
  };
  // ---------------------------------------------

  private dialogSubscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    this.dialogSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private getTasks(collectionName: TaskListId): Observable<Task[]> {
    const collRef = this.collectionRefs[collectionName];
    // const q = query(collRef, orderBy('createdAt', 'asc')); // Пример с сортировкой
    const q = query(collRef); // Без сортировки
    return collectionData(q, { idField: 'id' }) as Observable<Task[]>;
  }

  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task: {},
        enableDelete: false
      },
    });

    const sub = dialogRef
      .afterClosed()
      .subscribe(async (result: TaskDialogResult | undefined) => {
        if (!result?.task?.title) {
          return;
        }
        try {
          const newTaskData = result.task;
          await addDoc(this.collectionRefs.todo, newTaskData);
          // Signal обновится автоматически
        } catch (error) {
          console.error('Error adding new task:', error);
        }
      });
    this.dialogSubscriptions.push(sub);
  }

  editTask(list: TaskListId, task: Task): void {
    if (!task.id) {
      return;
    }

    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task: { ...task },
        enableDelete: true,
      },
    });

    const sub = dialogRef
      .afterClosed()
      .subscribe(async (result: TaskDialogResult | undefined) => {
        if (!result || !task.id) {
          return;
        }

        const docRef = doc(this.firestore, `${list}/${task.id}`);

        try {
          if (result.delete) {
            await deleteDoc(docRef);
          } else if (result.task) {
            const { id, ...taskDataToUpdate } = result.task;
            await updateDoc(docRef, taskDataToUpdate as UpdateData<Task>);
          }
        } catch (error) {
          console.error(`Error updating/deleting task ${task.id} in ${list}:`, error);
        }
      });
    this.dialogSubscriptions.push(sub);
  }


  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }

    const task = event.item.data as Task;
    if (!task?.id) {
      return;
    }

    const previousListId = event.previousContainer.id as TaskListId;
    const currentListId = event.container.id as TaskListId;

    // Получаем ссылки на документ-источник и коллекцию-цель
    const sourceDocRef: DocumentReference<Task> = doc(this.firestore, `${previousListId}/${task.id}`) as DocumentReference<Task>;
    const targetCollectionRef = this.collectionRefs[currentListId];

    if (!targetCollectionRef) {
      return;
    }

    // Данные задачи для добавления (без id)
    const { id, ...taskData } = task;

    try {
      // --- Выполняем операцию внутри транзакции ---
      await runTransaction(this.firestore, async (transaction) => {
        transaction.delete(sourceDocRef);

        const newDocRef = doc(targetCollectionRef); // Генерируем ссылку для нового документа
        transaction.set(newDocRef, taskData); // Добавляем данные
      });

    } catch (error) {
      console.error('Error moving task between lists using transaction:', error);
    }
  }
}
