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

  readonly posts = this.postsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly myPosts = computed(() => this.postsState().filter((post) => post.userId === this.sessionService.userId()));

  async loadPosts(): Promise<void> {
    try {
      this.loadingState.set(true);
      this.errorState.set(null);
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
}
