import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';

import { SuspensionDto } from '../models/admin.models';
import { AdminApiService } from '../services/admin-api.service';

@Component({
  selector: 'app-admin-suspensions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-suspensions.page.html',
  styleUrl: './admin-suspensions.page.scss',
})
export class AdminSuspensionsPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly suspendForm = this.formBuilder.group({
    userId: ['', Validators.required],
    reason: ['Revisión de política requerida', Validators.required],
    until: [''],
  });
  readonly liftForm = this.formBuilder.group({ userId: ['', Validators.required], reason: ['Revisión de moderación completada'] });
  readonly lookupForm = this.formBuilder.group({ userId: ['', Validators.required] });
  readonly history = signal<SuspensionDto[]>([]);
  readonly error = signal<string | null>(null);
  readonly loadingHistory = signal(false);
  readonly acting = signal<string | null>(null);
  readonly activeHistoryCount = computed(() => this.history().filter((entry) => !entry.liftedAt).length);

  protected async suspend(): Promise<void> {
    if (this.suspendForm.invalid) {
      this.suspendForm.markAllAsTouched();
      return;
    }

    const payload = this.suspendForm.getRawValue();
    const confirmed = await this.confirm.confirm({
      title: '¿Suspender este usuario?',
      message: 'La suspensión es una acción de moderación de alta sensibilidad y solo debe hacerse con un motivo claro registrado.',
      details: payload.reason,
      confirmLabel: 'Suspender usuario',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(
      'Suspendiendo usuario',
      async () => {
        await firstValueFrom(this.adminApi.suspendUser(payload));
        this.feedback.success('La suspensión del usuario quedó registrada.', { title: 'Usuario suspendido' });
        this.lookupForm.patchValue({ userId: payload.userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(payload.userId)));
      },
      'Falló la suspensión del usuario.',
    );
  }

  protected async lift(): Promise<void> {
    if (this.liftForm.invalid) {
      this.liftForm.markAllAsTouched();
      return;
    }

    const payload = this.liftForm.getRawValue();
    const confirmed = await this.confirm.confirm({
      title: '¿Levantar esta suspensión?',
      message: 'Úsalo solo después de que la revisión de moderación esté completa y la cuenta pueda volver al estado normal con seguridad.',
      details: payload.reason || 'No se proporcionó motivo del levantamiento.',
      confirmLabel: 'Levantar suspensión',
    });

    if (!confirmed) {
      return;
    }

    await this.run(
      'Levantando suspensión',
      async () => {
        await firstValueFrom(this.adminApi.liftSuspension(payload));
        this.feedback.success('La suspensión fue levantada.', { title: 'Suspensión levantada' });
        this.lookupForm.patchValue({ userId: payload.userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(payload.userId)));
      },
      'Falló el levantamiento de la suspensión.',
    );
  }

  protected async lookup(): Promise<void> {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const { userId } = this.lookupForm.getRawValue();
    await this.loadHistoryFor(userId);
  }

  protected trackHistory(index: number, item: SuspensionDto): string {
    return item.suspensionId ?? item.createdAt ?? String(index);
  }

  private async loadHistoryFor(userId: string): Promise<void> {
    await this.run(
      'Cargando historial',
      async () => {
        this.lookupForm.patchValue({ userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(userId)));
      },
      'Falló la búsqueda del historial de suspensiones.',
    );
  }

  private async run(action: string, task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      this.acting.set(action);
      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Error en la acción de suspensión' });
    } finally {
      this.loadingHistory.set(false);
      this.acting.set(null);
    }
  }
}
