import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { UsersApiService } from '../../users/users-api.service';
import { UserStoreService } from '../../users/user-store.service';
import { UserDto } from '../../users/users.models';

@Component({
  selector: 'app-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, RouterLink, StateCardComponent],
  templateUrl: './people.page.html',
  styleUrl: './people.page.scss',
})
export class PeoplePage {
  private readonly userStore = inject(UserStoreService);
  private readonly usersApi = inject(UsersApiService);
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly selectedUser = signal<UserDto | null>(null);
  readonly deletingUserId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly users = this.userStore.users;
  readonly loading = this.userStore.loading;
  readonly storeError = this.userStore.error;
  readonly canDeleteUsers = computed(() => this.sessionService.hasRole(['Admin', 'SuperAdmin', 'Moderator', 'Developer']));
  readonly featuredUser = computed(() => this.selectedUser() ?? this.directory()[0] ?? null);
  readonly activeCount = computed(() => this.users().filter((user) => !user.deletedAt && user.isActive !== false).length);
  readonly verifiedCount = computed(() => this.users().filter((user) => Boolean(user.isVerified)).length);
  readonly deletedCount = computed(() => this.users().filter((user) => Boolean(user.deletedAt)).length);
  readonly directory = computed(() => [...this.users()].sort((left, right) => this.compareUsers(left, right)));

  constructor() {
    void this.userStore.loadUsers();
  }

  protected inspect(user: UserDto): void {
    this.selectedUser.set(user);
  }

  protected async reload(): Promise<void> {
    await this.userStore.loadUsers();
  }

  protected async deleteUser(user: UserDto): Promise<void> {
    const userId = user.userId;

    if (!userId || this.deletingUserId()) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Delete this user?',
      message: 'This uses the privileged delete endpoint and should only be triggered when you are certain the account must be removed.',
      details: user.fullName || user.email || userId,
      confirmLabel: 'Delete user',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      this.deletingUserId.set(userId);
      this.actionError.set(null);
      await firstValueFrom(this.usersApi.deleteUser(userId));
      if (this.selectedUser()?.userId === userId) {
        this.selectedUser.set(null);
      }
      await this.userStore.loadUsers();
      this.feedback.success('The user was deleted successfully.', { title: 'User removed' });
    } catch (error) {
      const message = getErrorMessage(error, 'The privileged delete endpoint rejected this request.');
      this.actionError.set(message);
      this.feedback.error(message, { title: 'Delete failed' });
    } finally {
      this.deletingUserId.set(null);
    }
  }

  protected statusLabel(user: UserDto): string {
    if (user.deletedAt) {
      return 'Deleted';
    }

    if (user.isSuspended) {
      return 'Suspended';
    }

    if (user.isActive === false) {
      return 'Inactive';
    }

    return user.isVerified ? 'Verified' : 'Active';
  }

  protected initials(user: UserDto): string {
    const source = (user.fullName || user.email || user.userId || 'Unknown')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    return source || '??';
  }

  private compareUsers(left: UserDto, right: UserDto): number {
    return this.scoreUser(right) - this.scoreUser(left)
      || (left.fullName || left.email || '').localeCompare(right.fullName || right.email || '');
  }

  private scoreUser(user: UserDto): number {
    if (user.deletedAt) {
      return 0;
    }

    if (user.isSuspended || user.isActive === false) {
      return 1;
    }

    if (user.isVerified) {
      return 3;
    }

    return 2;
  }
}
