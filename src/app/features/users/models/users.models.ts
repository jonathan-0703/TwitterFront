import { JsonRecord, PaginationQuery } from "../../../core/api/api.models";


export interface UserDto extends JsonRecord {
  userId?: string;
  fullName?: string;
  email?: string;
  biography?: string | null;
  isActive?: boolean;
  createdAt?: string;
  roles?: string[];
  isSuspended?: boolean;
  isShadowBanned?: boolean;
  deletedAt?: string | null;
  isVerified?: boolean;
  profilePhotoFileName?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoUrl?: string | null;
}

export interface RegisterUserRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  biography?: string | null;
  isActive?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TestEmailRequest {
  to: string;
  subject: string;
  body: string;
}

export interface UserListQuery extends PaginationQuery {
  search?: string;
}
