import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

interface ClientTracker {
  count: number;
  resetAt: number;
}

const clientMap = new Map<string, ClientTracker>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown-client';
  const now = Date.now();

  const record = clientMap.get(ip);
  if (!record || now > record.resetAt) {
    clientMap.set(ip, {
      count: 1,
      resetAt: now + config.rateLimit.windowMs,
    });
    next();
    return;
  }

  record.count += 1;
  if (record.count > config.rateLimit.maxRequests) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil((record.resetAt - now) / 1000)} seconds.`,
    });
    return;
  }

  next();
}
