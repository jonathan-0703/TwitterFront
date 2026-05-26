import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { StateCardComponent } from '../../../../shared/components/state-card/state-card.component';
import { UserAvatarComponent } from '../../../users/components/user-avatar.component';
import { UserStoreService } from '../../../users/services/user-store.service';

@Component({
  selector: 'app-settings-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, StateCardComponent, UserAvatarComponent],
  templateUrl: './settings-profile.page.html',
  styleUrl: './settings-profile.page.scss',
})
export class SettingsProfilePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userStore = inject(UserStoreService);

  readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    biography: [''],
  });
  readonly successMessage = signal<string | null>(null);
  readonly avatarMessage = signal<string | null>(null);
  readonly pendingAvatarFile = signal<File | null>(null);
  readonly pendingAvatarPreviewUrl = signal<string | null>(null);
  readonly currentUser = this.userStore.currentUser;
  readonly loading = this.userStore.loading;
  readonly error = this.userStore.error;
  readonly rolesLabel = computed(() => this.currentUser()?.roles?.join(', ') || 'Usuario');
  readonly biographyPreview = computed(() => this.currentUser()?.biography?.trim() || 'Aún no se agregó una biografía.');
  readonly canSave = computed(() => !this.loading() && (!this.form.pristine || !!this.pendingAvatarFile()));
  readonly statusLabel = computed(() => {
    const user = this.currentUser();

    if (!user) {
      return 'Desconocido';
    }

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
        biography: user.biography ?? '',
      });
    });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    this.avatarMessage.set(null);
    const updatedProfile = await this.userStore.updateCurrentUser(this.form.getRawValue());

    if (!updatedProfile) {
      return;
    }

    const pendingAvatar = this.pendingAvatarFile();

    if (pendingAvatar) {
      const updatedAvatarUser = await this.userStore.uploadCurrentUserAvatar(pendingAvatar);

      if (!updatedAvatarUser) {
        this.successMessage.set('Perfil actualizado correctamente.');
        this.avatarMessage.set('Los cambios se guardaron, pero la subida de la foto falló.');
        return;
      }

      this.avatarMessage.set('Foto de perfil actualizada correctamente.');
    }

    this.successMessage.set('Perfil actualizado correctamente.');
    this.clearPendingAvatar();
  }

  protected stageAvatar(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.avatarMessage.set('Avatar listo. Guarda los cambios para subirlo.');
    this.setPendingAvatar(file);

    if (input) {
      input.value = '';
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
      biography: user.biography ?? '',
    });
    this.successMessage.set(null);
    this.avatarMessage.set(null);
    this.clearPendingAvatar();
  }

  protected removePendingAvatar(): void {
    this.clearPendingAvatar();
    this.avatarMessage.set(null);
  }

  private setPendingAvatar(file: File): void {
    this.clearPendingAvatar();
    this.pendingAvatarFile.set(file);
    this.pendingAvatarPreviewUrl.set(URL.createObjectURL(file));
  }

  private clearPendingAvatar(): void {
    const previewUrl = this.pendingAvatarPreviewUrl();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    this.pendingAvatarFile.set(null);
    this.pendingAvatarPreviewUrl.set(null);
  }
}
