import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AudioPlayerComponent } from '../../posts/components/audio-player.component';
import { AudioRecorderModalComponent } from '../../posts/components/audio-recorder-modal.component';

import { PostStoreService } from '../../posts/services/post-store.service';

import { UserAvatarComponent } from '../../users/components/user-avatar.component';

import { HomeComposerComponent } from './components/home-composer/home-composer.component';
import { PostActionsComponent } from './components/post-actions/post-actions.component';
import { PostMediaCarouselComponent } from './components/post-media-carousel/post-media-carousel.component';
import { PostCardComponent } from '../../posts/components/post-card.component';
import { PostsApiService } from '../../posts/services/posts-api.service';
import { PostDto } from '../../posts/models/posts.models';
import { UserDto } from '../../users/models/users.models';

export interface MediaAttachment {
  file?: File;
  mediaId?: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'unknown';
}

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, StateCardComponent, UserAvatarComponent, AudioRecorderModalComponent, AudioPlayerComponent, HomeComposerComponent, PostActionsComponent, PostMediaCarouselComponent, PostCardComponent],
  host: {
    '(document:click)': 'closeAllMenus()',
  },
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly postStore = inject(PostStoreService);
  private readonly postsApi = inject(PostsApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly sessionService = inject(SessionService);
  private readonly composerSection = viewChild<ElementRef<HTMLElement>>('composerSection');
  readonly attachments = signal<MediaAttachment[]>([]);
  readonly uploadingFile = signal(false);
  readonly feedVideoSoundEnabled = signal(false);

  readonly posts = this.postStore.posts;
  readonly loading = this.postStore.loading;
  readonly saving = this.postStore.saving;
  readonly error = this.postStore.error;
  readonly selectedPost = signal<PostDto | null>(null);

  readonly selectedPostError = signal<string | null>(null);
  readonly editingPostId = signal<string | null>(null);
  readonly likedPosts = this.postStore.likedPosts;
  readonly retweetedPosts = this.postStore.retweetedPosts;
  readonly openComments = signal<Record<string, boolean>>({});
  readonly originalPostsCache = signal<Record<string, PostDto>>({});
  readonly activeRetweetMenu = signal<string | null>(null);
  readonly activePostMenu = signal<string | null>(null);

  readonly isQuoteModalOpen = signal(false);
  readonly postToQuote = signal<PostDto | null>(null);

  readonly isComposeModalOpen = signal(false);
  readonly isDetailModalOpen = signal(false);
  readonly postInDetail = signal<PostDto | null>(null);
  readonly isRecorderOpen = signal(false);

  readonly form = this.formBuilder.group({
    content: [''],
    isPublished: [true],
  });

  readonly quoteForm = this.formBuilder.group({
    content: ['', [Validators.required, Validators.maxLength(280)]],
  });
  readonly searchQuery = signal('');
  private readonly contentValue = toSignal(this.form.controls.content.valueChanges, { initialValue: '' });
  readonly canPost = computed(() => {
    const text = (this.contentValue() ?? '').trim();
    const hasText = text.length >= 2;
    const hasAttachments = this.attachments().length > 0;
    return hasText || hasAttachments;
  });
  readonly publishedCount = computed(() => this.posts().filter((post) => Boolean(post.isPublished)).length);
  readonly draftCount = computed(() => this.posts().filter((post) => !post.isPublished).length);
  readonly highlightedPost = computed(() => this.posts()[0] ?? null);
  readonly hasActiveSearch = computed(() => this.searchQuery().trim().length > 0);
  readonly filteredPosts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const currentUserId = this.sessionService.userId();
    const list = this.posts().filter(
      (post) => Boolean(post.isPublished) || post.userId === currentUserId,
    );

    if (!query) {
      return list;
    }

    return list.filter((post) => this.matchesPostQuery(post, query));
  });
  readonly hasNoMatches = computed(() => this.hasActiveSearch() && !this.filteredPosts().length && !!this.posts().length);
  readonly currentUserId = computed(() => this.sessionService.userId());

  readonly activeCarouselIndex = signal<Record<string, number>>({});

  protected getCarouselIndex(postId: string | undefined): number {
    if (!postId) return 0;
    return this.activeCarouselIndex()[postId] || 0;
  }

  protected prevCarousel(postId: string | undefined, total: number): void {
    if (!postId || total <= 1) return;
    this.activeCarouselIndex.update((prev) => {
      const current = prev[postId] || 0;
      const next = (current - 1 + total) % total;
      return { ...prev, [postId]: next };
    });
  }

  protected nextCarousel(postId: string | undefined, total: number): void {
    if (!postId || total <= 1) return;
    this.activeCarouselIndex.update((prev) => {
      const current = prev[postId] || 0;
      const next = (current + 1) % total;
      return { ...prev, [postId]: next };
    });
  }

  constructor() {
    void this.postStore.loadPosts();
  }

  protected closeAllMenus(): void {
    this.activeRetweetMenu.set(null);
    this.activePostMenu.set(null);
  }

  protected togglePostMenu(postId: string | undefined, event: Event): void {
    if (!postId) return;
    event.stopPropagation();
    if (this.activePostMenu() === postId) {
      this.activePostMenu.set(null);
    } else {
      this.activePostMenu.set(postId);
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canPost() || this.saving()) {
      return;
    }

    try {
      this.uploadingFile.set(true);
      const mediaIds: string[] = [];

      // 1. Upload any local files that haven't been uploaded yet
      for (const att of this.attachments()) {
        if (att.file) {
          let prefix = 'unk';
          if (att.type === 'image') prefix = 'img';
          else if (att.type === 'audio') prefix = 'audi';
          else if (att.type === 'video') prefix = 'vid';

          // Renombrar el archivo agregando el prefijo de tipo de medio para que se identifique fácilmente en la URL
          const renamedFile = new File([att.file], `${prefix}-${att.file.name}`, { type: att.file.type });

          const result = await this.postStore.uploadMedia(renamedFile);
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
        this.isComposeModalOpen.set(false);
      }
    } catch {
      // Store feedback handles this
    } finally {
      this.uploadingFile.set(false);
    }
  }

  protected startEdit(post: PostDto): void {
    this.activePostMenu.set(null);
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

    // Close any open detail modal so the user sees the composer
    this.closeDetailModal();

    // Scroll to the composer area after the DOM updates
    requestAnimationFrame(() => {
      const el = this.composerSection()?.nativeElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected async inspect(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const localPost = this.posts().find((p) => p.postId === postId);
    const targetId = (localPost && localPost.repliedToPostId) ? localPost.repliedToPostId : postId;

    try {
      this.selectedPostError.set(null);
      this.selectedPost.set(await firstValueFrom(this.postsApi.getPostById(targetId)));
    } catch (error) {
      this.selectedPost.set(null);
      this.selectedPostError.set(getErrorMessage(error, 'No pudimos obtener los detalles de la publicación.'));
    }
  }

  protected async toggleStatus(post: PostDto): Promise<void> {
    this.activePostMenu.set(null);
    const confirmed = await this.confirm.confirm({
      title: post.isPublished ? '¿Pasar la publicación a borrador?' : '¿Publicar ahora?',
      message: post.isPublished
        ? 'La publicación se quitará de la línea de tiempo hasta que la vuelvas a publicar.'
        : 'La publicación pasará a estar visible en la línea de tiempo de inmediato.',
      confirmLabel: post.isPublished ? 'Pasar a borrador' : 'Publicar',
    });

    if (!confirmed) {
      return;
    }

    await this.postStore.togglePublished(post);
  }

  protected async remove(postId: string | undefined): Promise<void> {
    this.activePostMenu.set(null);
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Eliminarla la quita de tu feed actual y no se puede deshacer desde esta pantalla.',
      confirmLabel: 'Eliminar publicación',
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

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  private matchesPostQuery(post: PostDto, query: string): boolean {
    const haystack = [post.content, post.userFullName, post.username, post.userId]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => value.toLowerCase());

    return haystack.some((value) => value.includes(query));
  }

  protected async reloadFeed(): Promise<void> {
    await this.postStore.loadPosts();
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

  /**
   * Adapts the embedded post author fields to a UserDto so the shared
   * <app-user-avatar> component can render the photo. The result is
   * cached per PostDto reference to avoid re-creating signals every
   * change detection pass.
   */
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

  /**
   * True when the current authenticated session owns the post — gates
   * destructive actions (edit, toggle status, delete) so the feed never
   * surfaces them on someone else's post.
   */
  protected isOwnPost(post: PostDto): boolean {
    const sessionUserId = this.sessionService.userId();
    return Boolean(sessionUserId && post.userId && sessionUserId === post.userId);
  }

  protected isLiked(postId: string | undefined): boolean {
    return postId ? Boolean(this.likedPosts()[postId]) : false;
  }

  protected toggleLike(post: PostDto): void {
    void this.postStore.toggleLike(post);
  }

  protected getLikesCount(post: PostDto): number {
    return post.likesCount ?? 0;
  }

  protected isRetweeted(postId: string | undefined): boolean {
    return postId ? Boolean(this.retweetedPosts()[postId]) : false;
  }

  protected toggleRetweetMenu(postId: string | undefined, event: Event): void {
    if (!postId) return;
    event.stopPropagation();
    if (this.activeRetweetMenu() === postId) {
      this.activeRetweetMenu.set(null);
    } else {
      this.activeRetweetMenu.set(postId);
    }
  }

  protected async directRetweet(post: PostDto): Promise<void> {
    const postId = post.postId;
    if (!postId) return;
    this.activeRetweetMenu.set(null);

    if (this.isRetweeted(postId)) {
      await this.postStore.unretweet(postId);
    } else {
      await this.postStore.retweet(postId, null);
    }
  }

  protected openQuoteModal(post: PostDto): void {
    this.activeRetweetMenu.set(null);
    this.postToQuote.set(post);
    this.quoteForm.reset({ content: '' });
    this.isQuoteModalOpen.set(true);
  }

  protected closeQuoteModal(): void {
    this.isQuoteModalOpen.set(false);
    this.postToQuote.set(null);
  }

  protected async submitQuoteTweet(): Promise<void> {
    const post = this.postToQuote();
    const postId = post?.postId;
    if (!postId || this.quoteForm.invalid) {
      return;
    }

    const raw = this.quoteForm.getRawValue();
    const content = raw.content.trim();

    const success = await this.postStore.retweet(postId, content);
    if (success) {
      this.closeQuoteModal();
    }
  }

  protected openComposeModal(): void {
    this.resetForm();
    this.isComposeModalOpen.set(true);
  }

  protected closeComposeModal(): void {
    this.isComposeModalOpen.set(false);
    this.resetForm();
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected openRecorder(): void {
    this.isRecorderOpen.set(true);
  }

  protected closeRecorder(): void {
    this.isRecorderOpen.set(false);
  }

  protected onAudioReady(file: File): void {
    const url = URL.createObjectURL(file);
    this.attachments.update((list) => [...list, { file, url, type: 'audio' }]);
    this.isRecorderOpen.set(false);
  }

  protected async openDetailModal(post: PostDto): Promise<void> {
    // Pure retweet (no own content): open the original post, not the retweet wrapper.
    if (post.retweetOfPostId && !post.content) {
      const orig = this.getOriginalPost(post.retweetOfPostId);
      if (orig) {
        this.postInDetail.set(orig);
        this.isDetailModalOpen.set(true);
      } else {
        try {
          const fetched = await firstValueFrom(this.postsApi.getPostById(post.retweetOfPostId));
          if (fetched) {
            this.originalPostsCache.update(cache => ({ ...cache, [post.retweetOfPostId!]: fetched }));
            this.postInDetail.set(fetched);
            this.isDetailModalOpen.set(true);
          }
        } catch {
          this.postInDetail.set(post);
          this.isDetailModalOpen.set(true);
        }
      }
      return;
    }

    const repliedId = post.repliedToPostId;
    if (repliedId) {
      const parent = this.getOriginalPost(repliedId);
      if (parent) {
        this.postInDetail.set(parent);
        this.isDetailModalOpen.set(true);
      } else {
        try {
          const fetchedParent = await firstValueFrom(this.postsApi.getPostById(repliedId));
          if (fetchedParent) {
            this.originalPostsCache.update(cache => ({ ...cache, [repliedId]: fetchedParent }));
            this.postInDetail.set(fetchedParent);
            this.isDetailModalOpen.set(true);
          }
        } catch {
          this.postInDetail.set(post);
          this.isDetailModalOpen.set(true);
        }
      }
    } else {
      this.postInDetail.set(post);
      this.isDetailModalOpen.set(true);
    }
  }

  protected onQuoteCardClick(origPost: PostDto): void {
    this.postInDetail.set(origPost);
    this.isDetailModalOpen.set(true);
  }

  protected closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.postInDetail.set(null);
  }

  protected getRetweetsCount(post: PostDto): number {
    return post.retweetsCount ?? 0;
  }

  protected isCommentsOpen(postId: string | undefined): boolean {
    return postId ? Boolean(this.openComments()[postId]) : false;
  }

  protected toggleComments(postId: string | undefined): void {
    if (!postId) return;
    this.openComments.update((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  protected getRepliesCount(post: PostDto): number {
    return post.repliesCount ?? 0;
  }

  protected getPostReplies(postId: string | undefined): PostDto[] {
    if (!postId) return [];
    return this.posts().filter((p) => p.repliedToPostId === postId && Boolean(p.isPublished));
  }

  protected async addComment(postId: string | undefined, text: string): Promise<void> {
    if (!postId || !text.trim()) {
      return;
    }
    await this.postStore.addComment(postId, text.trim());
  }

  protected interactionTarget(post: PostDto): PostDto {
    if (post.retweetOfPostId && !post.content) {
      return this.getOriginalPost(post.retweetOfPostId) ?? post;
    }
    return post;
  }

  protected getOriginalPost(retweetOfPostId: string | undefined): PostDto | null {
    if (!retweetOfPostId) return null;

    const found = this.posts().find((p) => p.postId === retweetOfPostId);
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
          repliesCount: 0
        } as PostDto
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
              repliesCount: 0
            } as PostDto
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
    const lowerUrl = url.toLowerCase();
    // Es audio si tiene prefijo "audi-", extensiones típicas de audio,
    // o si es un webm pero contiene "grabacion", "audio" o "voice" en su nombre/URL.
    return lowerUrl.includes('audi-') ||
      /\.(mp3|wav|ogg|aac|m4a)/i.test(url) ||
      lowerUrl.includes('type=audio') ||
      lowerUrl.includes('.mp3') ||
      lowerUrl.includes('.wav') ||
      lowerUrl.includes('grabacion') ||
      lowerUrl.includes('audio') ||
      lowerUrl.includes('voice');
  }

  protected isPostVideoUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    // Es video si tiene prefijo "vid-", extensiones típicas, o contiene "video"
    return lowerUrl.includes('vid-') ||
      ((/\.(mp4|webm|ogv|mov|avi)/i.test(url) ||
        lowerUrl.includes('type=video') ||
        lowerUrl.includes('.mp4') ||
        lowerUrl.includes('.webm')) && !this.isPostAudioUrl(url));
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
