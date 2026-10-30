export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error instanceof ApiError ? error.message : 'تعذّر تنفيذ الطلب حاليًا، يرجى المحاولة مرة أخرى.';
  if (error.type === 'entity.too.large') { status = 413; code = 'BODY_TOO_LARGE'; message = 'حجم بيانات الطلب أكبر من المسموح.'; }
  if (error instanceof SyntaxError && error.status === 400) { status = 400; code = 'INVALID_JSON'; message = 'بيانات الطلب ليست بصيغة صحيحة.'; }
  if (status >= 500) req.log?.error('request_failed', { requestId: req.requestId, code: 'INTERNAL_ERROR' });
  res.status(status).json({ success: false, error: { code: typeof code === 'string' ? code : 'INTERNAL_ERROR', message, ...(error instanceof ApiError && error.details ? { details: error.details } : {}) }, requestId: req.requestId });
}
