import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { FeedbackService } from './feedback.service';

@Component({
  selector: 'app-feedback-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="feedback-stack" aria-live="polite" aria-atomic="true">
      @for (item of feedback.items(); track item.id) {
        <article
          class="toast"
          [class.tone-success]="item.tone === 'success'"
          [class.tone-error]="item.tone === 'error'"
          [class.tone-info]="item.tone === 'info'"
          role="status"
        >
          <div class="toast-copy">
            @if (item.title) {
              <strong>{{ item.title }}</strong>
            }
            <p>{{ item.message }}</p>
          </div>

          <button type="button" class="toast-close" (click)="feedback.dismiss(item.id)" aria-label="Dismiss message">
            ×
          </button>
        </article>
      }
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: auto 1rem 1rem auto;
      z-index: 1000;
      pointer-events: none;
    }

    .feedback-stack {
      display: grid;
      gap: 0.75rem;
      width: min(24rem, calc(100vw - 2rem));
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.95rem 1rem;
      border-radius: 1rem;
      border: 1px solid var(--toast-border);
      background: var(--toast-background);
      color: #f8fafc;
      box-shadow: 0 22px 45px rgb(2 6 23 / 0.35);
      backdrop-filter: blur(16px);
    }

    .tone-success {
      --toast-background: rgb(8 47 73 / 0.94);
      --toast-border: rgb(34 211 238 / 0.35);
    }

    .tone-error {
      --toast-background: rgb(76 5 25 / 0.95);
      --toast-border: rgb(251 113 133 / 0.35);
    }

    .tone-info {
      --toast-background: rgb(15 23 42 / 0.96);
      --toast-border: rgb(59 130 246 / 0.35);
    }

    .toast-copy {
      display: grid;
      gap: 0.2rem;
    }

    .toast-copy strong,
    .toast-copy p {
      margin: 0;
    }

    .toast-copy p {
      color: rgb(226 232 240 / 0.92);
      line-height: 1.45;
    }

    .toast-close {
      width: 2rem;
      height: 2rem;
      border: 0;
      border-radius: 999px;
      background: rgb(255 255 255 / 0.08);
      color: inherit;
      cursor: pointer;
    }
  `,
})
export class FeedbackOutletComponent {
  protected readonly feedback = inject(FeedbackService);
}
