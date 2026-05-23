import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { buildHttpParams, unwrapApiResponse } from './api.utils';
import { GenericResponse } from './api.models';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  get<T, TQuery extends object = never>(path: string, query?: TQuery): Observable<T> {
    return this.http
      .get<T | GenericResponse<T>>(this.toUrl(path), { params: buildHttpParams(query) })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  post<TResponse, TBody extends object>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .post<TResponse | GenericResponse<TResponse>>(this.toUrl(path), body)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  put<TResponse, TBody extends object>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .put<TResponse | GenericResponse<TResponse>>(this.toUrl(path), body)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  patch<TResponse, TBody extends object>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .patch<TResponse | GenericResponse<TResponse>>(this.toUrl(path), body)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  delete<TResponse>(path: string): Observable<TResponse> {
    return this.http
      .delete<TResponse | GenericResponse<TResponse>>(this.toUrl(path))
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private toUrl(path: string): string {
    return `${this.apiBaseUrl}${path}`;
  }
}
