import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Reproductor de audio custom con play/pause, barra de progreso interactiva
 * y tiempo. Reemplaza al `<audio controls>` nativo para una UX consistente
 * con el resto de la app (estilo píldora, color de marca).
 */
@Component({
  selector: 'app-audio-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss',
})
export class AudioPlayerComponent {
  readonly src = input.required<string>();

  private readonly audioRef = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);

  readonly progressPercent = computed(() => {
    const dur = this.duration();
    if (!dur || !Number.isFinite(dur)) {
      return 0;
    }
    return Math.min(100, (this.currentTime() / dur) * 100);
  });

  readonly timeLabel = computed(() => {
    const total = this.duration();
    const current = this.currentTime();

    if (!total || !Number.isFinite(total)) {
      return formatSeconds(current);
    }

    return `${formatSeconds(current)} / ${formatSeconds(total)}`;
  });

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const audio = this.audioRef().nativeElement;

    if (audio.paused) {
      void audio.play().catch(() => {
        // Ignored: el play puede fallar si el src todavía no se cargó.
      });
    } else {
      audio.pause();
    }
  }

  protected seek(event: MouseEvent): void {
    event.stopPropagation();
    const audio = this.audioRef().nativeElement;
    const total = audio.duration;

    if (!total || !Number.isFinite(total)) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = clamp01((event.clientX - rect.left) / rect.width);
    audio.currentTime = ratio * total;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const audio = this.audioRef().nativeElement;
    const total = audio.duration;
    if (!total || !Number.isFinite(total)) {
      return;
    }

    const STEP_SECONDS = 5;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      audio.currentTime = Math.min(total, audio.currentTime + STEP_SECONDS);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - STEP_SECONDS);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggle(new MouseEvent('click'));
    }
  }

  protected onTimeUpdate(): void {
    this.currentTime.set(this.audioRef().nativeElement.currentTime);
  }

  protected onLoadedMetadata(): void {
    const dur = this.audioRef().nativeElement.duration;
    this.duration.set(Number.isFinite(dur) ? dur : 0);
  }

  protected onEnded(): void {
    this.isPlaying.set(false);
    this.currentTime.set(0);
  }
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
