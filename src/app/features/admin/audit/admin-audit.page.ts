import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';

import { AuditLogEntry } from '../models/admin.models';
import { AdminApiService } from '../services/admin-api.service';

@Component({
  selector: 'app-admin-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, StateCardComponent],
  templateUrl: './admin-audit.page.html',
  styleUrl: './admin-audit.page.scss',
})
export class AdminAuditPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly feedback = inject(FeedbackService);

  readonly logs = signal<AuditLogEntry[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly uniqueActors = computed(() => new Set(this.logs().map((entry) => entry.userId).filter(Boolean)).size);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      this.logs.set(await firstValueFrom(this.adminApi.getAuditLogs()));
    } catch (error) {
      const message = getErrorMessage(error, 'Falló la carga de los registros de auditoría.');
      this.error.set(message);
      this.feedback.error(message, { title: 'Error al cargar auditoría' });
    } finally {
      this.loading.set(false);
    }
  }

  protected trackLog(index: number, entry: AuditLogEntry): string {
    return entry.id ?? entry.createdAt ?? String(index);
  }
}
