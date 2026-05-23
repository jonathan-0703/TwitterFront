import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthResponse } from './auth.models';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let storage: Storage;

  beforeEach(() => {
    TestBed.resetTestingModule();
    storage = createStorage();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: {
            defaultView: {
              localStorage: storage,
            },
          },
        },
        {
          provide: PLATFORM_ID,
          useValue: 'browser',
        },
      ],
    });
  });

  it('hydrates an existing session from storage', () => {
    const response = createAuthResponse({ role: 'Admin', userId: '42' });

    storage.setItem('twitter.access_token', response.token);
    storage.setItem('twitter.refresh_token', response.refreshToken);

    const service = TestBed.inject(SessionService);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getRole()).toBe('Admin');
    expect(service.userId()).toBe('42');
    expect(service.getRefreshToken()).toBe('refresh-token');
  });

  it('startSession stores tokens and derived claims', () => {
    const service = TestBed.inject(SessionService);
    const response = createAuthResponse({ role: 'User', userId: '7' }, 'refresh-7');

    service.startSession(response);

    expect(service.accessToken()).toBe(response.token);
    expect(service.refreshToken()).toBe('refresh-7');
    expect(service.role()).toBe('User');
    expect(service.userId()).toBe('7');
    expect(storage.getItem('twitter.access_token')).toBe(response.token);
    expect(storage.getItem('twitter.refresh_token')).toBe('refresh-7');
  });

  it('clearSession removes session state and storage', () => {
    const service = TestBed.inject(SessionService);

    service.startSession(createAuthResponse({ role: 'Moderator', userId: '81' }));
    service.clearSession();

    expect(service.getSession()).toEqual({
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
    });
    expect(storage.getItem('twitter.access_token')).toBeNull();
    expect(storage.getItem('twitter.refresh_token')).toBeNull();
  });
});

function createAuthResponse(
  claims: { role: string; userId: string },
  refreshToken = 'refresh-token',
): AuthResponse {
  return {
    token: createJwt(claims),
    refreshToken,
  };
}

function createJwt(claims: { role: string; userId: string }): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({ role: claims.role, sub: claims.userId }));

  return `${header}.${payload}.signature`;
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    length: 0,
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } as Storage;
}
