import { computed, Injectable, signal } from '@angular/core';

/**
 * Estados del grabador. La UI cambia según este estado:
 *  - idle:       inactivo, listo para empezar
 *  - requesting: esperando permiso del micrófono
 *  - recording:  grabando audio
 *  - recorded:   se detuvo y hay un blob disponible para usar/descartar
 *  - denied:     el usuario denegó el permiso del micrófono
 *  - error:      otro error (sin micrófono disponible, navegador no soportado, etc.)
 */
export type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'error';

/**
 * Servicio que envuelve la API nativa MediaRecorder. NO se provee en root
 * a propósito: cada modal tiene su propia instancia y la libera al cerrarse.
 */
@Injectable()
export class AudioRecorderService {
  /** Duración máxima de grabación, en segundos. */
  readonly maxDurationSeconds = 180;

  readonly state = signal<RecorderState>('idle');
  readonly elapsed = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly recordedBlob = signal<Blob | null>(null);
  readonly recordedUrl = signal<string | null>(null);
  readonly mimeType = signal<string>('audio/webm');

  readonly elapsedLabel = computed(() => formatDuration(this.elapsed()));
  readonly remainingLabel = computed(() => formatDuration(Math.max(0, this.maxDurationSeconds - this.elapsed())));
  readonly isRecording = computed(() => this.state() === 'recording');
  readonly hasRecording = computed(() => this.state() === 'recorded' && this.recordedBlob() !== null);

  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private startMs = 0;

  /**
   * Solicita permiso de micrófono y empieza a grabar. Si ya hay una grabación
   * previa, primero la limpia.
   */
  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.state.set('error');
      this.errorMessage.set('Tu navegador no soporta la grabación de audio.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      this.state.set('error');
      this.errorMessage.set('Tu navegador no soporta la grabación de audio.');
      return;
    }

    this.cleanupActiveResources();
    this.discardRecording();

    try {
      this.state.set('requesting');
      this.errorMessage.set(null);

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mime = pickSupportedMime();
      this.mimeType.set(mime);

      this.mediaRecorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.chunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('stop', () => this.onRecorderStop());
      this.mediaRecorder.addEventListener('error', () => {
        this.state.set('error');
        this.errorMessage.set('Ocurrió un error durante la grabación.');
        this.cleanupActiveResources();
      });

      this.mediaRecorder.start();
      this.state.set('recording');
      this.startMs = Date.now();
      this.elapsed.set(0);
      this.startTicker();
    } catch (error) {
      this.handleStartError(error);
    }
  }

  /** Detiene la grabación. La transición a `recorded` ocurre en el handler `stop`. */
  stop(): void {
    if (this.state() !== 'recording' || !this.mediaRecorder) {
      return;
    }
    this.stopTicker();
    this.mediaRecorder.stop();
  }

  /** Vuelve al estado inicial conservando el permiso pero descartando la grabación. */
  reset(): void {
    this.cleanupActiveResources();
    this.discardRecording();
    this.state.set('idle');
    this.elapsed.set(0);
    this.errorMessage.set(null);
  }

  /** Libera todos los recursos. Llamar cuando el modal se cierra. */
  destroy(): void {
    this.cleanupActiveResources();
    this.discardRecording();
  }

  /**
   * Convierte la grabación actual en un `File` listo para subir, con un nombre
   * legible y la extensión correcta según el MIME negociado. El MIME del File
   * usa el tipo base (sin parámetros de codec) para que pase por backends que
   * validan whitelists estrictas.
   */
  toFile(): File | null {
    const blob = this.recordedBlob();
    if (!blob) {
      return null;
    }

    const baseMime = baseMimeType(this.mimeType());
    const ext = guessExtension(baseMime);
    const filename = `audi-grabacion-${formatTimestamp(new Date())}.${ext}`;
    return new File([blob], filename, { type: baseMime });
  }

  private onRecorderStop(): void {
    this.stopTicker();

    if (this.chunks.length === 0) {
      this.cleanupActiveResources();
      this.state.set('idle');
      return;
    }

    const baseMime = baseMimeType(this.mimeType());
    const blob = new Blob(this.chunks, { type: baseMime });
    const previousUrl = this.recordedUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    this.recordedBlob.set(blob);
    this.recordedUrl.set(URL.createObjectURL(blob));
    this.state.set('recorded');
    this.cleanupActiveResources();
  }

  private startTicker(): void {
    this.stopTicker();
    this.timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - this.startMs) / 1000);
      this.elapsed.set(seconds);
      if (seconds >= this.maxDurationSeconds) {
        this.stop();
      }
    }, 250);
  }

  private stopTicker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private cleanupActiveResources(): void {
    this.stopTicker();
    this.mediaRecorder = null;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  private discardRecording(): void {
    const url = this.recordedUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.recordedUrl.set(null);
    this.recordedBlob.set(null);
    this.chunks = [];
  }

  private handleStartError(error: unknown): void {
    this.cleanupActiveResources();
    const err = error as DOMException | Error;

    if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      this.state.set('denied');
      this.errorMessage.set('Permiso de micrófono denegado. Habilítalo desde la configuración del navegador.');
      return;
    }

    if (err && err.name === 'NotFoundError') {
      this.state.set('error');
      this.errorMessage.set('No se detectó ningún micrófono conectado.');
      return;
    }

    this.state.set('error');
    this.errorMessage.set(err?.message || 'No pudimos acceder al micrófono.');
  }
}

function baseMimeType(mime: string): string {
  return mime.split(';')[0].trim();
}

function pickSupportedMime(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  // Orden de preferencia: formatos que el backend acepta primero (ogg/opus),
  // y solo si el navegador no los soporta caemos a webm o mp4.
  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

function guessExtension(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('mp4')) return 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  return 'webm';
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}
