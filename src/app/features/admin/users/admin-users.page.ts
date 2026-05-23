import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminUserRecord } from '../admin.models';

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly users = signal<AdminUserRecord[]>([]);
  readonly loading = signal(false);
  readonly actingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly selected = signal<AdminUserRecord | null>(null);
  readonly roleForm = this.formBuilder.group({
    userId: ['', [Validators.required]],
    role: ['User', [Validators.required]],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      this.users.set(await firstValueFrom(this.adminApi.listUsers()));
    } catch (error) {
      this.error.set(getErrorMessage(error, 'We could not load admin users.'));
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
      this.feedback.success('The user role was updated.', { title: 'Role changed' });
      await this.load();
    }, 'Role update failed.');
  }

  protected async deleteUser(userId: string | undefined): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Delete this user?',
      message: 'This soft-deletes the account from the admin console and should only be used when the moderation decision is final.',
      confirmLabel: 'Delete user',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(this.adminApi.deleteAdminUser(userId));
      this.feedback.success('The user was deleted from the admin console.', { title: 'User deleted' });
      await this.load();
    }, 'User delete failed.');
  }

  protected async restoreUser(userId: string | undefined): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Restore this user?',
      message: 'This returns the account to an active moderation state in the admin console.',
      confirmLabel: 'Restore user',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(this.adminApi.restoreAdminUser(userId));
      this.feedback.success('The user account was restored.', { title: 'User restored' });
      await this.load();
    }, 'User restore failed.');
  }

  protected async verifyUser(userId: string | undefined, verified: boolean): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: verified ? 'Remove verification?' : 'Verify this user?',
      message: verified
        ? 'This removes the verification state from the account and should match your moderation policy.'
        : 'This marks the account as verified in the admin system.',
      confirmLabel: verified ? 'Remove verification' : 'Verify user',
    });

    if (!confirmed) {
      return;
    }

    await this.run(userId, async () => {
      await firstValueFrom(verified ? this.adminApi.unverifyUser(userId) : this.adminApi.verifyUser(userId));
      this.feedback.success(verified ? 'The user was unverified.' : 'The user was verified.', {
        title: verified ? 'Verification removed' : 'User verified',
      });
      await this.load();
    }, 'User verification action failed.');
  }

  private async run(id: string, task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      this.actingId.set(id);
      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Admin action failed' });
    } finally {
      this.actingId.set(null);
    }
  }
}
