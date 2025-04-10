import { Component, Inject, OnInit } from '@angular/core';

import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { Task } from '../task/task';
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-task-dialog',
  imports: [MatInputModule, FormsModule, MatButtonModule, MatDialogModule, NgIf, MatIconModule],
  templateUrl: './task-dialog.component.html',
  styleUrl: './task-dialog.component.scss'
})
export class TaskDialogComponent implements OnInit {
  private backupTask: Partial<Task> = {};

  constructor(
    public dialogRef: MatDialogRef<TaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData
  ) { }

  ngOnInit(): void {
    this.backupTask = { ...this.data.task };
  }

  cancel(): void {
    this.data.task.title = this.backupTask.title;
    this.data.task.description = this.backupTask.description;
    this.dialogRef.close(this.data);
  }
}

export interface TaskDialogData {
  task: Partial<Task>;
  enableDelete: boolean;
}

export interface TaskDialogResult {
  task: Task;
  delete?: boolean;
}
