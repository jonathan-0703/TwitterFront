import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { SuspensionDto } from '../admin.models';

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
    reason: ['Policy review required', Validators.required],
    until: [''],
  });
  readonly liftForm = this.formBuilder.group({ userId: ['', Validators.required], reason: ['Moderation review completed'] });
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
      title: 'Suspend this user?',
      message: 'Suspension is a high-sensitivity moderation action and should only happen with a clear reason recorded.',
      details: payload.reason,
      confirmLabel: 'Suspend user',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(
      'Suspending user',
      async () => {
        await firstValueFrom(this.adminApi.suspendUser(payload));
        this.feedback.success('The user suspension was recorded.', { title: 'User suspended' });
        this.lookupForm.patchValue({ userId: payload.userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(payload.userId)));
      },
      'Suspending the user failed.',
    );
  }

  protected async lift(): Promise<void> {
    if (this.liftForm.invalid) {
      this.liftForm.markAllAsTouched();
      return;
    }

    const payload = this.liftForm.getRawValue();
    const confirmed = await this.confirm.confirm({
      title: 'Lift this suspension?',
      message: 'Use this only after the moderation review is complete and the account can safely return to normal state.',
      details: payload.reason || 'No lift reason provided.',
      confirmLabel: 'Lift suspension',
    });

    if (!confirmed) {
      return;
    }

    await this.run(
      'Lifting suspension',
      async () => {
        await firstValueFrom(this.adminApi.liftSuspension(payload));
        this.feedback.success('The suspension was lifted.', { title: 'Suspension lifted' });
        this.lookupForm.patchValue({ userId: payload.userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(payload.userId)));
      },
      'Lifting the suspension failed.',
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
      'Loading history',
      async () => {
        this.lookupForm.patchValue({ userId });
        this.loadingHistory.set(true);
        this.history.set(await firstValueFrom(this.adminApi.getSuspensionHistory(userId)));
      },
      'Suspension history lookup failed.',
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
      this.feedback.error(message, { title: 'Suspension action failed' });
    } finally {
      this.loadingHistory.set(false);
      this.acting.set(null);
    }
  }
}
