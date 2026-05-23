export const adminRoles = ['Admin', 'SuperAdmin', 'Moderator', 'Developer'] as const;

export type AdminRole = (typeof adminRoles)[number];

export type AppRole = AdminRole | 'User' | string;

export interface UserSession {
  accessToken: string | null;
  refreshToken: string | null;
  role: AppRole | null;
  userId: string | null;
}
