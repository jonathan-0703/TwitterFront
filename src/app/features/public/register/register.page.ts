import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { UsersApiService } from '../../users/services/users-api.service';


@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
})
export class RegisterPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly feedback = inject(FeedbackService);

  readonly registerForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  protected async register(): Promise<void> {
    if (this.registerForm.invalid || this.loading()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);
      await firstValueFrom(this.usersApi.register(this.registerForm.getRawValue()));
      this.successMessage.set('Solicitud de registro enviada. Ahora puedes intentar iniciar sesión.');
      this.feedback.success('Cuenta creada. Ahora puedes iniciar sesión.', { title: 'Registro completado' });
      this.registerForm.reset({ fullName: '', email: '', password: '' });
    } catch (error) {
      const message = getErrorMessage(error, 'No pudimos crear el usuario todavía.');
      this.errorMessage.set(message);
      this.feedback.error(message, { title: 'Error al registrar' });
    } finally {
      this.loading.set(false);
    }
  }
}
