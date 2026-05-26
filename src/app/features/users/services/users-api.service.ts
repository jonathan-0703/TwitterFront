import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs';

import { ApiClientService } from '../../../core/api/api-client.service';
import { environment } from '../../../../environments/environment';
import { GenericResponse, JsonRecord } from '../../../core/api/api.models';
import { ChangePasswordRequest, RegisterUserRequest, TestEmailRequest, UpdateUserRequest, UserDto, UserListQuery } from '../models/users.models';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);

  register(payload: RegisterUserRequest): Observable<UserDto> {
    return this.api.post<UserDto, RegisterUserRequest>('/api/user/create', payload);
  }

  listUsers(query?: UserListQuery): Observable<UserDto[]> {
    return this.api.get<UserDto[], UserListQuery>('/api/user/list', query);
  }

  getUserById(id: string): Observable<UserDto> {
    return this.api.get<UserDto>(`/api/user/${id}`);
  }

  updateUser(payload: UpdateUserRequest): Observable<UserDto> {
    return this.api.put<UserDto, UpdateUserRequest>('/api/user/me', payload);
  }

  uploadAvatar(file: File): Observable<UserDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<GenericResponse<UserDto>>(`${environment.apiBaseUrl}/api/user/me/avatar`, formData)
      .pipe(map((response) => response.data));
  }

  changePassword(payload: ChangePasswordRequest): Observable<JsonRecord> {
    return this.api.patch<JsonRecord, ChangePasswordRequest>('/api/user/change-password', payload);
  }

  deleteUser(id: string): Observable<JsonRecord> {
    return this.api.delete<JsonRecord>(`/api/user/${id}/delete`);
  }

  getCurrentUser(): Observable<UserDto> {
    return this.api.get<UserDto>('/api/user/me');
  }

  sendTestEmail(payload: TestEmailRequest): Observable<JsonRecord> {
    const emailPayload = {
      to: payload.to,
      email: payload.to,
      recipient: payload.to,
      toEmail: payload.to,
      subject: payload.subject,
      body: payload.body,
      message: payload.body,
    };

    return this.api.post<JsonRecord, typeof emailPayload>('/api/user/test-email', emailPayload);
  }
}
