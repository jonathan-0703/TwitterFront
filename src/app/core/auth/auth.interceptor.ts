import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthResponse } from './auth.models';
import { SessionService } from './session.service';

const authRetryContext = new HttpContextToken<boolean>(() => false);

let refreshRequest$: Observable<AuthResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const authApiService = inject(AuthApiService);
  const router = inject(Router);

  const request = shouldAttachAuthHeader(req.url)
    ? attachBearerToken(req, sessionService.getAccessToken())
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!shouldAttemptRefresh(error, req.url, request.context.get(authRetryContext))) {
        return throwError(() => error);
      }

      const refreshToken = sessionService.getRefreshToken();

      if (!refreshToken) {
        handleAuthFailure(sessionService, router);
        return throwError(() => error);
      }

      return renewAccessToken(authApiService, sessionService, refreshToken).pipe(
        switchMap((response) => {
          const retryRequest = attachBearerToken(
            req.clone({
              context: req.context.set(authRetryContext, true),
            }),
            response.token,
          );

          return next(retryRequest);
        }),
        catchError((refreshError: unknown) => {
          handleAuthFailure(sessionService, router);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function renewAccessToken(
  authApiService: AuthApiService,
  sessionService: SessionService,
  refreshToken: string,
): Observable<AuthResponse> {
  if (!refreshRequest$) {
    refreshRequest$ = authApiService.renew({ refreshToken }).pipe(
      shareReplay(1),
      finalize(() => {
        refreshRequest$ = null;
      }),
    );
  }

  return refreshRequest$.pipe(
    switchMap((response) => {
      sessionService.startSession(response);
      return [response];
    }),
  );
}

function attachBearerToken<T extends { clone: (update: { setHeaders: Record<string, string> }) => T }>(request: T, token: string | null) {
  if (!token) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function shouldAttachAuthHeader(url: string): boolean {
  return !isAuthEndpoint(url);
}

function shouldAttemptRefresh(error: unknown, url: string, hasRetried: boolean): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 401 && !hasRetried && !isAuthEndpoint(url);
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/api/auth/login') || url.includes('/api/auth/renew');
}

function handleAuthFailure(sessionService: SessionService, router: Router): void {
  sessionService.clearSession();
  void router.navigate(['/login']);
}
