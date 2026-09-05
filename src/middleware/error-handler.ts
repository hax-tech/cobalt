import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  logger.error('Unhandled request error:', message);

  const statusCode = (err as { status?: number }).status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Request Error',
    message,
  });
}
