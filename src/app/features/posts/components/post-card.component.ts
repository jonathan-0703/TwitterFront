import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MediaUrlPipe } from '../../../core/ui/media-url.pipe';
import { PostActionsComponent } from '../../private/home/components/post-actions/post-actions.component';
import { PostMediaCarouselComponent } from '../../private/home/components/post-media-carousel/post-media-carousel.component';
import { UserAvatarComponent } from '../../users/components/user-avatar.component';
import { PostStoreService } from '../services/post-store.service';
import { PostsApiService } from '../services/posts-api.service';
import { PostDto } from '../models/posts.models';
import { UserDto } from '../../users/models/users.models';


@Component({
  selector: 'app-post-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    DatePipe,
    MediaUrlPipe,
    PostActionsComponent,
    PostMediaCarouselComponent,
    UserAvatarComponent,
  ],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent {
  private readonly postStore = inject(PostStoreService);
  private readonly postsApi = inject(PostsApiService);

  readonly post = input.required<PostDto>();
  readonly currentUserId = input<string | null | undefined>();
  readonly carouselIndex = input(0);
  readonly isCommentsOpen = input(false);
  readonly isRetweeted = input(false);
  readonly isLiked = input(false);
  readonly retweetMenuOpen = input(false);
  readonly activePostMenu = input<string | null>(null);
  readonly soundEnabled = input(false);
  readonly showFooter = input(true);

  readonly postClick = output<void>();
  readonly editRequested = output<void>();
  readonly deleteRequested = output<void>();
  readonly statusToggleRequested = output<void>();
  readonly menuToggleRequested = output<MouseEvent>();
  readonly commentToggleRequested = output<void>();
  readonly likeToggleRequested = output<void>();
  readonly retweetMenuToggleRequested = output<MouseEvent>();
  readonly directRetweetRequested = output<void>();
  readonly quoteRequested = output<void>();
  readonly carouselPreviousRequested = output<void>();
  readonly carouselNextRequested = output<void>();
  readonly commentAdded = output<string>();
  readonly replyClick = output<PostDto>();
  readonly parentAuthorClick = output<string | undefined>();
  readonly quoteCardClick = output<PostDto>();
  readonly soundEnabledChange = output<boolean>();

  private readonly originalPostsCache = signal<Record<string, PostDto>>({});

  protected interactionTarget = computed<PostDto>(() => {
    const post = this.post();
    if (post.retweetOfPostId && !post.content) {
      return this.getOriginalPost(post.retweetOfPostId) ?? post;
    }
    return post;
  });

  protected isOwnPost(): boolean {
    const currentUserId = this.currentUserId();
    const postUserId = this.post().userId;
    return Boolean(currentUserId && postUserId && currentUserId === postUserId);
  }

  protected authorName(post: PostDto): string {
    return post.userFullName || post.username || post.userId || 'Autor desconocido';
  }

  protected authorHandle(post: PostDto): string {
    if (post.username) {
      return `@${post.username.replace(/^@/, '')}`;
    }
    if (post.userFullName) {
      return `@${post.userFullName.replace(/\s+/g, '').toLowerCase()}`;
    }
    return '@desconocido';
  }

  private readonly postAuthorCache = new WeakMap<PostDto, UserDto>();

  protected postAuthor(post: PostDto): UserDto {
    const cached = this.postAuthorCache.get(post);
    if (cached) {
      return cached;
    }
    const author: UserDto = {
      userId: post.userId,
      fullName: post.userFullName ?? post.username ?? undefined,
      email: post.username ?? undefined,
      profilePhotoUrl: post.userAvatar ?? null,
    };
    this.postAuthorCache.set(post, author);
    return author;
  }

  protected getOriginalPost(retweetOfPostId: string | null | undefined): PostDto | null {
    if (!retweetOfPostId) return null;

    const found = this.postStore.posts().find((p) => p.postId === retweetOfPostId);
    if (found) return found;

    const cached = this.originalPostsCache()[retweetOfPostId];
    if (cached) return cached;

    if (!(retweetOfPostId in this.originalPostsCache())) {
      this.originalPostsCache.update((cache) => ({
        ...cache,
        [retweetOfPostId]: {
          postId: retweetOfPostId,
          userFullName: 'Autor original',
          username: 'original',
          content: 'Cargando detalles de la publicación compartida...',
          createdAt: new Date().toISOString(),
          isPublished: true,
          likesCount: 0,
          retweetsCount: 0,
          repliesCount: 0,
        } as PostDto,
      }));

      firstValueFrom(this.postsApi.getPostById(retweetOfPostId))
        .then((original) => {
          if (original) {
            this.originalPostsCache.update((cache) => ({ ...cache, [retweetOfPostId]: original }));
          }
        })
        .catch(() => {
          this.originalPostsCache.update((cache) => ({
            ...cache,
            [retweetOfPostId]: {
              postId: retweetOfPostId,
              userFullName: 'No disponible',
              username: 'no-disponible',
              content: 'Esta publicación compartida no se pudo cargar (puede ser privada o estar eliminada).',
              createdAt: new Date().toISOString(),
              isPublished: true,
              likesCount: 0,
              retweetsCount: 0,
              repliesCount: 0,
            } as PostDto,
          }));
        });
    }

    return this.originalPostsCache()[retweetOfPostId] ?? null;
  }

  protected getParentAuthorHandle(repliedToPostId: string | null | undefined): string {
    if (!repliedToPostId) return '@autor';
    const parent = this.getOriginalPost(repliedToPostId);
    return parent ? this.authorHandle(parent) : '@autor';
  }

  protected getRepliesCount(post: PostDto): number {
    return post.repliesCount ?? 0;
  }

  protected getRetweetsCount(post: PostDto): number {
    return post.retweetsCount ?? 0;
  }

  protected getLikesCount(post: PostDto): number {
    return post.likesCount ?? 0;
  }

  protected getViewCount(post: PostDto): number {
    const key = post.postId || post.createdAt || 'default';
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 480) + 15;
  }

  protected getPostReplies(postId: string | undefined): PostDto[] {
    if (!postId) return [];
    return this.postStore.posts().filter((p) => p.repliedToPostId === postId && Boolean(p.isPublished));
  }

  protected onPostClick(): void {
    this.postClick.emit();
  }

  protected onMenuToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.menuToggleRequested.emit(event);
  }

  protected onParentAuthorClick(): void {
    this.parentAuthorClick.emit(this.post().repliedToPostId ?? undefined);
  }

  protected onQuoteCardClick(origPost: PostDto, event: MouseEvent): void {
    event.stopPropagation();
    this.quoteCardClick.emit(origPost);
  }

  protected onReplyClick(reply: PostDto, event: MouseEvent): void {
    event.stopPropagation();
    this.replyClick.emit(reply);
  }

  protected onAddComment(text: string, inputRef: HTMLInputElement): void {
    const trimmed = text.trim();
    if (trimmed) {
      this.commentAdded.emit(trimmed);
      inputRef.value = '';
    }
  }
}
