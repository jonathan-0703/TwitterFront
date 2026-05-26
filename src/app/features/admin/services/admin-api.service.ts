import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/api/api-client.service';
import { AdminConfigEntry, AdminDashboardStats, AdminPostRecord, AdminReportDto, AdminUserRecord, AssignReportRequest, AuditLogEntry, ChangeUserRoleRequest, CreateReportRequest, FlagPostRequest, LiftSuspensionRequest, ResolveReportRequest, SuspendUserRequest, SuspensionDto, UpdateConfigRequest } from '../models/admin.models';
import { JsonRecord } from '../../../core/api/api.models';




@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiClientService);

  getDashboardStats(): Observable<AdminDashboardStats> {
    return this.api.get<AdminDashboardStats>('/api/admin/dashboard/stats');
  }

  recalculateDashboard(): Observable<JsonRecord> {
    return this.api.post<JsonRecord, JsonRecord>('/api/admin/dashboard/recalculate', {});
  }

  listUsers(): Observable<AdminUserRecord[]> {
    return this.api.get<AdminUserRecord[]>('/api/admin/users/list');
  }

  deleteAdminUser(id: string): Observable<JsonRecord> {
    return this.api.delete<JsonRecord>(`/api/admin/users/${id}`);
  }

  restoreAdminUser(id: string): Observable<JsonRecord> {
    return this.api.post<JsonRecord, JsonRecord>(`/api/admin/users/${id}/restore`, {});
  }

  verifyUser(id: string): Observable<JsonRecord> {
    return this.api.post<JsonRecord, JsonRecord>(`/api/admin/users/${id}/verify`, {});
  }

  unverifyUser(id: string): Observable<JsonRecord> {
    return this.api.delete<JsonRecord>(`/api/admin/users/${id}/verify`);
  }

  changeUserRole(id: string, payload: ChangeUserRoleRequest): Observable<JsonRecord> {
    return this.api.put<JsonRecord, ChangeUserRoleRequest>(`/api/admin/users/${id}/role`, payload);
  }

  listPosts(): Observable<AdminPostRecord[]> {

    return this.api.get<AdminPostRecord[]>('/api/admin/posts/list');
  }

  flagPost(id: string, payload: FlagPostRequest): Observable<JsonRecord> {
    return this.api.post<JsonRecord, FlagPostRequest>(`/api/admin/posts/${id}/flag`, payload);
  }

  deleteAdminPost(id: string): Observable<JsonRecord> {
    return this.api.delete<JsonRecord>(`/api/admin/posts/${id}`);
  }

  restoreAdminPost(id: string): Observable<JsonRecord> {
    return this.api.post<JsonRecord, JsonRecord>(`/api/admin/posts/${id}/restore`, {});
  }

  getPendingReports(): Observable<AdminReportDto[]> {

    return this.api.get<AdminReportDto[]>('/api/admin/reports/pending');
  }

  getAllReports(): Observable<AdminReportDto[]> {
    return this.api.get<AdminReportDto[]>('/api/admin/reports/all');
  }

  createReport(payload: CreateReportRequest): Observable<JsonRecord> {
    return this.api.post<JsonRecord, CreateReportRequest>('/api/admin/reports/create', payload);
  }

  assignReport(id: string, payload: AssignReportRequest): Observable<JsonRecord> {
    return this.api.put<JsonRecord, AssignReportRequest>(`/api/admin/reports/${id}/assign`, payload);
  }

  resolveReport(id: string, payload: ResolveReportRequest): Observable<JsonRecord> {
    return this.api.put<JsonRecord, ResolveReportRequest>(`/api/admin/reports/${id}/resolve`, payload);
  }

  dismissReport(id: string, payload: ResolveReportRequest): Observable<JsonRecord> {
    return this.api.put<JsonRecord, ResolveReportRequest>(`/api/admin/reports/${id}/dismiss`, payload);
  }

  suspendUser(payload: SuspendUserRequest): Observable<JsonRecord> {
    return this.api.post<JsonRecord, SuspendUserRequest>('/api/admin/suspensions/suspend', payload);
  }

  liftSuspension(payload: LiftSuspensionRequest): Observable<JsonRecord> {
    return this.api.post<JsonRecord, LiftSuspensionRequest>('/api/admin/suspensions/lift', payload);
  }

  getSuspensionHistory(userId: string): Observable<SuspensionDto[]> {
    return this.api.get<SuspensionDto[]>(`/api/admin/suspensions/history/${userId}`);
  }

  getAllConfig(): Observable<AdminConfigEntry[]> {
    return this.api.get<AdminConfigEntry[]>('/api/admin/config/all');
  }

  getConfigByKey(key: string): Observable<AdminConfigEntry> {
    return this.api.get<AdminConfigEntry>(`/api/admin/config/${encodeURIComponent(key)}`);
  }

  updateConfig(key: string, payload: UpdateConfigRequest): Observable<JsonRecord> {
    return this.api.put<JsonRecord, UpdateConfigRequest>(`/api/admin/config/${encodeURIComponent(key)}`, payload);
  }

  getAuditLogs(): Observable<AuditLogEntry[]> {
    return this.api.get<AuditLogEntry[]>('/api/admin/audit/logs');
  }
}
