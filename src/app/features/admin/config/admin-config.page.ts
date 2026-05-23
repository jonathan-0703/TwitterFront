import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminConfigEntry } from '../admin.models';

@Component({
  selector: 'app-admin-config-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-config.page.html',
  styleUrl: './admin-config.page.scss',
})
export class AdminConfigPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly entries = signal<AdminConfigEntry[]>([]);
  readonly selected = signal<AdminConfigEntry | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly lookupForm = this.formBuilder.group({ key: ['', Validators.required] });
  readonly updateForm = this.formBuilder.group({ key: ['', Validators.required], value: ['', Validators.required] });
  readonly describedEntries = computed(() => this.entries().filter((entry) => Boolean(entry.description)).length);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    await this.run(
      'load',
      async () => this.loadEntries(),
      'Loading config entries failed.',
    );
  }

  protected async lookup(): Promise<void> {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const { key } = this.lookupForm.getRawValue();
    await this.run(
      'load',
      async () => this.lookupKey(key),
      'Config lookup failed.',
    );
  }

  protected async update(): Promise<void> {
    if (this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      return;
    }

    const { key, value } = this.updateForm.getRawValue();
    const confirmed = await this.confirm.confirm({
      title: 'Save this config change?',
      message: 'Runtime configuration changes can affect the whole application behavior. Confirm before sending the update.',
      details: `${key} → ${value}`,
      confirmLabel: 'Save config',
    });

    if (!confirmed) {
      return;
    }

    await this.run(
      'save',
      async () => {
        await firstValueFrom(this.adminApi.updateConfig(key, { value }));
        this.feedback.success('The config value was updated.', { title: 'Config saved' });
        await this.lookupKey(key);
        await this.loadEntries();
      },
      'Config update failed.',
    );
  }

  protected pickEntry(entry: AdminConfigEntry): void {
    this.selected.set(entry);
    this.lookupForm.patchValue({ key: entry.key ?? '' });
    this.updateForm.patchValue({ key: entry.key ?? '', value: entry.value ?? '' });
  }

  protected trackEntry(index: number, entry: AdminConfigEntry): string {
    return entry.key ?? String(index);
  }

  private async loadEntries(): Promise<void> {
    this.entries.set(await firstValueFrom(this.adminApi.getAllConfig()));
  }

  private async lookupKey(key: string): Promise<void> {
    const entry = await firstValueFrom(this.adminApi.getConfigByKey(key));
    this.selected.set(entry);
    this.updateForm.patchValue({ key: entry.key ?? key, value: entry.value ?? '' });
  }

  private async run(mode: 'load' | 'save', task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      if (mode === 'save') {
        this.saving.set(true);
      } else {
        this.loading.set(true);
      }

      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Config action failed' });
    } finally {
      this.loading.set(false);
      this.saving.set(false);
    }
  }
}
