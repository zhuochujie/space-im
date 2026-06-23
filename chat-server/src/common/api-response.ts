export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
  path?: string;
}

export const SUCCESS_CODE = 0;
export const SUCCESS_MESSAGE = 'success';
