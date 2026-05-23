import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminDashboardStats } from '../admin.models';

@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, StateCardComponent],
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly feedback = inject(FeedbackService);

  readonly stats = signal<AdminDashboardStats | null>(null);
  readonly loading = signal(false);
  readonly recalculating = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionResult = signal<unknown>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      this.stats.set(await firstValueFrom(this.adminApi.getDashboardStats()));
    } catch (error) {
      this.error.set(getErrorMessage(error, 'We could not load dashboard stats.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async recalculate(): Promise<void> {
    try {
      this.recalculating.set(true);
      this.error.set(null);
      this.actionResult.set(await firstValueFrom(this.adminApi.recalculateDashboard()));
      this.feedback.success('Dashboard stats were recalculated.', { title: 'Admin action complete' });
      await this.load();
    } catch (error) {
      const message = getErrorMessage(error, 'Dashboard recalculation failed.');
      this.error.set(message);
      this.feedback.error(message, { title: 'Admin action failed' });
    } finally {
      this.recalculating.set(false);
    }
  }

  protected entries(): Array<{ label: string; value: unknown }> {
    const stats = this.stats();

    if (!stats) {
      return [];
    }

    return Object.entries(stats).map(([label, value]) => ({ label, value }));
  }
}
