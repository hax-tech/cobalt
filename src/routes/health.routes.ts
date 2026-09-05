import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
