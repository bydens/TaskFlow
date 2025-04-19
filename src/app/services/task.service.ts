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
  todo: 'todo',
  inProgress: 'inProgress',
  done: 'done'
} as const;

export type TaskListId = keyof typeof COLLECTIONS;

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly firestore: Firestore = inject(Firestore);

  private readonly collectionRefs: Record<TaskListId, CollectionReference<Task>> = {
    todo: collection(this.firestore, COLLECTIONS.todo) as CollectionReference<Task>,
    inProgress: collection(this.firestore, COLLECTIONS.inProgress) as CollectionReference<Task>,
    done: collection(this.firestore, COLLECTIONS.done) as CollectionReference<Task>
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
   * Создает новую задачу в списке todo
   */
  async createTask(task: Omit<Task, 'id'>): Promise<void> {
    await addDoc(this.collectionRefs.todo, task);
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