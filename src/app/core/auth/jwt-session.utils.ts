import { adminRoles, type AppRole } from './session.model';

interface JwtClaims {
  role: AppRole | null;
  userId: string | null;
}

const roleClaimKeys = [
  'role',
  'roles',
  'appRole',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
] as const;

const userIdClaimKeys = [
  'sub',
  'id',
  'userId',
  'UserId',
  'userid',
  'uid',
  'nameid',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
] as const;

export function readJwtClaims(token: string | null): JwtClaims {
  if (!token) {
    return { role: null, userId: null };
  }

  const payload = parseJwtPayload(token);

  return {
    role: readRoleClaim(payload),
    userId: readUserIdClaim(payload),
  };
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    const decodedPayload = decodeBase64Url(payload);
    const parsedPayload = JSON.parse(decodedPayload);

    return isRecord(parsedPayload) ? parsedPayload : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('Base64 decoding is unavailable in the current environment.');
  }

  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4), '=');
  const binaryString = globalThis.atob(paddedValue);
  const bytes = Uint8Array.from(binaryString, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function readRoleClaim(payload: Record<string, unknown> | null): AppRole | null {
  if (!payload) {
    return null;
  }

  for (const key of roleClaimKeys) {
    const claim = payload[key];
    const role = normalizeRoleClaim(claim);

    if (role) {
      return role;
    }
  }

  return null;
}

function readUserIdClaim(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }

  for (const key of userIdClaimKeys) {
    const claim = payload[key];

    if (typeof claim === 'string' && claim.trim()) {
      return claim;
    }

    if (typeof claim === 'number' && Number.isFinite(claim)) {
      return String(claim);
    }
  }

  return null;
}

function normalizeRoleClaim(claim: unknown): AppRole | null {
  if (typeof claim === 'string') {
    return normalizeRoleValue(claim);
  }

  if (Array.isArray(claim)) {
    for (const entry of claim) {
      if (typeof entry !== 'string') {
        continue;
      }

      const role = normalizeRoleValue(entry);

      if (role) {
        return role;
      }
    }
  }

  return null;
}

function normalizeRoleValue(role: string): AppRole | null {
  const trimmedRole = role.trim();

  if (!trimmedRole) {
    return null;
  }

  const knownRole = adminRoles.find((adminRole) => adminRole === trimmedRole);

  return knownRole ?? trimmedRole;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
