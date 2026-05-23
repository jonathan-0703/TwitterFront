import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmOutletComponent } from './core/ui/confirm-outlet.component';
import { FeedbackOutletComponent } from './core/ui/feedback-outlet.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FeedbackOutletComponent, ConfirmOutletComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
