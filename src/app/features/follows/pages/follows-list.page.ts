import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getErrorMessage } from '../../../core/api/api.utils';
import { SessionService } from '../../../core/auth/session.service';
import { StateCardComponent } from '../../../shared/components/state-card/state-card.component';
import { FollowButtonComponent } from '../components/follow-button.component';
import { FollowsApiService } from '../services/follows-api.service';
import { FollowUserDto } from '../models/follows.models';
import { UserAvatarComponent } from '../../users/components/user-avatar.component';
import { UserDto } from '../../users/models/users.models';


type TabType = 'followers' | 'following';

@Component({
    selector: 'app-follows-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [StateCardComponent, UserAvatarComponent, FollowButtonComponent],
    templateUrl: './follows-list.page.html',
    styleUrl: './follows-list.page.scss',
})
export class FollowsPage {
    private readonly followsApi = inject(FollowsApiService);
    private readonly sessionService = inject(SessionService);
    private readonly router = inject(Router);

    readonly userId = input.required<string>();
    readonly tab = input<TabType>('followers');

    readonly followers = signal<FollowUserDto[]>([]);
    readonly following = signal<FollowUserDto[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    readonly followersCount = signal(0);
    readonly followingCount = signal(0);

    readonly activeTab = computed(() => this.tab());
    readonly currentList = computed(() =>
        this.activeTab() === 'followers' ? this.followers() : this.following()
    );
    readonly currentUserId = computed(() => this.sessionService.userId());
    readonly isOwnProfile = computed(() => this.currentUserId() === this.userId());

    constructor() {
        void this.loadData();
    }

    async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const userId = this.userId();

            // Load counts
            const [followersCount, followingCount] = await Promise.all([
                firstValueFrom(this.followsApi.getFollowersCount(userId)),
                firstValueFrom(this.followsApi.getFollowingCount(userId)),
            ]);

            this.followersCount.set(followersCount);
            this.followingCount.set(followingCount);

            // Load list based on active tab
            if (this.activeTab() === 'followers') {
                const data = await firstValueFrom(this.followsApi.getFollowers(userId, { limit: 50 }));
                this.followers.set(data);
            } else {
                const data = await firstValueFrom(this.followsApi.getFollowing(userId, { limit: 50 }));
                this.following.set(data);
            }
        } catch (err) {
            this.error.set(getErrorMessage(err, 'No se pudieron cargar los datos'));
        } finally {
            this.loading.set(false);
        }
    }

    async switchTab(tab: TabType): Promise<void> {
        await this.router.navigate([], {
            queryParams: { tab },
            queryParamsHandling: 'merge',
        });
        await this.loadData();
    }

    navigateToProfile(userId: string): void {
        void this.router.navigate(['/profile', userId]);
    }

    toUserDto(user: FollowUserDto): UserDto {
        return {
            userId: user.userId,
            fullName: user.fullName,
            email: user.email,
            biography: user.biography,
            profilePhotoUrl: user.profilePhotoUrl ?? null,
        };
    }

    trackUser(index: number, user: FollowUserDto): string {
        return user.userId;
    }
}
