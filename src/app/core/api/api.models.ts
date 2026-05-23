export interface GenericResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: string[];
  timeStamp: string;
}

export interface ProblemDetails {
  status?: number;
  title?: string;
  detail?: string;
  traceId?: string;
  timestamp?: string;
  message?: string;
  errors?: string[] | Record<string, string[]>;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface JsonRecord {
  [key: string]: unknown;
}
