export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorBody<T = undefined> {
  success: false;
  message: string;
  errors?: ApiFieldError[];
  data?: T;
}

export function successResponse<T>(
  data: T,
  message = 'Success',
): ApiSuccessBody<T> {
  return { success: true, message, data };
}

/**
 * `data` is an intentional small extension: used for the duplicate-kill
 * 409, where the client needs the previous kill's details (who logged it,
 * when) to render the "log anyway?" prompt - that's not a field-validation
 * error, so it doesn't belong in `errors`.
 */
export function errorResponse<T = undefined>(
  message: string,
  errors?: ApiFieldError[],
  data?: T,
): ApiErrorBody<T> {
  return {
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}
