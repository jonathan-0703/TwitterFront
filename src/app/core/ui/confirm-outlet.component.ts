import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'confirm.cancel()',
  },
  template: `
    @if (confirm.dialog(); as dialog) {
      <div class="confirm-backdrop" (click)="confirm.cancel()" aria-hidden="true"></div>

      <section class="confirm-shell" aria-labelledby="confirm-title" aria-describedby="confirm-message" role="alertdialog" aria-modal="true">
        <article class="confirm-card" [class.tone-danger]="dialog.tone === 'danger'">
          <div class="confirm-badge" aria-hidden="true">{{ dialog.tone === 'danger' ? '!' : '?' }}</div>

          <div class="confirm-copy">
            <p class="confirm-eyebrow">Confirm action</p>
            <h2 id="confirm-title">{{ dialog.title }}</h2>
            <p id="confirm-message">{{ dialog.message }}</p>

            @if (dialog.details) {
              <p class="confirm-details">{{ dialog.details }}</p>
            }
          </div>

          <div class="confirm-actions">
            <button type="button" class="secondary-action" (click)="confirm.cancel()">{{ dialog.cancelLabel }}</button>
            <button
              type="button"
              class="primary-action"
              [class.danger-primary]="dialog.tone === 'danger'"
              (click)="confirm.approve()"
            >
              {{ dialog.confirmLabel }}
            </button>
          </div>
        </article>
      </section>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1100;
      pointer-events: none;
    }

    .confirm-backdrop,
    .confirm-shell {
      position: absolute;
      inset: 0;
    }

    .confirm-backdrop {
      pointer-events: auto;
      background: rgb(2 6 23 / 0.72);
      backdrop-filter: blur(10px);
    }

    .confirm-shell {
      pointer-events: none;
      display: grid;
      place-items: center;
      padding: 1rem;
    }

    .confirm-card {
      pointer-events: auto;
      width: min(32rem, 100%);
      display: grid;
      gap: 1rem;
      padding: 1.35rem;
      border-radius: 1.6rem;
      border: 1px solid rgb(148 163 184 / 0.18);
      background: linear-gradient(180deg, rgb(15 23 42 / 0.98), rgb(15 23 42 / 0.9));
      box-shadow: 0 30px 80px rgb(2 6 23 / 0.45);
    }

    .confirm-card.tone-danger {
      border-color: rgb(251 113 133 / 0.28);
      background: linear-gradient(180deg, rgb(69 10 27 / 0.96), rgb(15 23 42 / 0.94));
    }

    .confirm-badge {
      width: 3rem;
      height: 3rem;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgb(255 255 255 / 0.08);
      font-size: 1.2rem;
      font-weight: 800;
    }

    .confirm-copy {
      display: grid;
      gap: 0.45rem;
    }

    .confirm-eyebrow,
    .confirm-copy h2,
    .confirm-copy p {
      margin: 0;
    }

    .confirm-eyebrow {
      color: rgb(148 163 184 / 0.78);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
    }

    .confirm-copy h2 {
      font-size: 1.3rem;
    }

    .confirm-copy p,
    .confirm-details {
      color: rgb(226 232 240 / 0.84);
      line-height: 1.6;
    }

    .confirm-details {
      padding: 0.85rem 1rem;
      border-radius: 1rem;
      background: rgb(2 6 23 / 0.34);
    }

    .confirm-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .danger-primary {
      background: rgb(225 29 72);
      border-color: rgb(225 29 72);
    }

    @media (width <= 720px) {
      .confirm-actions {
        flex-direction: column-reverse;
      }
    }
  `,
})
export class ConfirmOutletComponent {
  protected readonly confirm = inject(ConfirmService);
}
