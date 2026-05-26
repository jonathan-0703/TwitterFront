import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClientService } from '../../../core/api/api-client.service';
import { environment } from '../../../../environments/environment';
import { GenericResponse, JsonRecord } from '../../../core/api/api.models';
import { ChangePostStatusRequest, PostDto, PostListQuery, SavePostRequest } from '../models/posts.models';





@Injectable({ providedIn: 'root' })
export class PostsApiService {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);

  uploadMedia(file: File): Observable<{ mediaId: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<GenericResponse<{ mediaId: string; url: string }>>(`${environment.apiBaseUrl}/api/Media/upload`, formData)
      .pipe(map((response) => response.data));
  }

  createPost(payload: SavePostRequest): Observable<PostDto> {
    return this.api.post<PostDto, SavePostRequest>('/api/post/create', payload);
  }

  listPosts(query?: PostListQuery): Observable<PostDto[]> {
    return this.api.get<PostDto[], PostListQuery>('/api/post/list', query);
  }

  getPostById(id: string): Observable<PostDto> {
    return this.api.get<PostDto>(`/api/post/${id}`);
  }

  updatePost(id: string, payload: SavePostRequest): Observable<PostDto> {
    return this.api.put<PostDto, SavePostRequest>(`/api/post/${id}/update`, payload);
  }

  changeStatus(id: string, payload: ChangePostStatusRequest): Observable<PostDto> {
    return this.api.patch<PostDto, ChangePostStatusRequest>(`/api/post/${id}/change-status`, payload);
  }

  toggleLike(id: string): Observable<PostDto> {
    return this.api.post<PostDto, {}>(`/api/post/${id}/like`, {});
  }

  createComment(id: string, payload: { content: string }): Observable<PostDto> {
    return this.api.post<PostDto, { content: string }>(`/api/post/${id}/comment`, payload);
  }

  createRetweet(id: string, payload: { content?: string }): Observable<PostDto> {
    // Omit 'content' entirely for plain retweets to avoid backend validation errors
    const body = payload.content ? { content: payload.content } : {};
    return this.api.post<PostDto, { content?: string }>(`/api/post/${id}/retweet`, body);
  }

  deletePost(id: string): Observable<JsonRecord> {
    return this.api.delete<JsonRecord>(`/api/post/${id}/delete`);
  }
}
