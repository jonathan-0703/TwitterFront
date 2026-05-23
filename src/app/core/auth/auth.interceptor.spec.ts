import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthApiService } from './auth-api.service';
import { authInterceptor } from './auth.interceptor';
import { AuthResponse } from './auth.models';
import { SessionService } from './session.service';

describe('authInterceptor', () => {
  const router = {
    navigate: vi.fn(),
  };

  const sessionService = {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    startSession: vi.fn(),
    clearSession: vi.fn(),
  };

  const authApi = {
    renew: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    router.navigate.mockResolvedValue(true);
    sessionService.getAccessToken.mockReturnValue('access-token');
    sessionService.getRefreshToken.mockReturnValue('refresh-token');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: SessionService, useValue: sessionService },
        { provide: AuthApiService, useValue: authApi },
      ],
    });
  });

  it('renews the session and retries the failed request once', async () => {
    const renewedSession = createAuthResponse('renewed-token', 'refresh-token-2');
    const request = new HttpRequest('GET', '/api/post/list');

    authApi.renew.mockReturnValue(of(renewedSession));

    const next = vi
      .fn()
      .mockImplementationOnce((outgoing: HttpRequest<unknown>) => {
        expect(outgoing.headers.get('Authorization')).toBe('Bearer access-token');
        return throwError(() => new HttpErrorResponse({ status: 401, url: request.url }));
      })
      .mockImplementationOnce((outgoing: HttpRequest<unknown>) => {
        expect(outgoing.headers.get('Authorization')).toBe(`Bearer ${renewedSession.token}`);
        return of(new HttpResponse({ status: 200, body: { ok: true } }));
      });

    const response = (await firstValueFrom(
      TestBed.runInInjectionContext(() => authInterceptor(request, next)),
    )) as HttpResponse<{ ok: boolean }>;

    expect(response.body).toEqual({ ok: true });
    expect(authApi.renew).toHaveBeenCalledWith({ refreshToken: 'refresh-token' });
    expect(sessionService.startSession).toHaveBeenCalledWith(renewedSession);
    expect(sessionService.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('clears the session when a 401 happens without a refresh token', async () => {
    const request = new HttpRequest('GET', '/api/post/list');
    sessionService.getRefreshToken.mockReturnValue(null);

    const next = vi.fn().mockImplementation(() =>
      throwError(() => new HttpErrorResponse({ status: 401, url: request.url })),
    );

    await expect(firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(request, next)))).rejects.toBeTruthy();

    expect(authApi.renew).not.toHaveBeenCalled();
    expect(sessionService.clearSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

function createAuthResponse(token: string, refreshToken: string): AuthResponse {
  return {
    token,
    refreshToken,
  };
}
