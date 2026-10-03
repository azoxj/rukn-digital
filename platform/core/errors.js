export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const notFound = (what = "العنصر") => new HttpError(404, `${what} غير موجود`);
export const forbidden = () => new HttpError(403, "ليست لديك صلاحية لتنفيذ هذا الإجراء");
export const unauthorized = () => new HttpError(401, "يجب تسجيل الدخول");
export const conflict = (msg) => new HttpError(409, msg);
export const badRequest = (msg, fields) => new HttpError(400, msg, fields);
