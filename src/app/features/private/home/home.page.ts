import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { PostsApiService } from '../../posts/posts-api.service';
import { PostStoreService } from '../../posts/post-store.service';
import { PostDto } from '../../posts/posts.models';
import { environment } from '../../../../environments/environment';

export interface MediaAttachment {
  file?: File;
  mediaId?: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'unknown';
}

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, ReactiveFormsModule, StateCardComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly postStore = inject(PostStoreService);
  private readonly postsApi = inject(PostsApiService);
  private readonly confirm = inject(ConfirmService);

  readonly attachments = signal<MediaAttachment[]>([]);
  readonly uploadingFile = signal(false);
  readonly mediaTypes = signal<Record<string, 'image' | 'video' | 'audio' | 'unknown'>>({});

  readonly posts = this.postStore.posts;
  readonly loading = this.postStore.loading;
  readonly saving = this.postStore.saving;
  readonly error = this.postStore.error;
  readonly selectedPost = signal<PostDto | null>(null);
  readonly selectedPostError = signal<string | null>(null);
  readonly editingPostId = signal<string | null>(null);
  readonly likedPosts = signal<Record<string, boolean>>({});
  readonly retweetedPosts = signal<Record<string, boolean>>({});
  readonly openComments = signal<Record<string, boolean>>({});
  readonly postComments = signal<Record<string, Array<{ id: string; author: string; initials: string; text: string; time: string }>>>({});
  readonly viewsCounts = signal<Record<string, number>>({});
  readonly form = this.formBuilder.group({
    content: ['', [Validators.required, Validators.minLength(2)]],
    isPublished: [true],
  });
  readonly publishedCount = computed(() => this.posts().filter((post) => Boolean(post.isPublished)).length);
  readonly draftCount = computed(() => this.posts().filter((post) => !post.isPublished).length);
  readonly highlightedPost = computed(() => this.posts()[0] ?? null);

  constructor() {
    void this.postStore.loadPosts();

    effect(() => {
      const list = this.posts();
      list.forEach((post) => {
        post.mediaUrls?.forEach((url) => {
          const absUrl = this.getAbsoluteMediaUrl(url);
          if (this.mediaTypes()[absUrl]) {
            return;
          }

          const controller = new AbortController();
          fetch(absUrl, { method: 'GET', signal: controller.signal })
            .then((res) => {
              const contentType = res.headers.get('Content-Type') || '';
              let type: 'image' | 'audio' | 'video' | 'unknown' = 'image';
              if (contentType.toLowerCase().startsWith('video/')) {
                type = 'video';
              } else if (contentType.toLowerCase().startsWith('audio/')) {
                type = 'audio';
              } else if (contentType.toLowerCase().startsWith('image/')) {
                type = 'image';
              }
              this.mediaTypes.update((types) => ({ ...types, [absUrl]: type }));
              
              // Immediately abort the fetch to avoid downloading the body
              controller.abort();
            })
            .catch((err: unknown) => {
              const isAbort = err instanceof Error && err.name === 'AbortError';
              if (!isAbort) {
                this.mediaTypes.update((types) => ({ ...types, [absUrl]: 'image' }));
              }
            });
        });
      });
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.uploadingFile.set(true);
      const mediaIds: string[] = [];

      // 1. Upload any local files that haven't been uploaded yet
      for (const att of this.attachments()) {
        if (att.file) {
          const result = await this.postStore.uploadMedia(att.file);
          if (result && result.mediaId) {
            mediaIds.push(result.mediaId);
          }
        } else if (att.mediaId) {
          mediaIds.push(att.mediaId);
        }
      }

      // 2. Submit the post
      const raw = this.form.getRawValue();
      const editingPostId = this.editingPostId();

      const payload = {
        content: raw.content,
        mediaIds: mediaIds.length ? mediaIds : null,
        ...(editingPostId ? {} : { isPublished: raw.isPublished })
      };

      const response = editingPostId
        ? await this.postStore.updatePost(editingPostId, payload)
        : await this.postStore.createPost(payload);

      if (response) {
        this.resetForm();
      }
    } catch {
      // Store feedback handles this
    } finally {
      this.uploadingFile.set(false);
    }
  }

  protected startEdit(post: PostDto): void {
    this.editingPostId.set(post.postId ?? null);
    this.form.reset({
      content: post.content ?? '',
      isPublished: Boolean(post.isPublished),
    });

    const list: MediaAttachment[] = [];
    if (post.mediaUrls && post.mediaUrls.length) {
      post.mediaUrls.forEach((url) => {
        const mediaId = url.split('/').pop() || '';
        let type: 'image' | 'audio' | 'video' | 'unknown' = 'image';
        if (this.isPostAudioUrl(url)) {
          type = 'audio';
        } else if (this.isPostVideoUrl(url)) {
          type = 'video';
        }
        list.push({ mediaId, url, type });
      });
    }
    this.attachments.set(list);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected async inspect(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    try {
      this.selectedPostError.set(null);
      this.selectedPost.set(await firstValueFrom(this.postsApi.getPostById(postId)));
    } catch (error) {
      this.selectedPost.set(null);
      this.selectedPostError.set(getErrorMessage(error, 'We could not fetch the post details.'));
    }
  }

  protected async toggleStatus(post: PostDto): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: post.isPublished ? 'Move post back to draft?' : 'Publish this post now?',
      message: post.isPublished
        ? 'This removes the post from the live timeline until you publish it again.'
        : 'This makes the post visible in the live timeline right away.',
      confirmLabel: post.isPublished ? 'Move to draft' : 'Publish post',
    });

    if (!confirmed) {
      return;
    }

    await this.postStore.togglePublished(post);
  }

  protected async remove(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Delete this post?',
      message: 'Deleting a post removes it from your current feed and cannot be undone from this screen.',
      confirmLabel: 'Delete post',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.postStore.deletePost(postId);
  }

  protected trackPost(index: number, post: PostDto): string {
    return post.postId ?? post.createdAt ?? String(index);
  }

  protected async reloadFeed(): Promise<void> {
    await this.postStore.loadPosts();
  }

  protected authorName(post: PostDto): string {
    return post.userFullName || post.username || post.userId || 'Unknown author';
  }

  protected authorHandle(post: PostDto): string {
    if (post.username) {
      return `@${post.username.replace(/^@/, '')}`;
    }

    if (post.userFullName) {
      return `@${post.userFullName.replace(/\s+/g, '').toLowerCase()}`;
    }

    return '@unknown';
  }

  protected authorInitials(post: PostDto): string {
    const source = this.authorName(post)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    return source || '??';
  }

  protected isLiked(postId: string | undefined): boolean {
    return postId ? Boolean(this.likedPosts()[postId]) : false;
  }

  protected toggleLike(post: PostDto): void {
    const postId = post.postId;
    if (!postId) return;
    this.likedPosts.update((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  protected getLikesCount(post: PostDto): number {
    const postId = post.postId;
    if (!postId) return post.likesCount ?? 0;
    const isLiked = this.isLiked(postId);
    const base = post.likesCount ?? 0;
    return isLiked ? base + 1 : base;
  }

  protected isRetweeted(postId: string | undefined): boolean {
    return postId ? Boolean(this.retweetedPosts()[postId]) : false;
  }

  protected toggleRetweet(post: PostDto): void {
    const postId = post.postId;
    if (!postId) return;
    this.retweetedPosts.update((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  protected getRetweetsCount(post: PostDto): number {
    const postId = post.postId;
    if (!postId) return post.retweetsCount ?? 0;
    const isRetweeted = this.isRetweeted(postId);
    const base = post.retweetsCount ?? 0;
    return isRetweeted ? base + 1 : base;
  }

  protected isCommentsOpen(postId: string | undefined): boolean {
    return postId ? Boolean(this.openComments()[postId]) : false;
  }

  protected toggleComments(postId: string | undefined): void {
    if (!postId) return;
    this.openComments.update((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  protected getRepliesCount(post: PostDto): number {
    const postId = post.postId;
    if (!postId) return post.repliesCount ?? 0;
    const localCount = this.postComments()[postId]?.length ?? 0;
    return (post.repliesCount ?? 0) + localCount;
  }

  protected getComments(postId: string | undefined): Array<{ id: string; author: string; initials: string; text: string; time: string }> {
    if (!postId) return [];
    return this.postComments()[postId] || [];
  }

  protected addComment(postId: string | undefined, text: string): void {
    console.log('addComment called for postId:', postId, 'with text:', text);
    if (!postId || !text.trim()) {
      console.log('addComment ignored because postId or text is invalid');
      return;
    }
    const newComment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      author: 'You',
      initials: 'YO',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.postComments.update((prev) => ({
      ...prev,
      [postId]: [newComment, ...(prev[postId] || [])]
    }));
    console.log('addComment finished successfully. Current comments for post:', this.postComments()[postId]);
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

  protected triggerFileInput(acceptType: string): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptType;
    input.onchange = (e) => void this.onFileSelected(e);
    input.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    let detectedType: 'image' | 'audio' | 'video' | 'unknown' = 'unknown';
    if (file.type.startsWith('image/')) {
      detectedType = 'image';
    } else if (file.type.startsWith('audio/')) {
      detectedType = 'audio';
    } else if (file.type.startsWith('video/')) {
      detectedType = 'video';
    }

    const objectUrl = URL.createObjectURL(file);
    this.attachments.update((list) => [
      ...list,
      { file, url: objectUrl, type: detectedType }
    ]);
  }

  protected removeAttachment(index: number): void {
    const att = this.attachments()[index];
    if (att && att.file) {
      URL.revokeObjectURL(att.url);
    }
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  protected isPostImageUrl(url: string): boolean {
    return !this.isPostAudioUrl(url) && !this.isPostVideoUrl(url);
  }

  protected isPostAudioUrl(url: string): boolean {
    return /\.(mp3|wav|ogg|aac|m4a)/i.test(url) || url.toLowerCase().includes('type=audio') || url.toLowerCase().includes('.mp3') || url.toLowerCase().includes('.wav');
  }

  protected isPostVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogv|mov|avi)/i.test(url) || url.toLowerCase().includes('type=video') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.webm');
  }

  protected getMediaType(url: string): 'image' | 'video' | 'audio' | 'unknown' {
    const absUrl = this.getAbsoluteMediaUrl(url);
    return this.mediaTypes()[absUrl] || 'image';
  }

  protected getAbsoluteMediaUrl(url: string): string {
    if (!url) {
      return '';
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${environment.apiBaseUrl}${path}`;
  }

  private resetForm(): void {
    this.editingPostId.set(null);
    this.form.reset({ content: '', isPublished: true });
    this.attachments().forEach((att) => {
      if (att.file) {
        URL.revokeObjectURL(att.url);
      }
    });
    this.attachments.set([]);
  }
}
