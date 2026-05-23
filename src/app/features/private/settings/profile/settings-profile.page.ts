import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { StateCardComponent } from '../../../../shared/components/state-card/state-card.component';
import { UserStoreService } from '../../../users/user-store.service';

@Component({
  selector: 'app-settings-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './settings-profile.page.html',
  styleUrl: './settings-profile.page.scss',
})
export class SettingsProfilePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userStore = inject(UserStoreService);

  readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    isActive: [true],
  });
  readonly successMessage = signal<string | null>(null);
  readonly currentUser = this.userStore.currentUser;
  readonly loading = this.userStore.loading;
  readonly error = this.userStore.error;
  readonly rolesLabel = computed(() => this.currentUser()?.roles?.join(', ') || 'User');
  readonly statusLabel = computed(() => {
    const user = this.currentUser();

    if (!user) {
      return 'Unknown';
    }

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
  });

  constructor() {
    void this.userStore.loadCurrentUser();

    effect(() => {
      const user = this.currentUser();

      if (!user) {
        return;
      }

      this.form.reset({
        fullName: user.fullName ?? '',
        email: user.email ?? '',
        isActive: user.isActive ?? true,
      });
    });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    const updated = await this.userStore.updateCurrentUser(this.form.getRawValue());

    if (updated) {
      this.successMessage.set('Profile updated successfully.');
    }
  }

  protected async reload(): Promise<void> {
    this.successMessage.set(null);
    await this.userStore.loadCurrentUser(true);
  }

  protected resetToCurrentValues(): void {
    const user = this.currentUser();

    if (!user) {
      return;
    }

    this.form.reset({
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      isActive: user.isActive ?? true,
    });
    this.successMessage.set(null);
  }
}
