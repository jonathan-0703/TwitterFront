import { Pipe, PipeTransform } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Resolves a relative or absolute media URL to a full absolute URL.
 * Being a pure pipe, Angular memoizes the result per unique input,
 * eliminating repeated HTTP requests caused by template method calls.
 */
@Pipe({ name: 'mediaUrl', pure: true, standalone: true })
export class MediaUrlPipe implements PipeTransform {
  transform(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${environment.apiBaseUrl}${path}`;
  }
}
