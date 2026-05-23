import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../core/api/api.utils';
import { SessionService } from '../../core/auth/session.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { PostsApiService } from './posts-api.service';
import { PostDto, SavePostRequest } from './posts.models';

@Injectable({ providedIn: 'root' })
export class PostStoreService {
  private readonly postsApi = inject(PostsApiService);
  private readonly sessionService = inject(SessionService);
  private readonly feedback = inject(FeedbackService);

  private readonly postsState = signal<PostDto[]>([]);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly likedPostsState = signal<Record<string, boolean>>({});
  private readonly retweetedPostsState = signal<Record<string, boolean>>({});

  readonly posts = this.postsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly likedPosts = this.likedPostsState.asReadonly();
  readonly retweetedPosts = this.retweetedPostsState.asReadonly();
  readonly myPosts = computed(() => this.postsState().filter((post) => post.userId === this.sessionService.userId()));

  async loadPosts(): Promise<void> {
    try {
      this.loadingState.set(true);
      this.errorState.set(null);
      this.loadPersistedInteractions();
      this.postsState.set(await firstValueFrom(this.postsApi.listPosts()));
    } catch (error) {
      this.errorState.set(getErrorMessage(error, 'We could not load the feed yet.'));
    } finally {
      this.loadingState.set(false);
    }
  }

  async createPost(payload: SavePostRequest): Promise<PostDto | null> {
    return this.save(async () => {
      const userId = this.sessionService.userId();
      if (!userId) {
        throw new Error('User session not found. Please sign in again.');
      }
      const post = await firstValueFrom(this.postsApi.createPost({ ...payload, userId }));
      this.postsState.update((posts) => [post, ...posts]);
      this.feedback.success('Your post is live in the feed.', { title: 'Post created' });
      return post;
    }, 'We could not create the post.');
  }

  async updatePost(id: string, payload: SavePostRequest): Promise<PostDto | null> {
    return this.save(async () => {
      const userId = this.sessionService.userId();
      const post = await firstValueFrom(this.postsApi.updatePost(id, { ...payload, userId: userId ?? undefined }));
      this.patchPost(post);
      this.feedback.success('The post was updated successfully.', { title: 'Post updated' });
      return post;
    }, 'We could not update the post.');
  }

  async uploadMedia(file: File): Promise<{ mediaId: string; url: string } | null> {
    try {
      this.savingState.set(true);
      this.errorState.set(null);
      const result = await firstValueFrom(this.postsApi.uploadMedia(file));
      this.feedback.success('Attachment uploaded successfully.', { title: 'Media uploaded' });
      return result;
    } catch (error) {
      const message = getErrorMessage(error, 'Attachment upload failed.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Upload failed' });
      return null;
    } finally {
      this.savingState.set(false);
    }
  }

  async togglePublished(post: PostDto): Promise<PostDto | null> {
    const postId = post.postId;

    if (!postId) {
      this.errorState.set('The selected post has no identifier.');
      this.feedback.error('The selected post has no identifier.', { title: 'Status change failed' });
      return null;
    }

    return this.save(async () => {
      const updated = await firstValueFrom(
        this.postsApi.changeStatus(postId, { isPublished: !Boolean(post.isPublished) }),
      );
      this.patchPost(updated);
      this.feedback.info(updated.isPublished ? 'The post is now published.' : 'The post was moved back to drafts.', {
        title: updated.isPublished ? 'Post published' : 'Saved as draft',
      });
      return updated;
    }, 'We could not change the publish status.');
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      this.savingState.set(true);
      this.errorState.set(null);
      await firstValueFrom(this.postsApi.deletePost(id));
      this.postsState.update((posts) => posts.filter((post) => post.postId !== id));
      this.feedback.success('The post was removed from the feed.', { title: 'Post deleted' });
      return true;
    } catch (error) {
      const message = getErrorMessage(error, 'We could not delete the post.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Delete failed' });
      return false;
    } finally {
      this.savingState.set(false);
    }
  }

  async toggleLike(post: PostDto): Promise<void> {
    const postId = post.postId;
    if (!postId) return;

    const wasLiked = Boolean(this.likedPostsState()[postId]);
    const originalLikesCount = post.likesCount ?? 0;

    // Optimistically update
    this.likedPostsState.update(prev => ({ ...prev, [postId]: !wasLiked }));
    this.persistInteractions();
    
    this.postsState.update(posts =>
      posts.map(p => {
        if (p.postId === postId) {
          const nextCount = wasLiked ? Math.max(0, originalLikesCount - 1) : originalLikesCount + 1;
          return { ...p, likesCount: nextCount };
        }
        return p;
      })
    );

    try {
      const updated = await firstValueFrom(this.postsApi.toggleLike(postId));
      if (updated && updated.postId) {
        this.patchPost(updated);
      }
    } catch (error) {
      // Revert on failure
      this.likedPostsState.update(prev => ({ ...prev, [postId]: wasLiked }));
      this.persistInteractions();
      
      this.postsState.update(posts =>
        posts.map(p => {
          if (p.postId === postId) {
            return { ...p, likesCount: originalLikesCount };
          }
          return p;
        })
      );
      this.feedback.error(getErrorMessage(error, 'We could not alternate the like state.'), { title: 'Like failed' });
    }
  }

  async addComment(postId: string, content: string): Promise<PostDto | null> {
    return this.save(async () => {
      const response = await firstValueFrom(this.postsApi.createComment(postId, { content }));
      if (response) {
        this.postsState.update(posts => [response, ...posts]);
        
        // Increment the parent replies count locally
        this.postsState.update(posts =>
          posts.map(p => {
            if (p.postId === postId) {
              return { ...p, repliesCount: (p.repliesCount ?? 0) + 1 };
            }
            return p;
          })
        );
        this.feedback.success('Your comment reply has been posted.', { title: 'Comment created' });
      }
      return response;
    }, 'We could not submit the comment.');
  }

  async retweet(postId: string, content: string | null): Promise<PostDto | null> {
    return this.save(async () => {
      const response = await firstValueFrom(this.postsApi.createRetweet(postId, { content }));
      if (response) {
        this.postsState.update(posts => [response, ...posts]);
        this.retweetedPostsState.update(prev => ({ ...prev, [postId]: true }));
        this.persistInteractions();

        // Increment original post retweets count locally
        this.postsState.update(posts =>
          posts.map(p => {
            if (p.postId === postId) {
              return { ...p, retweetsCount: (p.retweetsCount ?? 0) + 1 };
            }
            return p;
          })
        );

        this.feedback.success(
          content ? 'Quote tweet posted successfully.' : 'Post shared successfully.',
          { title: content ? 'Quote shared' : 'Retweeted' }
        );
      }
      return response;
    }, 'We could not retweet the publication.');
  }

  private patchPost(post: PostDto): void {
    this.postsState.update((posts) => {
      const next = posts.map((item) => (item.postId === post.postId ? post : item));
      return next.some((item) => item.postId === post.postId) ? next : [post, ...next];
    });
  }

  private async save<T>(task: () => Promise<T>, fallbackMessage: string): Promise<T | null> {
    try {
      this.savingState.set(true);
      this.errorState.set(null);
      return await task();
    } catch (error) {
      const message = getErrorMessage(error, fallbackMessage);
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Request failed' });
      return null;
    } finally {
      this.savingState.set(false);
    }
  }

  private loadPersistedInteractions(): void {
    const userId = this.sessionService.userId();
    if (!userId) return;

    try {
      const liked = localStorage.getItem(`liked_posts_${userId}`);
      if (liked) {
        this.likedPostsState.set(JSON.parse(liked));
      }
      const retweeted = localStorage.getItem(`retweeted_posts_${userId}`);
      if (retweeted) {
        this.retweetedPostsState.set(JSON.parse(retweeted));
      }
    } catch {
      // Storage unavailable fallback
    }
  }

  private persistInteractions(): void {
    const userId = this.sessionService.userId();
    if (!userId) return;

    try {
      localStorage.setItem(`liked_posts_${userId}`, JSON.stringify(this.likedPostsState()));
      localStorage.setItem(`retweeted_posts_${userId}`, JSON.stringify(this.retweetedPostsState()));
    } catch {
      // Storage unavailable fallback
    }
  }
}
