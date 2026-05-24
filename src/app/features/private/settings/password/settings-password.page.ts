import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../../core/api/api.utils';
import { FeedbackService } from '../../../../core/ui/feedback.service';
import { UsersApiService } from '../../../users/users-api.service';

@Component({
  selector: 'app-settings-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './settings-password.page.html',
  styleUrl: './settings-password.page.scss',
})
export class SettingsPasswordPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly feedback = inject(FeedbackService);

  readonly form = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: matchPasswordsValidator });
  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  protected async save(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();

    try {
      this.loading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);
      await firstValueFrom(this.usersApi.changePassword({ currentPassword, newPassword }));
      this.successMessage.set('Contraseña cambiada correctamente.');
      this.feedback.success('Tu contraseña se cambió correctamente.', { title: 'Contraseña actualizada' });
      this.form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const message = getErrorMessage(error, 'El endpoint de cambio de contraseña rechazó la solicitud.');
      this.errorMessage.set(message);
      this.feedback.error(message, { title: 'Error al cambiar la contraseña' });
    } finally {
      this.loading.set(false);
    }
  }

  protected passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch')
      && (this.form.controls.newPassword.touched || this.form.controls.confirmPassword.touched);
  }

  protected passwordLengthMet(): boolean {
    return this.form.controls.newPassword.value.length >= 6;
  }

  protected resetForm(): void {
    this.form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}

function matchPasswordsValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value as string | undefined;
  const confirmPassword = control.get('confirmPassword')?.value as string | undefined;

  if (!newPassword || !confirmPassword) {
    return null;
  }

  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}
