import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PostDto } from '../../../../posts/models/posts.models';



@Component({
  selector: 'app-post-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-actions.component.html',
  styleUrl: './post-actions.component.scss',
})
export class PostActionsComponent {
  readonly post = input.required<PostDto>();
  readonly commentsOpen = input(false);
  readonly retweeted = input(false);
  readonly liked = input(false);
  readonly retweetMenuOpen = input(false);
  readonly repliesCount = input(0);
  readonly retweetsCount = input(0);
  readonly likesCount = input(0);
  readonly viewCount = input(0);
  readonly showCounts = input(true);
  readonly detail = input(false);

  readonly commentRequested = output<void>();
  readonly retweetMenuRequested = output<MouseEvent>();
  readonly directRetweetRequested = output<void>();
  readonly quoteRequested = output<void>();
  readonly likeRequested = output<void>();

  protected stopAndRequestComment(event: MouseEvent): void {
    event.stopPropagation();
    this.commentRequested.emit();
  }

  protected requestRetweetMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.retweetMenuRequested.emit(event);
  }

  protected stopAndRequestDirectRetweet(event: MouseEvent): void {
    event.stopPropagation();
    this.directRetweetRequested.emit();
  }

  protected stopAndRequestQuote(event: MouseEvent): void {
    event.stopPropagation();
    this.quoteRequested.emit();
  }

  protected stopAndRequestLike(event: MouseEvent): void {
    event.stopPropagation();
    this.likeRequested.emit();
  }
}
