import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  details?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialogState = signal<ConfirmDialogState | null>(null);
  private resolver: ((value: boolean) => void) | null = null;

  readonly dialog = this.dialogState.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.resolve(false);

    this.dialogState.set({
      title: options.title,
      message: options.message,
      details: options.details,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? 'default',
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  approve(): void {
    this.resolve(true);
  }

  cancel(): void {
    this.resolve(false);
  }

  private resolve(value: boolean): void {
    const resolve = this.resolver;

    this.resolver = null;
    this.dialogState.set(null);
    resolve?.(value);
  }
}
