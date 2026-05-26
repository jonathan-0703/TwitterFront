import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';

import { AdminPostRecord } from '../models/admin.models';
import { AdminApiService } from '../services/admin-api.service';

@Component({
  selector: 'app-admin-posts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, StateCardComponent],
  templateUrl: './admin-posts.page.html',
  styleUrl: './admin-posts.page.scss',
})
export class AdminPostsPage {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly feedback = inject(FeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly posts = signal<AdminPostRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selected = signal<AdminPostRecord | null>(null);
  readonly flagForm = this.formBuilder.group({
    postId: ['', [Validators.required]],
    reason: ['Revisión de moderación manual', [Validators.required]],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      this.posts.set(await firstValueFrom(this.adminApi.listPosts()));
    } catch (error) {
      this.error.set(getErrorMessage(error, 'No pudimos cargar las publicaciones de administración.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(post: AdminPostRecord): void {
    this.selected.set(post);
    this.flagForm.reset({ postId: post.postId ?? '', reason: 'Revisión de moderación manual' });
  }

  protected async flagSelected(): Promise<void> {
    if (this.flagForm.invalid) {
      this.flagForm.markAllAsTouched();
      return;
    }

    const { postId, reason } = this.flagForm.getRawValue();
    await this.run(async () => {
      await firstValueFrom(this.adminApi.flagPost(postId, { reason }));
      this.feedback.success('La publicación fue marcada para revisión.', { title: 'Publicación marcada' });
      await this.load();
    }, 'Falló el marcado de la publicación.');
  }

  protected async deletePost(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar esta publicación?',
      message: 'Esto elimina la publicación (soft delete) en moderación. Solo debería suceder después de una decisión clara.',
      confirmLabel: 'Eliminar publicación',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.adminApi.deleteAdminPost(postId));
      this.feedback.success('La publicación fue eliminada por moderación.', { title: 'Publicación eliminada' });
      await this.load();
    }, 'Falló la eliminación de la publicación.');
  }

  protected async restorePost(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Restaurar esta publicación?',
      message: 'Devuelve la publicación a la lista de moderación y la deja disponible nuevamente en el flujo del backend.',
      confirmLabel: 'Restaurar publicación',
    });

    if (!confirmed) {
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.adminApi.restoreAdminPost(postId));
      this.feedback.success('La publicación fue restaurada.', { title: 'Publicación restaurada' });
      await this.load();
    }, 'Falló la restauración de la publicación.');
  }

  private async run(task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Error en la acción de administración' });
    }
  }
}
