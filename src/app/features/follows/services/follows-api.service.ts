import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../../core/api/api-client.service';
import { PaginationQuery } from '../../../core/api/api.models';
import { FollowUserDto, IsFollowingResponse } from '../models/follows.models';

@Injectable({ providedIn: 'root' })
export class FollowsApiService {
    private readonly apiClient = inject(ApiClientService);
    private readonly baseUrl = '/api/follow';

    followUser(userId: string): Observable<null> {
        return this.apiClient.post<null, object>(`${this.baseUrl}/${userId}/follow`, {});
    }

    unfollowUser(userId: string): Observable<null> {
        return this.apiClient.delete<null>(`${this.baseUrl}/${userId}/unfollow`);
    }

    isFollowing(userId: string): Observable<IsFollowingResponse> {
        return this.apiClient.get<IsFollowingResponse>(`${this.baseUrl}/${userId}/is-following`);
    }

    getFollowers(userId: string, query?: PaginationQuery): Observable<FollowUserDto[]> {
        return this.apiClient.get<FollowUserDto[], PaginationQuery>(`${this.baseUrl}/${userId}/followers`, query);
    }

    getFollowing(userId: string, query?: PaginationQuery): Observable<FollowUserDto[]> {
        return this.apiClient.get<FollowUserDto[], PaginationQuery>(`${this.baseUrl}/${userId}/following`, query);
    }

    getFollowersCount(userId: string): Observable<number> {
        return this.apiClient.get<number>(`${this.baseUrl}/${userId}/followers/count`);
    }

    getFollowingCount(userId: string): Observable<number> {
        return this.apiClient.get<number>(`${this.baseUrl}/${userId}/following/count`);
    }
}
