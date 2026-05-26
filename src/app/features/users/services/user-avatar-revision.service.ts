import { Injectable, Signal, signal, WritableSignal } from '@angular/core';

/**
 * Tracks an avatar revision counter per user so consumers can append it
 * as a cache-busting query string after a successful avatar upload.
 *
 * Without this counter the avatar URL is identical before and after an
 * upload (it is always `/api/user/{id}/avatar`), so the browser can keep
 * serving the cached old image.
 *
 * Usage:
 *   bump(userId)    -> after a successful upload
 *   getRevision(id) -> readonly signal; 0 means "no upload happened in
 *                      this session, render the bare URL".
 */
@Injectable({ providedIn: 'root' })
export class UserAvatarRevisionService {
  private readonly revisions = new Map<string, WritableSignal<number>>();

  getRevision(userId: string): Signal<number> {
    return this.entry(userId).asReadonly();
  }

  bump(userId: string): void {
    this.entry(userId).update((value) => value + 1);
  }

  private entry(userId: string): WritableSignal<number> {
    let entry = this.revisions.get(userId);

    if (!entry) {
      entry = signal(0);
      this.revisions.set(userId, entry);
    }

    return entry;
  }
}
