import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { AuthResponse } from './auth.models';
import { readJwtClaims } from './jwt-session.utils';
import { AppRole, UserSession } from './session.model';

const accessTokenStorageKey = 'twitter.access_token';
const refreshTokenStorageKey = 'twitter.refresh_token';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sessionState = signal<UserSession>(this.createEmptySession());
  private hydrated = false;

  readonly session = this.sessionState.asReadonly();
  readonly accessToken = computed(() => this.sessionState().accessToken);
  readonly refreshToken = computed(() => this.sessionState().refreshToken);
  readonly role = computed(() => this.sessionState().role);
  readonly userId = computed(() => this.sessionState().userId);
  readonly authenticated = computed(() => Boolean(this.accessToken() && this.refreshToken()));

  constructor() {
    this.hydrate();
  }

  hydrate(): void {
    if (this.hydrated) {
      return;
    }

    this.hydrated = true;

    const accessToken = this.readStorage(accessTokenStorageKey);
    const refreshToken = this.readStorage(refreshTokenStorageKey);

    if (!accessToken || !refreshToken) {
      this.clearSession();
      return;
    }

    this.replaceSession({ accessToken, refreshToken });
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  getRole(): AppRole | null {
    return this.role();
  }

  getSession(): UserSession {
    return this.sessionState();
  }

  hasRole(allowedRoles: readonly AppRole[]): boolean {
    const role = this.role();

    return role !== null && allowedRoles.includes(role);
  }

  startSession(response: AuthResponse): void {
    this.replaceSession({
      accessToken: response.token,
      refreshToken: response.refreshToken,
    });
  }

  clearSession(): void {
    this.sessionState.set(this.createEmptySession());
    this.removeStorage(accessTokenStorageKey);
    this.removeStorage(refreshTokenStorageKey);
  }

  private replaceSession(tokens: { accessToken: string; refreshToken: string }): void {
    const claims = readJwtClaims(tokens.accessToken);

    this.sessionState.set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: claims.role,
      userId: claims.userId,
    });

    this.writeStorage(accessTokenStorageKey, tokens.accessToken);
    this.writeStorage(refreshTokenStorageKey, tokens.refreshToken);
  }

  private createEmptySession(): UserSession {
    return {
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
    };
  }

  private readStorage(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      return this.document.defaultView?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      this.document.defaultView?.localStorage.setItem(key, value);
    } catch {
      // Ignore storage write failures to keep auth flow resilient.
    }
  }

  private removeStorage(key: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      this.document.defaultView?.localStorage.removeItem(key);
    } catch {
      // Ignore storage delete failures to keep auth flow resilient.
    }
  }
}
