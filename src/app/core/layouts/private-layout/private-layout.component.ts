import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionService } from '../../auth/session.service';
import { adminRoles } from '../../auth/session.model';
import { FeedbackService } from '../../ui/feedback.service';
import { ThemeService } from '../../ui/theme.service';

@Component({
  selector: 'app-private-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './private-layout.component.html',
  styleUrl: './private-layout.component.scss',
})
export class PrivateLayoutComponent {
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);

  protected readonly trends = ['Angular 21', 'Signals', 'Render', 'Frontend Architecture'];
  protected readonly profileLink = computed(() => ['/profile', this.sessionService.userId() ?? 'me']);
  protected readonly isAdmin = computed(() => {
    const role = this.sessionService.role();
    return role !== null && adminRoles.includes(role as (typeof adminRoles)[number]);
  });
  protected readonly currentRole = this.sessionService.role;

  protected async logout(): Promise<void> {
    this.sessionService.clearSession();
    this.feedback.info('Your session was closed. See you soon.', { title: 'Logged out' });
    await this.router.navigate(['/login']);
  }
}
