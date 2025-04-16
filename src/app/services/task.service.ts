import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  runTransaction,
  CollectionReference,
  DocumentReference
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Task } from '../task/task';

// Константы для коллекций
const COLLECTIONS = {
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  DONE: 'done'
} as const;

export type TaskListId = keyof typeof COLLECTIONS;

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly firestore: Firestore = inject(Firestore);

  private readonly collectionRefs: Record<TaskListId, CollectionReference<Task>> = {
    TODO: collection(this.firestore, COLLECTIONS.TODO) as CollectionReference<Task>,
    IN_PROGRESS: collection(this.firestore, COLLECTIONS.IN_PROGRESS) as CollectionReference<Task>,
    DONE: collection(this.firestore, COLLECTIONS.DONE) as CollectionReference<Task>
  };

  /**
   * Получает список задач из указанной коллекции
   */
  getTasks(listId: TaskListId): Observable<Task[]> {
    return collectionData(
      this.collectionRefs[listId],
      { idField: 'id' }
    ) as Observable<Task[]>;
  }

  /**
   * Создает новую задачу в списке TODO
   */
  async createTask(task: Omit<Task, 'id'>): Promise<void> {
    try {
      await addDoc(this.collectionRefs.TODO, task);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Обновляет существующую задачу
   */
  async updateTask(listId: TaskListId, taskId: string, updates: Partial<Omit<Task, 'id'>>): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${listId}/${taskId}`);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error(`Error updating task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Удаляет задачу
   */
  async deleteTask(listId: TaskListId, taskId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${listId}/${taskId}`);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Перемещает задачу между списками
   */
  async moveTask(
    task: Task,
    sourceListId: TaskListId,
    targetListId: TaskListId
  ): Promise<void> {
    if (!task.id) {
      throw new Error('Task ID is required for moving');
    }

    const sourceDocRef = doc(
      this.firestore,
      `${sourceListId}/${task.id}`
    ) as DocumentReference<Task>;

    const targetCollectionRef = this.collectionRefs[targetListId];
    const { id, ...taskData } = task;

    try {
      await runTransaction(this.firestore, async (transaction) => {
        transaction.delete(sourceDocRef);
        const newDocRef = doc(targetCollectionRef);
        transaction.set(newDocRef, taskData);
      });
    } catch (error) {
      console.error('Error moving task between lists:', error);
      throw error;
    }
  }
} 