import { readJwtClaims } from './jwt-session.utils';

describe('readJwtClaims', () => {
  it('reads role and user id from common claim keys', () => {
    const token = createJwt({
      roles: ['User', 'Admin'],
      userId: 99,
    });

    expect(readJwtClaims(token)).toEqual({
      role: 'User',
      userId: '99',
    });
  });

  it('supports schema-based role and subject claims', () => {
    const token = createJwt({
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'SuperAdmin',
      sub: 'user-42',
    });

    expect(readJwtClaims(token)).toEqual({
      role: 'SuperAdmin',
      userId: 'user-42',
    });
  });

  it('returns null claims for invalid payloads', () => {
    expect(readJwtClaims('bad-token')).toEqual({ role: null, userId: null });
    expect(readJwtClaims(null)).toEqual({ role: null, userId: null });
  });
});

function createJwt(payload: Record<string, unknown>): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  return `${header}.${encodeBase64Url(JSON.stringify(payload))}.signature`;
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
