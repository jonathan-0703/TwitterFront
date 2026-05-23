import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { UsersApiService } from '../../users/users-api.service';

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, ReactiveFormsModule, RouterLink],
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

  readonly testEmailForm = this.formBuilder.group({
    to: ['', [Validators.required, Validators.email]],
    subject: ['Angular smoke test', [Validators.required]],
    body: ['This email was triggered from the Angular frontend integration page.', [Validators.required]],
  });

  readonly loading = signal(false);
  readonly testEmailLoading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly testEmailResult = signal<unknown>(null);
  readonly testEmailError = signal<string | null>(null);

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
      this.successMessage.set('Registration request sent. You can now try signing in.');
      this.feedback.success('Account created. You can now sign in.', { title: 'Registration complete' });
      this.registerForm.reset({ fullName: '', email: '', password: '' });
    } catch (error) {
      const message = getErrorMessage(error, 'We could not create the user yet.');
      this.errorMessage.set(message);
      this.feedback.error(message, { title: 'Registration failed' });
    } finally {
      this.loading.set(false);
    }
  }

  protected async sendTestEmail(): Promise<void> {
    if (this.testEmailForm.invalid || this.testEmailLoading()) {
      this.testEmailForm.markAllAsTouched();
      return;
    }

    try {
      this.testEmailLoading.set(true);
      this.testEmailError.set(null);
      this.testEmailResult.set(await firstValueFrom(this.usersApi.sendTestEmail(this.testEmailForm.getRawValue())));
    } catch (error) {
      this.testEmailError.set(getErrorMessage(error, 'The test email endpoint did not accept this payload.'));
    } finally {
      this.testEmailLoading.set(false);
    }
  }
}
