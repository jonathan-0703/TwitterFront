import { HttpErrorResponse, HttpParams } from '@angular/common/http';

import { GenericResponse, JsonRecord, ProblemDetails } from './api.models';

export function unwrapApiResponse<T>(payload: T | GenericResponse<T>): T {
  if (isGenericResponse(payload)) {
    return payload.data;
  }

  return payload;
}

export function buildHttpParams(query?: object): HttpParams {
  let params = new HttpParams();

  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    params = params.set(key, String(value));
  }

  return params;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const details = error.error as ProblemDetails | string | undefined;

    if (typeof details === 'string' && details.trim()) {
      return details;
    }

    if (details && typeof details === 'object') {
      const fieldErrors = flattenProblemErrors(details.errors);

      return (
        details.message?.trim() ||
        details.detail?.trim() ||
        details.title?.trim() ||
        fieldErrors ||
        fallback
      );
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function isGenericResponse<T>(payload: T | GenericResponse<T>): payload is GenericResponse<T> {
  return Boolean(payload && typeof payload === 'object' && 'data' in (payload as object) && 'message' in (payload as object));
}

function flattenProblemErrors(errors: ProblemDetails['errors']): string {
  if (!errors) {
    return '';
  }

  if (Array.isArray(errors)) {
    return errors.join(', ');
  }

  return Object.values(errors)
    .flat()
    .join(', ');
}
