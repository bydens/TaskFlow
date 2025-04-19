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
import { TaskService, TaskListId } from './services/task.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
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
  private taskService: TaskService = inject(TaskService);
  private dialog: MatDialog = inject(MatDialog);

  tasks: Record<TaskListId, Signal<Task[]>> = {
    todo: toSignal(this.taskService.getTasks('todo'), { initialValue: [] }),
    inProgress: toSignal(this.taskService.getTasks('inProgress'), { initialValue: [] }),
    done: toSignal(this.taskService.getTasks('done'), { initialValue: [] })
  };

  private dialogSubscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    this.dialogSubscriptions.forEach(sub => sub.unsubscribe());
  }

  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, {
      width: '270px',
      data: { task: {}, enableDelete: false },
    });

    const sub = dialogRef.afterClosed().subscribe(async (result: TaskDialogResult | undefined) => {
      if (!result?.task?.title) return;
      try {
        await this.taskService.createTask(result.task);
      } catch (error) {
        // Обработка ошибки...
      }
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

      try {
        if (result.delete) {
          await this.taskService.deleteTask(list, task.id);
        } else if (result.task) {
          const { id, ...updates } = result.task;
          await this.taskService.updateTask(list, task.id, updates);
        }
      } catch (error) {
        // Обработка ошибки...
      }
    });
    this.dialogSubscriptions.push(sub);
  }

  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }

    const previousListId = event.previousContainer.id as TaskListId;
    const currentListId = event.container.id as TaskListId;
    const task = event.item.data as Task;

    if (!task?.id) {
      console.error('Task or Task ID is missing');
      return;
    }

    try {
      await this.taskService.moveTask(task, previousListId, currentListId);
    } catch (error) {
      // Обработка ошибки...
    }
  }
}
