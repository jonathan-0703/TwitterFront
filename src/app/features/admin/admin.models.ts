import { JsonRecord, PaginationQuery } from '../../core/api/api.models';
import { PostDto } from '../posts/posts.models';
import { UserDto } from '../users/users.models';

export interface AdminDashboardStats extends JsonRecord {
  usersCount?: number;
  postsCount?: number;
  pendingReports?: number;
  suspendedUsers?: number;
}

export interface AdminReportDto extends JsonRecord {
  reportId?: string;
  postId?: string;
  reportedUserId?: string;
  assignedToUserId?: string | null;
  status?: string;
  reason?: string;
  description?: string;
  createdAt?: string;
}

export interface SuspensionDto extends JsonRecord {
  suspensionId?: string;
  userId?: string;
  reason?: string;
  until?: string | null;
  createdAt?: string;
  liftedAt?: string | null;
}

export interface AdminConfigEntry extends JsonRecord {
  key?: string;
  value?: string;
  description?: string;
}

export interface AuditLogEntry extends JsonRecord {
  id?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  createdAt?: string;
}

export interface AdminUsersListQuery extends PaginationQuery {
  includeDeleted?: boolean;
}

export interface ChangeUserRoleRequest {
  role: string;
}

export interface FlagPostRequest {
  reason: string;
}

export interface CreateReportRequest {
  postId: string;
  reason: string;
  description?: string;
}

export interface AssignReportRequest {
  assignedToUserId: string;
}

export interface ResolveReportRequest {
  resolutionNote?: string;
}

export interface SuspendUserRequest {
  userId: string;
  reason: string;
  until?: string;
}

export interface LiftSuspensionRequest {
  userId: string;
  reason?: string;
}

export interface UpdateConfigRequest {
  value: string;
}

export type AdminUserRecord = UserDto;
export type AdminPostRecord = PostDto;
