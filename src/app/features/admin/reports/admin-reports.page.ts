import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminReportDto } from '../admin.models';

type ReportHistoryFilter = 'all' | 'pending' | 'resolved' | 'dismissed';

@Component({
  selector: 'app-admin-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-reports.page.html',
  styleUrl: './admin-reports.page.scss',
})
export class AdminReportsPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly pendingReports = signal<AdminReportDto[]>([]);
  readonly allReports = signal<AdminReportDto[]>([]);
  readonly loading = signal(false);
  readonly actingReportId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly selected = signal<AdminReportDto | null>(null);
  readonly historyFilter = signal<ReportHistoryFilter>('all');
  readonly createForm = this.formBuilder.group({ postId: ['', Validators.required], reason: ['', Validators.required], description: [''] });
  readonly assignForm = this.formBuilder.group({ reportId: ['', Validators.required], assignedToUserId: ['', Validators.required] });
  readonly resolveForm = this.formBuilder.group({ reportId: ['', Validators.required], resolutionNote: [''] });
  readonly queueFocus = computed(() => this.selected() ?? this.pendingReports()[0] ?? this.allReports()[0] ?? null);
  readonly pendingCount = computed(() => this.pendingReports().length);
  readonly resolvedCount = computed(() => this.allReports().filter((report) => this.reportStatus(report) === 'Resuelto').length);
  readonly dismissedCount = computed(() => this.allReports().filter((report) => this.reportStatus(report) === 'Descartado').length);
  readonly unassignedPendingCount = computed(
    () => this.pendingReports().filter((report) => !(report.assignedToUserId ?? '').trim()).length,
  );
  readonly filteredHistory = computed(() => {
    const filter = this.historyFilter();

    if (filter === 'all') {
      return this.allReports();
    }

    return this.allReports().filter((report) => {
      const status = this.reportStatus(report).toLowerCase();

      switch (filter) {
        case 'pending':
          return status === 'pending';
        case 'resolved':
          return status === 'resolved';
        case 'dismissed':
          return status === 'dismissed';
        default:
          return true;
      }
    });
  });

  constructor() { void this.load(); }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      const [pending, all] = await Promise.all([
        firstValueFrom(this.adminApi.getPendingReports()),
        firstValueFrom(this.adminApi.getAllReports()),
      ]);
      this.pendingReports.set(pending);
      this.allReports.set(all);
      this.syncSelection(pending, all);
    } catch (error) {
      this.error.set(getErrorMessage(error, 'No pudimos cargar los reportes.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(report: AdminReportDto): void {
    this.selected.set(report);
    this.assignForm.patchValue({ reportId: report.reportId ?? '' });
    this.resolveForm.patchValue({ reportId: report.reportId ?? '' });
  }

  protected setHistoryFilter(filter: ReportHistoryFilter): void {
    this.historyFilter.set(filter);
  }

  protected async create(): Promise<void> {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    await this.run(null, async () => { await firstValueFrom(this.adminApi.createReport(this.createForm.getRawValue())); this.feedback.success('El reporte se creó correctamente.', { title: 'Reporte creado' }); this.createForm.reset({ postId: '', reason: '', description: '' }); await this.load(); }, 'Falló la creación del reporte.');
  }

  protected async assign(): Promise<void> {
    if (this.assignForm.invalid) { this.assignForm.markAllAsTouched(); return; }
    const { reportId, assignedToUserId } = this.assignForm.getRawValue();
    await this.run(reportId, async () => { await firstValueFrom(this.adminApi.assignReport(reportId, { assignedToUserId })); this.feedback.success('El reporte fue asignado.', { title: 'Reporte asignado' }); await this.load(); }, 'Falló la asignación del reporte.');
  }

  protected async resolve(): Promise<void> {
    if (this.resolveForm.invalid) { this.resolveForm.markAllAsTouched(); return; }
    const { reportId, resolutionNote } = this.resolveForm.getRawValue();

    const report = this.findReport(reportId);
    const confirmed = await this.confirm.confirm({
      title: '¿Resolver este reporte?',
      message: 'Marca el caso de moderación como resuelto desde el espacio de trabajo de reportes.',
      details: report ? this.reportTitle(report) : undefined,
      confirmLabel: 'Resolver reporte',
    });

    if (!confirmed) {
      return;
    }

    await this.run(reportId, async () => { await firstValueFrom(this.adminApi.resolveReport(reportId, { resolutionNote })); this.feedback.success('El reporte se resolvió.', { title: 'Reporte resuelto' }); await this.load(); }, 'Falló la resolución del reporte.');
  }

  protected async dismiss(report: AdminReportDto): Promise<void> {
    const reportId = report.reportId;

    if (!reportId) { return; }

    const confirmed = await this.confirm.confirm({
      title: '¿Descartar este reporte?',
      message: 'Descartarlo lo quita del flujo de moderación pendiente sin resolverlo.',
      details: this.reportTitle(report),
      confirmLabel: 'Descartar reporte',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(reportId, async () => { await firstValueFrom(this.adminApi.dismissReport(reportId, {})); this.feedback.info('El reporte se descartó.', { title: 'Reporte descartado' }); await this.load(); }, 'Falló el descarte del reporte.');
  }

  protected reportTitle(report: AdminReportDto): string {
    return report.reason?.trim() || report.reportId || 'Reporte';
  }

  protected reportStatus(report: AdminReportDto): string {
    const status = (report.status ?? '').trim().toLowerCase();

    if (!status || status === 'open' || status === 'assigned' || status === 'in_review' || status === 'in-review') {
      return 'Pendiente';
    }

    if (status === 'resolved') {
      return 'Resuelto';
    }

    if (status === 'dismissed') {
      return 'Descartado';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  protected reportSummary(report: AdminReportDto): string {
    return report.description?.trim() || 'Sin descripción.';
  }

  protected isSelected(report: AdminReportDto): boolean {
    return this.selected()?.reportId === report.reportId;
  }

  protected isActing(reportId: string | undefined): boolean {
    return Boolean(reportId) && this.actingReportId() === reportId;
  }

  private findReport(reportId: string): AdminReportDto | null {
    return [...this.pendingReports(), ...this.allReports()].find((report) => report.reportId === reportId) ?? null;
  }

  private syncSelection(pending: AdminReportDto[], all: AdminReportDto[]): void {
    const currentSelectionId = this.selected()?.reportId;
    const availableReports = [...pending, ...all];

    if (currentSelectionId) {
      this.selected.set(availableReports.find((report) => report.reportId === currentSelectionId) ?? null);
      return;
    }

    this.selected.set(pending[0] ?? all[0] ?? null);

    if (this.selected()) {
      this.pick(this.selected()!);
    }
  }

  private async run(reportId: string | null, task: () => Promise<void>, fallback: string): Promise<void> {
    try { this.actingReportId.set(reportId); this.error.set(null); await task(); } catch (error) { const message = getErrorMessage(error, fallback); this.error.set(message); this.feedback.error(message, { title: 'Error en la acción de administración' }); } finally { this.actingReportId.set(null); }
  }
}
