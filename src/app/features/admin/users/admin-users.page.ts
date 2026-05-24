import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminUserRecord } from '../admin.models';

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);
  private readonly sessionService = inject(SessionService);

  readonly users = signal<AdminUserRecord[]>([]);
  readonly loading = signal(false);
  readonly actingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly selected = signal<AdminUserRecord | null>(null);
  readonly currentUserId = computed(() => this.sessionService.userId());
  readonly roleForm = this.formBuilder.group({
    userId: ['', [Validators.required]],
    role: ['User', [Validators.required]],
  });

  protected isSelf(userId: string | undefined | null): boolean {
    const current = this.currentUserId();
    return Boolean(userId && current && userId === current);
  }

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      this.users.set(await firstValueFrom(this.adminApi.listUsers()));
    } catch (error) {
      this.error.set(getErrorMessage(error, 'No pudimos cargar los usuarios de administración.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(user: AdminUserRecord): void {
    this.selected.set(user);
    this.roleForm.reset({ userId: user.userId ?? '', role: user.roles?.[0] ?? 'User' });
  }

  protected async submitRoleChange(): Promise<void> {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const { userId, role } = this.roleForm.getRawValue();
    await this.run(userId, async () => {
      await firstValueFrom(this.adminApi.changeUserRole(userId, { role }));
      this.feedback.success('El rol del usuario se actualizó.', { title: 'Rol cambiado' });
      await this.load();
    }, 'Falló la actualización del rol.');
  }

  protected async deleteUser(userId: string | undefined): Promise<void> {
    if (!userId) {
      return;
    }

    if (this.isSelf(userId)) {
      this.feedback.error(
        'No podés eliminar tu propia cuenta desde la consola de administración. Pedile a otro admin que lo haga si es necesario.',
        { title: 'Acción bloqueada' },
      );
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar este usuario?',
      message: 'Esto elimina la cuenta (soft delete) desde la consola de administración. Úsalo solo cuando la decisión de moderación sea final.',
      confirmLabel: 'Eliminar usuario',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(this.adminApi.deleteAdminUser(userId));
      this.feedback.success('El usuario se eliminó desde la consola de administración.', { title: 'Usuario eliminado' });
      await this.load();
    }, 'Falló la eliminación del usuario.');
  }

  protected async restoreUser(userId: string | undefined): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Restaurar este usuario?',
      message: 'Devuelve la cuenta a un estado activo de moderación en la consola de administración.',
      confirmLabel: 'Restaurar usuario',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(this.adminApi.restoreAdminUser(userId));
      this.feedback.success('La cuenta del usuario se restauró.', { title: 'Usuario restaurado' });
      await this.load();
    }, 'Falló la restauración del usuario.');
  }

  protected async verifyUser(userId: string | undefined, verified: boolean): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: verified ? '¿Quitar la verificación?' : '¿Verificar este usuario?',
      message: verified
        ? 'Quita el estado de verificación de la cuenta. Debería coincidir con tu política de moderación.'
        : 'Marca la cuenta como verificada en el sistema de administración.',
      confirmLabel: verified ? 'Quitar verificación' : 'Verificar usuario',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(verified ? this.adminApi.unverifyUser(userId) : this.adminApi.verifyUser(userId));
      this.feedback.success(verified ? 'Se quitó la verificación al usuario.' : 'El usuario fue verificado.', {
        title: verified ? 'Verificación quitada' : 'Usuario verificado',
      });
      await this.load();
    }, 'Falló la acción de verificación.');
  }

  private async run(id: string, task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      this.actingId.set(id);
      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Error en la acción de administración' });
    } finally {
      this.actingId.set(null);
    }
  }
}
