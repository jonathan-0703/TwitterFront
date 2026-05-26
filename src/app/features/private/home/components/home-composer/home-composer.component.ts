import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AudioPlayerComponent } from '../../../../posts/components/audio-player.component';
import type { MediaAttachment } from '../../home.page';

@Component({
  selector: 'app-home-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AudioPlayerComponent],
  templateUrl: './home-composer.component.html',
  styleUrl: './home-composer.component.scss',
})
export class HomeComposerComponent {
  readonly form = input.required<FormGroup>();
  readonly editingPostId = input<string | null>(null);
  readonly attachments = input.required<MediaAttachment[]>();
  readonly uploadingFile = input(false);
  readonly canPost = input(false);
  readonly saving = input(false);

  readonly submitted = output<void>();
  readonly fileInputRequested = output<string>();
  readonly recorderOpened = output<void>();
  readonly attachmentRemoved = output<number>();
  readonly editCancelled = output<void>();
}
