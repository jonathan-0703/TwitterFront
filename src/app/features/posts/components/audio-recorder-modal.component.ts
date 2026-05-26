import { ChangeDetectionStrategy, Component, OnDestroy, inject, output } from '@angular/core';

import { AudioPlayerComponent } from './audio-player.component';
import { AudioRecorderService } from '../services/audio-recorder.service';

/**
 * Modal de grabación de audio. Maneja todo el ciclo de vida del recorder
 * y emite el `File` final cuando el usuario confirma.
 *
 * El padre debe envolverlo en un `@if (isOpen())` y reaccionar a los outputs:
 *   - `audioReady`: el usuario aprobó la grabación
 *   - `closed`:     el usuario cerró el modal sin guardar
 */
@Component({
  selector: 'app-audio-recorder-modal',
  imports: [AudioPlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AudioRecorderService],
  templateUrl: './audio-recorder-modal.component.html',
  styleUrl: './audio-recorder-modal.component.scss',
})
export class AudioRecorderModalComponent implements OnDestroy {
  protected readonly recorder = inject(AudioRecorderService);

  readonly audioReady = output<File>();
  readonly closed = output<void>();

  protected readonly maxLabel = formatMax(this.recorder.maxDurationSeconds);

  ngOnDestroy(): void {
    this.recorder.destroy();
  }

  protected start(): void {
    void this.recorder.start();
  }

  protected stop(): void {
    this.recorder.stop();
  }

  protected reset(): void {
    this.recorder.reset();
  }

  protected confirm(): void {
    const file = this.recorder.toFile();
    if (!file) {
      return;
    }
    this.audioReady.emit(file);
    this.recorder.destroy();
    this.closed.emit();
  }

  protected cancel(): void {
    this.recorder.destroy();
    this.closed.emit();
  }
}

function formatMax(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes && remaining) {
    return `${minutes} min ${remaining} s`;
  }
  if (minutes) {
    return `${minutes} min`;
  }
  return `${remaining} s`;
}
