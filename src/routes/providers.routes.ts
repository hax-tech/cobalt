import { Router, Request, Response } from 'express';
import { providerManager } from '../providers/provider-manager.js';

export const providersRouter = Router();

providersRouter.get('/api/providers', async (_req: Request, res: Response) => {
  const statuses = await providerManager.getProvidersStatus();
  const fallbackOrder = providerManager.getFallbackOrder();

  res.json({
    status: 'success',
    providers: statuses,
    fallbackOrder,
  });
});
