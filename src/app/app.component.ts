import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { Task } from './task/task';
import { TaskComponent } from "./task/task.component";
import { MatCard } from "@angular/material/card";
import { CdkDragDrop, DragDropModule, transferArrayItem } from "@angular/cdk/drag-drop";
import { NgForOf, NgIf } from "@angular/common";

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, MatIconModule, DragDropModule, MatCard, TaskComponent, NgIf, NgForOf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  todo: Task[] = [
    {
      title: 'Buy milk',
      description: 'Go to the store and buy milk',
    },
    {
      title: 'Create a Kanban app',
      description: 'Using Firebase and Angular create a Kanban app!',
    },
  ];
  inProgress: Task[] = [];
  done: Task[] = [];

  editTask(list: string, task: Task): void { }

  drop(event: CdkDragDrop<Task[] | any>): void {
    if (event.previousContainer === event.container) {
      return;
    }
    if (!event.container.data || !event.previousContainer.data) {
      return;
    }
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
  }

}
