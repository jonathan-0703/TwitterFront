import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';

import { PostStoreService } from '../../posts/services/post-store.service';
import { UserAvatarComponent } from '../../users/components/user-avatar.component';
import { UserStoreService } from '../../users/services/user-store.service';

import { PostCardComponent } from '../../posts/components/post-card.component';
import { PostMediaCarouselComponent } from '../home/components/post-media-carousel/post-media-carousel.component';
import { environment } from '../../../../environments/environment';
import { FollowButtonComponent } from '../../follows/components/follow-button.component';
import { SendMessageButtonComponent } from '../../messages/components/send-message-button.component';
import { FollowsApiService } from '../../follows/services/follows-api.service';
import { UsersApiService } from '../../users/services/users-api.service';
import { PostsApiService } from '../../posts/services/posts-api.service';
import { UserDto } from '../../users/models/users.models';
import { PostDto } from '../../posts/models/posts.models';


@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, StateCardComponent, UserAvatarComponent, PostCardComponent, PostMediaCarouselComponent, FollowButtonComponent, SendMessageButtonComponent],
  host: {
    '(document:click)': 'closeAllMenus()',
  },
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  readonly id = input.required<string>();

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly postsApi = inject(PostsApiService);
  private readonly userStore = inject(UserStoreService);
  private readonly postStore = inject(PostStoreService);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);
  private readonly followsApi = inject(FollowsApiService);
  private readonly router = inject(Router);

  readonly profile = signal<UserDto | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly currentUser = this.userStore.currentUser;
  readonly profileFormLoading = this.userStore.loading;
  readonly editProfileOpen = signal(false);
  readonly changePasswordOpen = signal(false);
  readonly profileSaveMessage = signal<string | null>(null);
  readonly avatarMessage = signal<string | null>(null);
  readonly passwordSuccessMessage = signal<string | null>(null);
  readonly passwordErrorMessage = signal<string | null>(null);
  readonly passwordSaving = signal(false);
  readonly pendingAvatarFile = signal<File | null>(null);
  readonly pendingAvatarPreviewUrl = signal<string | null>(null);
  readonly openComments = signal<Record<string, boolean>>({});
  readonly feedVideoSoundEnabled = signal(false);
  readonly activePostMenu = signal<string | null>(null);
  readonly followersCount = signal(0);
  readonly followingCount = signal(0);
  readonly profileForm = this.formBuilder.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    biography: [''],
  });
  readonly passwordForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: matchPasswordsValidator });
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
      return 'Desconocido';
    }

    if (user.deletedAt) {
      return 'Eliminado';
    }

    if (user.isSuspended) {
      return 'Suspendido';
    }

    if (user.isActive === false) {
      return 'Inactivo';
    }

    return user.isVerified ? 'Verificado' : 'Activo';
  });
  readonly joinedLabel = computed(() => this.profile()?.createdAt ?? null);
  readonly biographyPreview = computed(() => this.profile()?.biography?.trim() || 'Aún no se agregó una biografía.');
  readonly canSaveProfile = computed(() => !this.profileFormLoading() && (!this.profileForm.pristine || !!this.pendingAvatarFile()));
  readonly isOwnProfile = computed(() => {
    const resolvedUserId = this.resolvedUserId();
    const sessionUserId = this.userStore.currentUserId();

    return Boolean(resolvedUserId && sessionUserId && resolvedUserId === sessionUserId);
  });
  readonly sessionUserId = computed(() => this.userStore.currentUserId());

  constructor() {
    effect(() => {
      const userId = this.resolvedUserId();

      if (!userId) {
        return;
      }

      void this.loadProfile(userId);
    });

    effect(() => {
      if (!this.isOwnProfile() || this.currentUser()) {
        return;
      }

      void this.userStore.loadCurrentUser();
    });

    effect(() => {
      const user = this.currentUser();

      if (!user || !this.isOwnProfile()) {
        return;
      }

      this.profileForm.reset({
        fullName: user.fullName ?? '',
        email: user.email ?? '',
        biography: user.biography ?? '',
      });
    });
  }

  protected trackPost(index: number, post: PostDto): string {
    return post.postId ?? post.createdAt ?? String(index);
  }

  protected openEditProfile(): void {
    this.profileSaveMessage.set(null);
    this.avatarMessage.set(null);
    this.editProfileOpen.set(true);
  }

  protected closeEditProfile(): void {
    this.editProfileOpen.set(false);
    this.profileSaveMessage.set(null);
    this.avatarMessage.set(null);
    this.clearPendingAvatar();
    this.resetProfileForm();
  }

  protected openChangePassword(): void {
    this.passwordSuccessMessage.set(null);
    this.passwordErrorMessage.set(null);
    this.changePasswordOpen.set(true);
  }

  protected closeChangePassword(): void {
    this.changePasswordOpen.set(false);
    this.resetPasswordForm();
  }

  protected async saveProfile(): Promise<void> {
    if (this.profileForm.invalid || this.userStore.loading()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSaveMessage.set(null);
    this.avatarMessage.set(null);
    const updatedProfile = await this.userStore.updateCurrentUser(this.profileForm.getRawValue());

    if (!updatedProfile) {
      return;
    }

    let finalUser = updatedProfile;
    const pendingAvatar = this.pendingAvatarFile();

    if (pendingAvatar) {
      const updatedAvatarUser = await this.userStore.uploadCurrentUserAvatar(pendingAvatar);

      if (!updatedAvatarUser) {
        this.profile.set(updatedProfile);
        this.avatarMessage.set('Los cambios del perfil se guardaron, pero la subida de la foto falló.');
        return;
      }

      finalUser = updatedAvatarUser;
      this.avatarMessage.set('Foto de perfil actualizada correctamente.');
    }

    this.profile.set(finalUser);
    this.profileSaveMessage.set('Perfil actualizado correctamente.');
    this.clearPendingAvatar();
    this.editProfileOpen.set(false);
  }

  protected stageAvatar(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.avatarMessage.set('Avatar listo. Guarda los cambios para subirlo.');
    this.setPendingAvatar(file);

    if (input) {
      input.value = '';
    }
  }

  protected async savePassword(): Promise<void> {
    if (this.passwordForm.invalid || this.passwordSaving()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    try {
      this.passwordSaving.set(true);
      this.passwordErrorMessage.set(null);
      this.passwordSuccessMessage.set(null);
      await firstValueFrom(this.usersApi.changePassword({ currentPassword, newPassword }));
      this.passwordSuccessMessage.set('Contraseña cambiada correctamente.');
      this.feedback.success('Tu contraseña se cambió correctamente.', { title: 'Contraseña actualizada' });
      this.resetPasswordForm();
      this.changePasswordOpen.set(false);
    } catch (error) {
      const message = getErrorMessage(error, 'El endpoint de cambio de contraseña rechazó la solicitud.');
      this.passwordErrorMessage.set(message);
      this.feedback.error(message, { title: 'Error al cambiar la contraseña' });
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected passwordMismatch(): boolean {
    return this.passwordForm.hasError('passwordMismatch')
      && (this.passwordForm.controls.newPassword.touched || this.passwordForm.controls.confirmPassword.touched);
  }

  protected passwordLengthMet(): boolean {
    return this.passwordForm.controls.newPassword.value.length >= 6;
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

      // Load followers/following counts
      try {
        const [followersCount, followingCount] = await Promise.all([
          firstValueFrom(this.followsApi.getFollowersCount(userId)),
          firstValueFrom(this.followsApi.getFollowingCount(userId)),
        ]);
        this.followersCount.set(followersCount);
        this.followingCount.set(followingCount);
      } catch {
        // Silently fail - counts will remain at 0
      }

      if (!this.postStore.posts().length) {
        await this.postStore.loadPosts();
      }
    } catch (error) {
      this.profile.set(null);
      this.profileError.set(getErrorMessage(error, 'No pudimos cargar este perfil.'));
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

  protected profilePhotoAlt(user: UserDto | null): string {
    return `Foto de perfil de ${user?.fullName || 'Usuario'}`;
  }

  protected removePendingAvatar(): void {
    this.clearPendingAvatar();
    this.avatarMessage.set(null);
  }

  private resetProfileForm(): void {
    const user = this.currentUser();

    if (!user) {
      return;
    }

    this.profileForm.reset({
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      biography: user.biography ?? '',
    });
  }

  private setPendingAvatar(file: File): void {
    this.clearPendingAvatar();
    this.pendingAvatarFile.set(file);
    this.pendingAvatarPreviewUrl.set(URL.createObjectURL(file));
  }

  private clearPendingAvatar(): void {
    const previewUrl = this.pendingAvatarPreviewUrl();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    this.pendingAvatarFile.set(null);
    this.pendingAvatarPreviewUrl.set(null);
  }

  private resetPasswordForm(): void {
    this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    this.passwordErrorMessage.set(null);
    this.passwordSuccessMessage.set(null);
  }

  // Media & Lightbox Carousel helpers
  readonly activeCarouselIndex = signal<Record<string, number>>({});
  readonly mediaTypes = signal<Record<string, 'image' | 'video' | 'audio' | 'unknown'>>({});
  readonly likedPosts = this.postStore.likedPosts;
  readonly retweetedPosts = this.postStore.retweetedPosts;

  // Detail Modal signals
  readonly isDetailModalOpen = signal(false);
  readonly postInDetail = signal<PostDto | null>(null);
  readonly originalPostsCache = signal<Record<string, PostDto>>({});
  readonly activeRetweetMenu = signal<string | null>(null);

  protected getCarouselIndex(postId: string | undefined): number {
    if (!postId) return 0;
    return this.activeCarouselIndex()[postId] || 0;
  }

  protected prevCarousel(postId: string | undefined, total: number, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!postId) return;
    this.activeCarouselIndex.update((prev) => {
      const idx = prev[postId] || 0;
      return { ...prev, [postId]: (idx - 1 + total) % total };
    });
  }

  protected nextCarousel(postId: string | undefined, total: number, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!postId) return;
    this.activeCarouselIndex.update((prev) => {
      const idx = prev[postId] || 0;
      return { ...prev, [postId]: (idx + 1) % total };
    });
  }

  protected isPostAudioUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
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
    return lowerUrl.includes('vid-') ||
      ((/\.(mp4|webm|ogv|mov|avi)/i.test(url) ||
        lowerUrl.includes('type=video') ||
        lowerUrl.includes('.mp4') ||
        lowerUrl.includes('.webm')) && !this.isPostAudioUrl(url));
  }

  protected getMediaType(url: string): 'image' | 'video' | 'audio' | 'unknown' {
    const absUrl = this.getAbsoluteMediaUrl(url);
    if (this.isPostAudioUrl(url)) {
      return 'audio';
    }
    const cached = this.mediaTypes()[absUrl];
    if (cached) {
      return cached;
    }
    if (this.isPostVideoUrl(url)) {
      return 'video';
    }
    return 'image';
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

  protected async openDetailModal(post: PostDto): Promise<void> {
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

    this.postInDetail.set(post);
    this.isDetailModalOpen.set(true);
  }

  protected closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.postInDetail.set(null);
  }

  protected getOriginalPost(retweetOfPostId: string | undefined): PostDto | null {
    if (!retweetOfPostId) return null;
    const found = this.posts().find((p) => p.postId === retweetOfPostId);
    if (found) return found;
    const cached = this.originalPostsCache()[retweetOfPostId];
    if (cached) return cached;
    return null;
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

  protected getRetweetsCount(post: PostDto): number {
    return post.retweetsCount ?? 0;
  }

  protected getRepliesCount(post: PostDto): number {
    return post.repliesCount ?? 0;
  }

  protected postAuthor(post: PostDto): UserDto {
    return {
      userId: post.userId ?? '',
      fullName: post.userFullName ?? 'Usuario',
      email: '',
      isVerified: false, // This field is not available in PostDto
      profilePhotoUrl: post.userAvatar ?? null,
    };
  }

  protected authorName(post: PostDto): string {
    return post.userFullName ?? 'Usuario';
  }

  protected authorHandle(post: PostDto): string {
    return `@${post.userFullName?.replace(/\s+/g, '').toLowerCase() || 'usuario'}`;
  }

  protected async addComment(postId: string | undefined, text: string): Promise<void> {
    if (!postId || !text.trim()) {
      return;
    }
    await this.postStore.addComment(postId, text.trim());
  }

  protected getPostReplies(postId: string | undefined): PostDto[] {
    if (!postId) return [];
    return this.postStore.posts().filter((p) => p.repliedToPostId === postId);
  }

  protected async directRetweet(post: PostDto): Promise<void> {
    const postId = post.postId;
    if (!postId) return;
    this.activeRetweetMenu.set(null);
    await this.postStore.retweet(postId, null);
  }

  protected openQuoteModal(post: PostDto): void {
    this.activeRetweetMenu.set(null);
    this.directRetweet(post);
  }

  protected interactionTarget(post: PostDto): PostDto {
    if (post.retweetOfPostId && !post.content) {
      return this.getOriginalPost(post.retweetOfPostId) ?? post;
    }
    return post;
  }

  protected closeAllMenus(): void {
    this.activeRetweetMenu.set(null);
    this.activePostMenu.set(null);
  }

  protected isCommentsOpen(postId: string | undefined): boolean {
    return postId ? Boolean(this.openComments()[postId]) : false;
  }

  protected toggleComments(postId: string | undefined): void {
    if (!postId) return;
    this.openComments.update((prev) => ({ ...prev, [postId]: !prev[postId] }));
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

  protected async startEdit(post: PostDto): Promise<void> {
    this.feedback.info('La edición de publicaciones está disponible en el feed.', { title: 'Editar publicación' });
    this.activePostMenu.set(null);
  }

  protected async toggleStatus(post: PostDto): Promise<void> {
    await this.postStore.togglePublished(post);
    this.activePostMenu.set(null);
  }

  protected async remove(postId: string | undefined): Promise<void> {
    if (!postId) return;
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Eliminarla la quita de tu feed actual y no se puede deshacer desde esta pantalla.',
      confirmLabel: 'Eliminar publicación',
      tone: 'danger',
    });
    if (!confirmed) return;
    await this.postStore.deletePost(postId);
    this.activePostMenu.set(null);
  }

  protected async inspect(postId: string | undefined): Promise<void> {
    if (!postId) return;
    try {
      const fetched = await firstValueFrom(this.postsApi.getPostById(postId));
      if (fetched) {
        this.postInDetail.set(fetched);
        this.isDetailModalOpen.set(true);
      }
    } catch {
      // ignore
    }
  }

  protected onQuoteCardClick(origPost: PostDto): void {
    this.postInDetail.set(origPost);
    this.isDetailModalOpen.set(true);
  }

  protected navigateToFollows(tab: 'followers' | 'following'): void {
    const userId = this.resolvedUserId();
    if (userId) {
      void this.router.navigate(['/follows', userId], { queryParams: { tab } });
    }
  }
}

function matchPasswordsValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value as string | undefined;
  const confirmPassword = control.get('confirmPassword')?.value as string | undefined;

  if (!newPassword || !confirmPassword) {
    return null;
  }

  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}
