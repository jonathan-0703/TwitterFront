import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { PostsApiService } from './posts-api.service';
import { PostDto, SavePostRequest } from '../models/posts.models';

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
  private readonly retweetIdsState = signal<Record<string, string>>({});

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
      this.errorState.set(getErrorMessage(error, 'No pudimos cargar el feed todavía.'));
    } finally {
      this.loadingState.set(false);
    }
  }

  async createPost(payload: SavePostRequest): Promise<PostDto | null> {
    return this.save(async () => {
      const userId = this.sessionService.userId();
      if (!userId) {
        throw new Error('No se encontró la sesión del usuario. Inicia sesión nuevamente.');
      }
      const post = await firstValueFrom(this.postsApi.createPost({ ...payload, userId }));
      this.postsState.update((posts) => [post, ...posts]);
      this.feedback.success('Tu publicación está visible en el feed.', { title: 'Publicación creada' });
      return post;
    }, 'No pudimos crear la publicación.');
  }

  async updatePost(id: string, payload: SavePostRequest): Promise<PostDto | null> {
    return this.save(async () => {
      const userId = this.sessionService.userId();
      const post = await firstValueFrom(this.postsApi.updatePost(id, { ...payload, userId: userId ?? undefined }));
      this.patchPost(post);
      this.feedback.success('La publicación se actualizó correctamente.', { title: 'Publicación actualizada' });
      return post;
    }, 'No pudimos actualizar la publicación.');
  }

  async uploadMedia(file: File): Promise<{ mediaId: string; url: string } | null> {
    try {
      this.savingState.set(true);
      this.errorState.set(null);
      const result = await firstValueFrom(this.postsApi.uploadMedia(file));
      this.feedback.success('Archivo adjunto subido correctamente.', { title: 'Archivo subido' });
      return result;
    } catch (error) {
      const message = getErrorMessage(error, 'La subida del archivo adjunto falló.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Error al subir' });
      return null;
    } finally {
      this.savingState.set(false);
    }
  }

  async togglePublished(post: PostDto): Promise<PostDto | null> {
    const postId = post.postId;

    if (!postId) {
      this.errorState.set('La publicación seleccionada no tiene identificador.');
      this.feedback.error('La publicación seleccionada no tiene identificador.', { title: 'Error al cambiar estado' });
      return null;
    }

    return this.save(async () => {
      const response = await firstValueFrom(
        this.postsApi.changeStatus(postId, { isPublished: !Boolean(post.isPublished) }),
      );
      // Backend may return null/empty — fall back to optimistic merge
      const updated: PostDto = response ?? { ...post, isPublished: !Boolean(post.isPublished) };
      this.patchPost(updated);
      this.feedback.info(updated.isPublished ? 'La publicación ahora está publicada.' : 'La publicación volvió a borradores.', {
        title: updated.isPublished ? 'Publicada' : 'Guardada como borrador',
      });
      return updated;
    }, 'No pudimos cambiar el estado de publicación.');
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      this.savingState.set(true);
      this.errorState.set(null);
      await firstValueFrom(this.postsApi.deletePost(id));
      this.postsState.update((posts) => posts.filter((post) => post.postId !== id));
      this.feedback.success('La publicación se quitó del feed.', { title: 'Publicación eliminada' });
      return true;
    } catch (error) {
      const message = getErrorMessage(error, 'No pudimos eliminar la publicación.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Error al eliminar' });
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
      this.feedback.error(getErrorMessage(error, 'No pudimos alternar el estado de "me gusta".'), { title: 'Error al dar me gusta' });
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
        this.feedback.success('Tu respuesta se publicó.', { title: 'Comentario creado' });
      }
      return response;
    }, 'No pudimos enviar el comentario.');
  }

  async retweet(postId: string, content: string | null): Promise<PostDto | null> {
    return this.save(async () => {
      const response = await firstValueFrom(this.postsApi.createRetweet(postId, { content: content ?? undefined }));
      if (response) {
        this.postsState.update(posts => [response, ...posts]);
        this.retweetedPostsState.update(prev => ({ ...prev, [postId]: true }));
        if (response.postId) {
          this.retweetIdsState.update(prev => ({ ...prev, [postId]: response.postId! }));
        }
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
          content ? 'Cita publicada correctamente.' : 'Publicación compartida correctamente.',
          { title: content ? 'Cita compartida' : 'Compartida' }
        );
      }
      return response;
    }, 'No pudimos compartir la publicación.');
  }

  async unretweet(postId: string): Promise<boolean> {
    const retweetId = this.retweetIdsState()[postId];
    if (!retweetId) {
      // Fallback: try to find the retweet in current posts
      const userId = this.sessionService.userId();
      const found = this.postsState().find(p =>
        p.retweetOfPostId === postId && p.userId === userId && !p.content
      );
      if (!found?.postId) {
        this.feedback.error('No se encontró la publicación compartida para eliminar.', { title: 'Error' });
        return false;
      }
    }

    const idToDelete = retweetId || this.postsState().find(p =>
      p.retweetOfPostId === postId && p.userId === this.sessionService.userId() && !p.content
    )?.postId;

    if (!idToDelete) return false;

    try {
      this.savingState.set(true);
      this.errorState.set(null);
      await firstValueFrom(this.postsApi.deletePost(idToDelete));

      this.postsState.update(posts => posts.filter(p => p.postId !== idToDelete));
      this.retweetedPostsState.update(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      this.retweetIdsState.update(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      this.persistInteractions();

      // Decrement original post retweets count locally
      this.postsState.update(posts =>
        posts.map(p => {
          if (p.postId === postId) {
            return { ...p, retweetsCount: Math.max(0, (p.retweetsCount ?? 0) - 1) };
          }
          return p;
        })
      );

      this.feedback.success('Se quitó la publicación compartida.', { title: 'Compartida eliminada' });
      return true;
    } catch (error) {
      const message = getErrorMessage(error, 'No pudimos quitar la publicación compartida.');
      this.errorState.set(message);
      this.feedback.error(message, { title: 'Error al quitar' });
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
      this.feedback.error(message, { title: 'Solicitud fallida' });
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
      const retweetIds = localStorage.getItem(`retweet_ids_${userId}`);
      if (retweetIds) {
        this.retweetIdsState.set(JSON.parse(retweetIds));
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
      localStorage.setItem(`retweet_ids_${userId}`, JSON.stringify(this.retweetIdsState()));
    } catch {
      // Storage unavailable fallback
    }
  }
}
