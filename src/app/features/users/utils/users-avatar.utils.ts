import { environment } from '../../../../environments/environment';
import { UserDto } from '../models/users.models';



/**
 * Returns the absolute URL to use as `<img src>` for a user's avatar.
 *
 *  - Absolute URLs (CDN / presigned) are returned as-is.
 *  - Relative paths are prefixed with `apiBaseUrl`.
 *  - When the user has no `profilePhotoUrl` but does have a `userId`, the
 *    canonical anonymous endpoint `/api/user/{id}/avatar` is used.
 *  - Returns `null` only when there is nothing meaningful to render.
 */
export function resolveAvatarUrl(user: UserDto | null | undefined): string | null {
  if (!user) {
    return null;
  }

  const directUrl = user.profilePhotoUrl?.trim();

  if (directUrl) {
    return isAbsoluteUrl(directUrl) ? directUrl : joinUrl(environment.apiBaseUrl, directUrl);
  }

  if (user.userId) {
    return `${environment.apiBaseUrl}/api/user/${user.userId}/avatar`;
  }

  return null;
}

/**
 * Initials derived from the user full name / email / id, capped to 2 chars.
 */
export function deriveUserInitials(user: UserDto | null | undefined): string {
  const source = (user?.fullName || user?.email || user?.userId || 'Unknown')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return source || '??';
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function joinUrl(base: string, path: string): string {
  if (!base) {
    return path;
  }

  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;

  return `${trimmedBase}${trimmedPath}`;
}
