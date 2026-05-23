import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { AuthApiService } from '../../../core/auth/auth-api.service';
import { SessionService } from '../../../core/auth/session.service';
import { FeedbackService } from '../../../core/ui/feedback.service';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authApiService = inject(AuthApiService);
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly returnUrl = input('/home');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(this.authApiService.login(this.form.getRawValue()));
      this.assertValidAuthResponse(response);
      this.sessionService.startSession(response);
      this.feedback.success('Welcome back. Your session is ready.', { title: 'Signed in' });
      const navigated = await this.router.navigateByUrl(this.resolveReturnUrl(this.returnUrl()));

      if (!navigated) {
        throw new Error('The session was created, but the app could not complete the redirect. Reload the page or open /home.');
      }
    } catch (error) {
      const message = getErrorMessage(error, 'We could not sign you in with those credentials.');
      this.errorMessage.set(message);
      this.feedback.error(message, { title: 'Sign-in failed' });
    } finally {
      this.submitting.set(false);
    }
  }

  protected showControlError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];

    return control.invalid && (control.dirty || control.touched);
  }

  private resolveReturnUrl(returnUrl: string | null | undefined): string {
    if (typeof returnUrl !== 'string' || !returnUrl.trim()) {
      return '/home';
    }

    return returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/login')
      ? returnUrl
      : '/home';
  }

  private assertValidAuthResponse(response: unknown): asserts response is { token: string; refreshToken: string } {
    if (!response || typeof response !== 'object') {
      throw new Error('The login response is empty.');
    }

    const authResponse = response as { token?: unknown; refreshToken?: unknown };

    if (typeof authResponse.token !== 'string' || !authResponse.token.trim()) {
      throw new Error('The login response did not include a valid access token.');
    }

    if (typeof authResponse.refreshToken !== 'string' || !authResponse.refreshToken.trim()) {
      throw new Error('The login response did not include a valid refresh token.');
    }
  }
}
