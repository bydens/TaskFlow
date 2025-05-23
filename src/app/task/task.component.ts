import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from './task';
import { MatCardModule } from '@angular/material/card';


@Component({
  selector: 'app-task',
  imports: [MatCardModule],
  templateUrl: './task.component.html',
  styleUrl: './task.component.scss'
})
export class TaskComponent {
  @Input() task: Task | any;
  @Output() edit: EventEmitter<Task> = new EventEmitter<Task>();
}
