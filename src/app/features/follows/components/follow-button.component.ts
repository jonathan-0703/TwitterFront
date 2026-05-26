import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FollowsApiService } from '../services/follows-api.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { SessionService } from '../../../core/auth/session.service';
import { getErrorMessage } from '../../../core/api/api.utils';


@Component({
  selector: 'app-follow-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    @if (!isOwnProfile()) {
      <button
        type="button"
        [class]="buttonClass()"
        [disabled]="loading()"
        (click)="toggleFollow()"
      >
        {{ buttonLabel() }}
      </button>
    }
  `,
  styles: [`
    button {
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: all 0.2s;
      border: 1px solid transparent;
      cursor: pointer;
    }

    .follow-btn {
      background: var(--accent-color, #1d9bf0);
      color: white;
      border-color: var(--accent-color, #1d9bf0);
    }

    .follow-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .following-btn {
      background: transparent;
      color: var(--text-primary);
      border-color: var(--border-color);
    }

    .following-btn:hover:not(:disabled) {
      background: rgba(244, 33, 46, 0.1);
      color: rgb(244, 33, 46);
      border-color: rgba(244, 33, 46, 0.4);
    }

    .following-btn:hover:not(:disabled)::after {
      content: 'Dejar de seguir';
      position: absolute;
      left: 0;
      right: 0;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class FollowButtonComponent {
  private readonly followsApi = inject(FollowsApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly sessionService = inject(SessionService);

  readonly userId = input.required<string>();
  readonly followChange = output<boolean>();

  readonly loading = signal(false);
  readonly isFollowing = signal(false);
  readonly isOwnProfile = computed(() => this.sessionService.userId() === this.userId());

  readonly buttonLabel = computed(() => (this.isFollowing() ? 'Siguiendo' : 'Seguir'));
  readonly buttonClass = computed(() => (this.isFollowing() ? 'following-btn' : 'follow-btn'));

  constructor() {
    // Load following status when userId changes
    effect(() => {
      const userId = this.userId();
      if (userId && !this.isOwnProfile()) {
        void this.loadFollowingStatus();
      }
    });
  }

  private async loadFollowingStatus(): Promise<void> {
    try {
      const response = await firstValueFrom(this.followsApi.isFollowing(this.userId()));
      this.isFollowing.set(response.isFollowing);
    } catch (error) {
      // Silently fail - button will show "Follow" by default
      console.error('Error loading following status:', error);
    }
  }

  async toggleFollow(): Promise<void> {
    if (this.loading() || this.isOwnProfile()) {
      return;
    }

    this.loading.set(true);

    try {
      if (this.isFollowing()) {
        await firstValueFrom(this.followsApi.unfollowUser(this.userId()));
        this.isFollowing.set(false);
        this.feedback.success('Dejaste de seguir a este usuario');
      } else {
        await firstValueFrom(this.followsApi.followUser(this.userId()));
        this.isFollowing.set(true);
        this.feedback.success('Ahora sigues a este usuario');
      }
      this.followChange.emit(this.isFollowing());
    } catch (error) {
      this.feedback.error(getErrorMessage(error, 'No se pudo completar la acción'));
    } finally {
      this.loading.set(false);
    }
  }
}
