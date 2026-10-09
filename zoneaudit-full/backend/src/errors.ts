export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = 'Chưa đăng nhập') => new HttpError(401, m);
export const forbidden = (m = 'Bạn không có quyền thực hiện thao tác này') => new HttpError(403, m);
export const notFound = (m = 'Không tìm thấy') => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);
