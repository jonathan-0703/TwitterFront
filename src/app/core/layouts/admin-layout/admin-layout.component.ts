import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionService } from '../../auth/session.service';
import { AccentPickerComponent } from '../../ui/accent-picker.component';
import { FeedbackService } from '../../ui/feedback.service';
import { ThemeToggleComponent } from '../../ui/theme-toggle.component';
import { UserStoreService } from '../../../features/users/services/user-store.service';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ThemeToggleComponent,
    AccentPickerComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly sessionService = inject(SessionService);
  private readonly userStore = inject(UserStoreService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly currentUser = computed(() => this.userStore.currentUser());
  readonly accountName = computed(() => this.currentUser()?.fullName || this.currentUser()?.email || 'Administrador');
  readonly accountMeta = computed(() => {
    const user = this.currentUser();
    return user?.email ?? '';
  });

  protected async logout(): Promise<void> {
    this.userStore.clearCurrentUser();
    this.sessionService.clearSession();
    this.feedback.info('Sesión de administración cerrada.', { title: 'Sesión cerrada' });
    await this.router.navigate(['/login']);
  }
}
