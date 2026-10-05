// Single shape for every error the API sends; the frontend reads `code`.
export const buildErrorResponse = (
  status: number,
  path: string,
  {
    code,
    params,
    message,
  }: { code: string; params?: unknown; message?: unknown },
) => ({
  statusCode: status,
  code,
  params,
  // Server-side details (provider errors, config) stay in the logs.
  message: status >= 500 || message === undefined ? code : message,
  timestamp: new Date().toISOString(),
  path,
});
