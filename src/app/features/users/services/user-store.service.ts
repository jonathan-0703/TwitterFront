import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { UserAvatarRevisionService } from './user-avatar-revision.service';
import { UsersApiService } from './users-api.service';
import { UpdateUserRequest, UserDto } from '../models/users.models';

@Injectable({ providedIn: 'root' })
export class UserStoreService {
  private readonly usersApi = inject(UsersApiService);
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);
  private readonly avatarRevisions = inject(UserAvatarRevisionService);

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
    }, 'No pudimos cargar el usuario actual.');
  }

  clearCurrentUser(): void {
    this.currentUserState.set(null);
  }

  async loadUsers(): Promise<void> {
    await this.run(async () => {
      this.usersState.set(await firstValueFrom(this.usersApi.listUsers()));
    }, 'No pudimos cargar la lista de usuarios.');
  }

  async updateCurrentUser(payload: UpdateUserRequest): Promise<UserDto | null> {
    if (!this.currentUserId()) {
      this.errorState.set('No se encontró una sesión de usuario activa.');
      this.feedback.error('No se encontró una sesión de usuario activa.', { title: 'Error al actualizar perfil' });
      return null;
    }

    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      const user = await firstValueFrom(this.usersApi.updateUser(payload));
      this.currentUserState.set(user);
      this.usersState.update((users) => users.map((item) => (item.userId === user.userId ? user : item)));
      this.feedback.success('Tu perfil se actualizó.', { title: 'Perfil guardado' });
      return user;
    } catch (error) {
      const message = getErrorMessage(error, 'No pudimos actualizar el perfil.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Error al actualizar perfil' });
      return null;
    } finally {
      this.loadingState.set(false);
    }
  }

  async uploadCurrentUserAvatar(file: File): Promise<UserDto | null> {
    if (!this.currentUserId()) {
      this.errorState.set('No se encontró una sesión de usuario activa.');
      this.feedback.error('No se encontró una sesión de usuario activa.', { title: 'Error al subir el avatar' });
      return null;
    }

    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      const user = await firstValueFrom(this.usersApi.uploadAvatar(file));
      this.currentUserState.set(user);
      this.usersState.update((users) => users.map((item) => (item.userId === user.userId ? user : item)));
      if (user.userId) {
        this.avatarRevisions.bump(user.userId);
      }
      this.feedback.success('Tu foto de perfil se actualizó.', { title: 'Avatar actualizado' });
      return user;
    } catch (error) {
      const message = getErrorMessage(error, 'No pudimos subir la foto de perfil.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Error al subir el avatar' });
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
