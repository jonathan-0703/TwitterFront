import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  effect,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

import { MediaUrlPipe } from '../../../../../core/ui/media-url.pipe';
import { AudioPlayerComponent } from '../../../../posts/components/audio-player.component';

type MediaType = 'image' | 'audio' | 'video';

@Component({
  selector: 'app-post-media-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [AudioPlayerComponent, MediaUrlPipe],
  templateUrl: './post-media-carousel.component.html',
  styleUrl: './post-media-carousel.component.scss',
})
export class PostMediaCarouselComponent {
  readonly mediaUrls = input.required<string[]>();
  readonly postId = input<string | undefined>();
  readonly currentIndex = input(0);
  readonly imageAlt = input('Adjunto de la publicación');
  readonly soundEnabled = input(false);
  readonly detail = input(false);
  readonly lazyVideo = input(true);

  readonly previousRequested = output<{ postId: string | undefined; total: number }>();
  readonly nextRequested = output<{ postId: string | undefined; total: number }>();
  readonly soundEnabledChange = output<boolean>();

  private readonly feedVideos = viewChildren<ElementRef<HTMLVideoElement>>('feedVideo');
  protected readonly loadedVideoUrls = signal<Record<string, true>>({});

  protected readonly mediaType = getMediaType;

  constructor() {
    effect((onCleanup) => {
      if (!this.lazyVideo()) {
        return;
      }

      const videos = this.feedVideos();

      if (!videos.length) {
        return;
      }

      if (typeof IntersectionObserver === 'undefined') {
        videos.forEach(({ nativeElement }) => {
          const mediaUrl = nativeElement.dataset['mediaUrl'];
          if (mediaUrl) {
            this.markVideoAsLoaded(mediaUrl);
            this.updateVideoPlayback(nativeElement, true);
          }
        });
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target as HTMLVideoElement;
            const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
            const mediaUrl = video.dataset['mediaUrl'];

            if (mediaUrl && isVisible) {
              this.markVideoAsLoaded(mediaUrl);
            }

            this.updateVideoPlayback(video, isVisible);
          });
        },
        {
          rootMargin: '240px 0px',
          threshold: 0.15,
        },
      );

      videos.forEach(({ nativeElement }) => {
        const mediaUrl = nativeElement.dataset['mediaUrl'];
        if (mediaUrl) {
          observer.observe(nativeElement);
        }
      });

      onCleanup(() => observer.disconnect());
    });
  }

  protected isAudioOnly(): boolean {
    const urls = this.mediaUrls();
    return urls.length === 1 && this.mediaType(urls[0]) === 'audio';
  }

  protected isActive(index: number): boolean {
    return index === this.currentIndex();
  }

  protected previous(event: MouseEvent): void {
    event.stopPropagation();
    this.previousRequested.emit({ postId: this.postId(), total: this.mediaUrls().length });
  }

  protected next(event: MouseEvent): void {
    event.stopPropagation();
    this.nextRequested.emit({ postId: this.postId(), total: this.mediaUrls().length });
  }

  protected onCarouselClick(event: MouseEvent): void {
    if (this.detail()) {
      event.stopPropagation();
    }
  }

  protected isVideoLoaded(url: string): boolean {
    return !this.lazyVideo() || Boolean(this.loadedVideoUrls()[url]);
  }

  protected enableVideoSound(event: MouseEvent, video: HTMLVideoElement): void {
    event.stopPropagation();
    this.soundEnabledChange.emit(true);
    this.applyVideoSoundPreference(video, true);
    void video.play().catch(() => {
      // Ignore playback errors triggered by browser policy changes.
    });
  }

  protected syncVideoSoundPreference(video: HTMLVideoElement): void {
    this.soundEnabledChange.emit(!video.muted);
  }

  private markVideoAsLoaded(url: string): void {
    this.loadedVideoUrls.update((loaded) => (loaded[url] ? loaded : { ...loaded, [url]: true }));
  }

  private updateVideoPlayback(video: HTMLVideoElement, shouldPlay: boolean): void {
    if (!shouldPlay) {
      video.pause();
      return;
    }

    this.playVideo(video);
  }

  private playVideo(video: HTMLVideoElement, attempt = 0): void {
    if (!video.isConnected) {
      return;
    }

    const hasSource = Boolean(video.currentSrc || video.getAttribute('src'));
    if (!hasSource) {
      if (attempt >= 4) {
        return;
      }

      requestAnimationFrame(() => this.playVideo(video, attempt + 1));
      return;
    }

    const shouldEnableSound = this.soundEnabled();
    this.applyVideoSoundPreference(video, shouldEnableSound);

    void video.play().catch(() => {
      if (shouldEnableSound) {
        this.soundEnabledChange.emit(false);
        this.applyVideoSoundPreference(video, false);
        void video.play().catch(() => undefined);
      }
    });
  }

  private applyVideoSoundPreference(video: HTMLVideoElement, shouldEnableSound: boolean): void {
    video.muted = !shouldEnableSound;
    video.volume = shouldEnableSound ? 1 : 0;
  }
}

function getMediaType(url: string): MediaType {
  const lowerUrl = url.toLowerCase();
  const isAudio =
    lowerUrl.includes('audi-') ||
    /\.(mp3|wav|ogg|m4a|webm)(\?|$)/i.test(url) ||
    lowerUrl.includes('type=audio') ||
    lowerUrl.includes('.mp3') ||
    lowerUrl.includes('.wav') ||
    lowerUrl.includes('grabacion') ||
    lowerUrl.includes('audio') ||
    lowerUrl.includes('voice');

  if (isAudio) {
    return 'audio';
  }

  const isVideo =
    lowerUrl.includes('vid-') ||
    ((/\.(mp4|webm|ogv|mov|avi)/i.test(url) ||
      lowerUrl.includes('type=video') ||
      lowerUrl.includes('.mp4') ||
      lowerUrl.includes('.webm')) &&
      !isAudio);

  return isVideo ? 'video' : 'image';
}
