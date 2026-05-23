import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, AuthResponse, LoginRequest, RenewRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly authBaseUrl = `${environment.apiBaseUrl}/api/auth`;

  login(payload: LoginRequest) {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authBaseUrl}/login`, payload)
      .pipe(map((response) => response.data));
  }

  renew(payload: RenewRequest) {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authBaseUrl}/renew`, payload)
      .pipe(map((response) => response.data));
  }
}
