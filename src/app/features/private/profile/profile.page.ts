import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { PostDto } from '../../posts/posts.models';
import { PostStoreService } from '../../posts/post-store.service';
import { UserStoreService } from '../../users/user-store.service';
import { UsersApiService } from '../../users/users-api.service';
import { UserDto } from '../../users/users.models';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, StateCardComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  readonly id = input.required<string>();

  private readonly usersApi = inject(UsersApiService);
  private readonly userStore = inject(UserStoreService);
  private readonly postStore = inject(PostStoreService);

  readonly profile = signal<UserDto | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly resolvedUserId = computed(() => {
    const routeId = this.id();
    return routeId === 'me' ? this.userStore.currentUserId() ?? '' : routeId;
  });
  readonly posts = computed(() => this.postStore.posts().filter((post) => post.userId === this.resolvedUserId()));
  readonly displayHandle = computed(() => `@${this.profile()?.fullName?.replace(/\s+/g, '').toLowerCase() || this.resolvedUserId()}`);
  readonly publishedPostsCount = computed(() => this.posts().filter((post) => Boolean(post.isPublished)).length);
  readonly draftPostsCount = computed(() => this.posts().filter((post) => !post.isPublished).length);
  readonly statusLabel = computed(() => {
    const user = this.profile();

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
  readonly joinedLabel = computed(() => this.profile()?.createdAt ?? null);

  constructor() {
    effect(() => {
      const userId = this.resolvedUserId();

      if (!userId) {
        return;
      }

      void this.loadProfile(userId);
    });
  }

  protected trackPost(index: number, post: PostDto): string {
    return post.postId ?? post.createdAt ?? String(index);
  }

  protected async reload(): Promise<void> {
    const userId = this.resolvedUserId();

    if (userId) {
      await this.loadProfile(userId);
    }
  }

  private async loadProfile(userId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.profileError.set(null);
      this.profile.set(await firstValueFrom(this.usersApi.getUserById(userId)));

      if (!this.postStore.posts().length) {
        await this.postStore.loadPosts();
      }
    } catch (error) {
      this.profile.set(null);
      this.profileError.set(getErrorMessage(error, 'We could not load this profile.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected initials(user: UserDto | null): string {
    const source = (user?.fullName || this.resolvedUserId())
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    return source || '??';
  }

  protected postDateLabel(post: PostDto): string {
    return post.createdAt ?? '';
  }
}
