import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { AdminApiService } from '../admin-api.service';
import { AdminPostRecord } from '../admin.models';

@Component({
  selector: 'app-admin-posts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, ReactiveFormsModule, StateCardComponent],
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
    reason: ['Manual moderation review', [Validators.required]],
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
      this.error.set(getErrorMessage(error, 'We could not load admin posts.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(post: AdminPostRecord): void {
    this.selected.set(post);
    this.flagForm.reset({ postId: post.postId ?? '', reason: 'Manual moderation review' });
  }

  protected async flagSelected(): Promise<void> {
    if (this.flagForm.invalid) {
      this.flagForm.markAllAsTouched();
      return;
    }

    const { postId, reason } = this.flagForm.getRawValue();
    await this.run(async () => {
      await firstValueFrom(this.adminApi.flagPost(postId, { reason }));
      this.feedback.success('The post was flagged for moderation review.', { title: 'Post flagged' });
      await this.load();
    }, 'Post flagging failed.');
  }

  protected async deletePost(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Delete this post?',
      message: 'This soft-deletes the post in moderation and should only happen after a clear review decision.',
      confirmLabel: 'Delete post',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.adminApi.deleteAdminPost(postId));
      this.feedback.success('The post was deleted by moderation.', { title: 'Post deleted' });
      await this.load();
    }, 'Post delete failed.');
  }

  protected async restorePost(postId: string | undefined): Promise<void> {
    if (!postId) {
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Restore this post?',
      message: 'This returns the post to the moderation list and makes it available again in the current backend workflow.',
      confirmLabel: 'Restore post',
    });

    if (!confirmed) {
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.adminApi.restoreAdminPost(postId));
      this.feedback.success('The post was restored.', { title: 'Post restored' });
      await this.load();
    }, 'Post restore failed.');
  }

  private async run(task: () => Promise<void>, fallback: string): Promise<void> {
    try {
      this.error.set(null);
      await task();
    } catch (error) {
      const message = getErrorMessage(error, fallback);
      this.error.set(message);
      this.feedback.error(message, { title: 'Admin action failed' });
    }
  }
}
