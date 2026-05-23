import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../core/api/api.utils';
import { SessionService } from '../../core/auth/session.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { UsersApiService } from './users-api.service';
import { UpdateUserRequest, UserDto } from './users.models';

@Injectable({ providedIn: 'root' })
export class UserStoreService {
  private readonly usersApi = inject(UsersApiService);
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);

  private readonly currentUserState = signal<UserDto | null>(null);
  private readonly usersState = signal<UserDto[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly users = this.usersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly currentUserId = computed(() => this.currentUserState()?.userId ?? this.sessionService.userId());

  async loadCurrentUser(force = false): Promise<void> {
    if (this.currentUserState() && !force) {
      return;
    }

    await this.run(async () => {
      this.currentUserState.set(await firstValueFrom(this.usersApi.getCurrentUser()));
    }, 'We could not load the current user.');
  }

  async loadUsers(): Promise<void> {
    await this.run(async () => {
      this.usersState.set(await firstValueFrom(this.usersApi.listUsers()));
    }, 'We could not load the users list.');
  }

  async updateCurrentUser(payload: UpdateUserRequest): Promise<UserDto | null> {
    const userId = this.currentUserId();

    if (!userId) {
      this.errorState.set('No active user session was found.');
      this.feedback.error('No active user session was found.', { title: 'Profile update failed' });
      return null;
    }

    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      const user = await firstValueFrom(this.usersApi.updateUser(userId, payload));
      this.currentUserState.set(user);
      this.usersState.update((users) => users.map((item) => (item.userId === user.userId ? user : item)));
      this.feedback.success('Your profile was updated.', { title: 'Profile saved' });
      return user;
    } catch (error) {
      const message = getErrorMessage(error, 'We could not update the profile.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Profile update failed' });
      return null;
    } finally {
      this.loadingState.set(false);
    }
  }

  private async run(task: () => Promise<void>, fallbackMessage: string): Promise<void> {
    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      await task();
    } catch (error) {
      this.errorState.set(getErrorMessage(error, fallbackMessage));
    } finally {
      this.loadingState.set(false);
    }
  }
}
