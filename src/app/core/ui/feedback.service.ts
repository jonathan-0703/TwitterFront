import { Injectable, signal } from '@angular/core';

export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackItem {
  id: number;
  tone: FeedbackTone;
  message: string;
  title?: string;
}

interface FeedbackOptions {
  duration?: number;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly itemsState = signal<FeedbackItem[]>([]);
  private nextId = 1;

  readonly items = this.itemsState.asReadonly();

  success(message: string, options?: FeedbackOptions): void {
    this.show('success', message, options);
  }

  error(message: string, options?: FeedbackOptions): void {
    this.show('error', message, { duration: 5200, ...options });
  }

  info(message: string, options?: FeedbackOptions): void {
    this.show('info', message, options);
  }

  dismiss(id: number): void {
    this.itemsState.update((items) => items.filter((item) => item.id !== id));
  }

  private show(tone: FeedbackTone, message: string, options?: FeedbackOptions): void {
    const item: FeedbackItem = {
      id: this.nextId++,
      tone,
      message,
      title: options?.title,
    };

    this.itemsState.update((items) => [...items, item]);

    const duration = options?.duration ?? 3600;

    globalThis.setTimeout(() => this.dismiss(item.id), duration);
  }
}
