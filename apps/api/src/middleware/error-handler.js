export function errorHandler(error, _req, res, _next) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "服务器内部错误" });
}
