import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { UserAvatarComponent } from '../../users/components/user-avatar.component';
import { SendMessageButtonComponent } from '../../messages/components/send-message-button.component';

import { UserStoreService } from '../../users/services/user-store.service';
import { UsersApiService } from '../../users/services/users-api.service';
import { UserDto } from '../../users/models/users.models';


@Component({
  selector: 'app-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, StateCardComponent, UserAvatarComponent, SendMessageButtonComponent],
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
  readonly searchQuery = signal('');
  readonly users = this.userStore.users;
  readonly loading = this.userStore.loading;
  readonly storeError = this.userStore.error;
  readonly currentUserId = computed(() => this.sessionService.userId());
  readonly canDeleteUsers = computed(() => this.sessionService.hasRole(['Admin', 'SuperAdmin', 'Moderator', 'Developer']));

  // Centralized computed signal for filtering users based on the logged-in user's roles
  readonly filteredUsers = computed(() => {
    const allUsers = this.users();
    const isCurrentPrivileged = this.sessionService.hasRole(['Admin', 'SuperAdmin', 'Moderator', 'Developer']);

    if (isCurrentPrivileged) {
      return allUsers;
    }

    // Exclude users with administrative/moderative roles for normal users
    const privilegedRoles = ['Admin', 'SuperAdmin', 'Moderator', 'Developer'];
    return allUsers.filter((user) => !user.roles?.some((role) => privilegedRoles.includes(role)));
  });

  readonly featuredUser = computed(() => this.selectedUser() ?? this.directory()[0] ?? null);
  readonly activeCount = computed(() => this.filteredUsers().filter((user) => !user.deletedAt && user.isActive !== false).length);
  readonly verifiedCount = computed(() => this.filteredUsers().filter((user) => Boolean(user.isVerified)).length);
  readonly deletedCount = computed(() => this.filteredUsers().filter((user) => Boolean(user.deletedAt)).length);

  readonly directory = computed(() => {
    const sorted = [...this.filteredUsers()].sort((left, right) => this.compareUsers(left, right));
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return sorted;
    }

    return sorted.filter((user) => this.matchesQuery(user, query));
  });

  readonly hasActiveSearch = computed(() => this.searchQuery().trim().length > 0);
  readonly hasNoMatches = computed(() => this.hasActiveSearch() && !this.directory().length && !!this.filteredUsers().length);

  constructor() {
    void this.userStore.loadUsers();
  }

  protected inspect(user: UserDto): void {
    this.selectedUser.set(user);
  }

  protected isSelf(userId: string | undefined | null): boolean {
    const current = this.currentUserId();
    return Boolean(userId && current && userId === current);
  }

  protected async reload(): Promise<void> {
    await this.userStore.loadUsers();
  }

  protected async deleteUser(user: UserDto): Promise<void> {
    const userId = user.userId;

    if (!userId || this.deletingUserId()) {
      return;
    }

    if (this.isSelf(userId)) {
      this.feedback.error(
        'No podés eliminar tu propia cuenta. Pedile a otro administrador que lo haga si es necesario.',
        { title: 'Acción bloqueada' },
      );
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar este usuario?',
      message: 'Esto usa el endpoint privilegiado de eliminación y solo debe activarse cuando estés seguro de que la cuenta debe ser removida.',
      details: user.fullName || user.email || userId,
      confirmLabel: 'Eliminar usuario',
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
      this.feedback.success('El usuario se eliminó correctamente.', { title: 'Usuario eliminado' });
    } catch (error) {
      const message = getErrorMessage(error, 'El endpoint privilegiado de eliminación rechazó la solicitud.');
      this.actionError.set(message);
      this.feedback.error(message, { title: 'Error al eliminar' });
    } finally {
      this.deletingUserId.set(null);
    }
  }

  protected statusLabel(user: UserDto): string {
    if (user.deletedAt) {
      return 'Eliminado';
    }

    if (user.isSuspended) {
      return 'Suspendido';
    }

    if (user.isActive === false) {
      return 'Inactivo';
    }

    return user.isVerified ? 'Verificado' : 'Activo';
  }

  private compareUsers(left: UserDto, right: UserDto): number {
    return this.scoreUser(right) - this.scoreUser(left)
      || (left.fullName || left.email || '').localeCompare(right.fullName || right.email || '');
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  private matchesQuery(user: UserDto, query: string): boolean {
    const haystack = [
      user.fullName,
      user.email,
      user.biography,
      user.userId,
      ...(user.roles ?? []),
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => value.toLowerCase());

    return haystack.some((value) => value.includes(query));
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
