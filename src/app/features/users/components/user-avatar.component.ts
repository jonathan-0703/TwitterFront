import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { UserAvatarRevisionService } from '../services/user-avatar-revision.service';
import { deriveUserInitials, resolveAvatarUrl } from '../utils/users-avatar.utils';
import { UserDto } from '../models/users.models';


/**
 * Renders a circular avatar image for a user. Resolution priority:
 *  1. `previewUrl` input (used by edit forms while a file is staged).
 *  2. `profilePhotoUrl` from the user (absolute or relative — relative
 *     paths are prefixed with the API base URL).
 *  3. The canonical anonymous endpoint `/api/user/{id}/avatar` when the
 *     user has an id but no `profilePhotoUrl`.
 *  4. Initials fallback when none of the above produce an image (or the
 *     image fetch errors out).
 *
 * The avatar endpoint is anonymous, so we use it directly in `<img src>`.
 * After a successful upload the revision counter is bumped to bust the
 * browser cache via a `?v=` query string.
 */
@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (effectiveImageUrl(); as src) {
      <img [src]="src" [alt]="altText()" (error)="onImageError()" />
    } @else {
      <span class="user-avatar-initials" aria-hidden="true">{{ initials() }}</span>
    }
  `,
  host: {
    class: 'user-avatar',
    '[class.has-image]': 'effectiveImageUrl() !== null',
  },
  styles: [
    `
      :host {
        display: inline-grid;
        place-items: center;
        overflow: hidden;
        border-radius: 999px;
        background: var(--brand-light, rgb(29 155 240 / 0.18));
        color: var(--brand-color, #1d9bf0);
        font-weight: 800;
        line-height: 1;
        contain: paint;
      }

      :host img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      :host .user-avatar-initials {
        font-size: clamp(0.75rem, 0.4em + 0.6rem, 2.4rem);
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class UserAvatarComponent {
  readonly user = input<UserDto | null | undefined>(null);
  readonly previewUrl = input<string | null>(null);

  private readonly revisions = inject(UserAvatarRevisionService);
  private readonly imageError = signal(false);

  readonly altText = computed(() => `${this.user()?.fullName || 'User'} profile photo`);
  readonly initials = computed(() => deriveUserInitials(this.user()));

  readonly effectiveImageUrl = computed(() => {
    const preview = this.previewUrl();
    if (preview) {
      return preview;
    }

    if (this.imageError()) {
      return null;
    }

    const baseUrl = resolveAvatarUrl(this.user());
    if (!baseUrl) {
      return null;
    }

    const userId = this.user()?.userId;
    if (!userId) {
      return baseUrl;
    }

    const revision = this.revisions.getRevision(userId)();
    if (revision <= 0) {
      return baseUrl;
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}v=${revision}`;
  });

  protected onImageError(): void {
    this.imageError.set(true);
  }
}
