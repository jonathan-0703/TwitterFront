export interface LoginRequest {
  email: string;
  password: string;
}

export interface RenewRequest {
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: string[];
  timeStamp: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export interface ApiErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
}
