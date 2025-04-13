import { Component, inject } from '@angular/core';
import { AsyncPipe, NgForOf, NgIf } from "@angular/common";

import { CdkDragDrop, DragDropModule, transferArrayItem } from "@angular/cdk/drag-drop";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatCard } from "@angular/material/card";
import { MatDialogModule } from '@angular/material/dialog';

import { Task } from './task/task';
import { TaskComponent } from "./task/task.component";
import { TaskDialogComponent, TaskDialogResult } from './task-dialog/task-dialog.component';
import { addDoc, collection, collectionData, CollectionReference, deleteDoc, doc, Firestore, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    DragDropModule,
    MatCard,
    TaskComponent,
    NgIf,
    NgForOf, AsyncPipe
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  todo$: Observable<Task[]>;
  inProgress$: Observable<Task[]>;
  done$: Observable<Task[]>;

  // Коллекции Firestore
  todoCollection: CollectionReference;
  inProgressCollection: CollectionReference;
  doneCollection: CollectionReference;

  constructor() {
    // Получаем ссылки на коллекции
    this.todoCollection = collection(this.firestore, 'todo');
    this.inProgressCollection = collection(this.firestore, 'inProgress');
    this.doneCollection = collection(this.firestore, 'done');

    // Получаем данные как Observable и добавляем поле 'id'
    this.todo$ = collectionData(this.todoCollection, { idField: 'id' }) as Observable<Task[]>;
    this.inProgress$ = collectionData(this.inProgressCollection, { idField: 'id' }) as Observable<Task[]>;
    this.done$ = collectionData(this.doneCollection, { idField: 'id' }) as Observable<Task[]>;
  }

  // todo: Task[] = [
  //   {
  //     title: 'Buy milk',
  //     description: 'Go to the store and buy milk',
  //   },
  //   {
  //     title: 'Create a Kanban app',
  //     description: 'Using Firebase and Angular create a Kanban app!',
  //   },
  // ];
  // inProgress: Task[] = [];
  // done: Task[] = [];

  editTask(list: 'done' | 'todo' | 'inProgress', task: Task & { id?: string }): void { // Добавляем id к типу Task
    if (!task.id) {
      console.error("Task ID is missing, cannot edit.");
      return; // Не можем редактировать без ID
    }

    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task: { ...task }, // Передаем копию задачи
        enableDelete: true,
      },
    });

    dialogRef.afterClosed().subscribe(async (result: TaskDialogResult | undefined) => { // делаем async
      if (!result || !task.id) { // Убедимся еще раз, что ID есть
        return;
      }

      // Получаем ссылку на конкретный документ в нужной коллекции
      const docRef = doc(this.firestore, `${list}/${task.id}`);

      try {
        if (result.delete) {
          // Удаляем документ
          await deleteDoc(docRef);
        } else if (result.task) {
          // Обновляем документ
          await updateDoc(docRef, { ...result.task }); // Обновляем данными из диалога
        }
      } catch (error) {
        console.error("Error updating/deleting task: ", error);
        // Обработка ошибок
      }
    });
  }

  async drop(event: CdkDragDrop<Task[] | null>): Promise<void> {
    if (event.previousContainer === event.container) return;
    if (!event.container.data || !event.previousContainer.data) return;

    // Получаем задачу, которую перетащили (она содержит 'id')
    const task = event.item.data as Task & { id: string };

    // Получаем ID контейнеров (которые мы задали в HTML: 'todo', 'inProgress', 'done')
    const previousListId = event.previousContainer.id as 'todo' | 'inProgress' | 'done';
    const currentListId = event.container.id as 'todo' | 'inProgress' | 'done';

    if (!task.id) {
      console.error("Task ID missing on drop");
      return;
    }

    // Ссылка на документ в исходном списке
    const sourceDocRef = doc(this.firestore, `${previousListId}/${task.id}`);

    // Данные задачи для добавления в новый список (без id)
    const taskData = {
      title: task.title,
      description: task.description
    };

    // Ссылка на целевую коллекцию
    let targetCollection: CollectionReference;
    if (currentListId === 'todo') targetCollection = this.todoCollection;
    else if (currentListId === 'inProgress') targetCollection = this.inProgressCollection;
    else if (currentListId === 'done') targetCollection = this.doneCollection;
    else {
      console.error("Invalid target container ID:", currentListId);
      return;
    }

    try {
      // 1. Добавляем задачу в новую коллекцию
      await addDoc(targetCollection, taskData);
      // 2. Удаляем задачу из старой коллекции *после* успешного добавления
      await deleteDoc(sourceDocRef);
    } catch (error) {
      console.error("Error moving task between lists: ", error);
      // В случае ошибки, данные могут быть рассинхронизированы.
      // В реальном приложении здесь лучше использовать транзакции Firestore
      // для атомарности операции (либо обе успешны, либо ни одна).
    }
  }


  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: {
        task: {},
      },
    });
    dialogRef
      .afterClosed()
      .subscribe(async (result: TaskDialogResult | undefined) => { // делаем async
        if (!result || !result.task || !result.task.title) { // Проверяем наличие задачи и заголовка
          return;
        }
        try {
          // Добавляем документ в коллекцию 'todo'
          await addDoc(this.todoCollection, result.task);
        } catch (error) {
          console.error("Error adding task: ", error);
          // Здесь можно добавить обработку ошибок, например, показать сообщение пользователю
        }
      });
  }

}
