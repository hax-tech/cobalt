import { Router, Request, Response, NextFunction } from 'express';
import { downloadService } from '../services/download.service.js';
import { db } from '../db/index.js';

export const downloadRouter = Router();

downloadRouter.post('/api/download', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { url, quality, audioOnly, format } = req.body || {};

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'The "url" field is required and must be a valid string.',
      });
      return;
    }

    const result = await downloadService.processUrl(url, {
      quality,
      audioOnly: Boolean(audioOnly),
      format,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

downloadRouter.get('/api/downloads/history', async (_req: Request, res: Response) => {
  const history = await db.getRecentDownloads(20);
  res.json({
    status: 'success',
    data: history,
  });
});
