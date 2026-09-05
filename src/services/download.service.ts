import { validateSafeUrl } from '../utils/ssrf.js';
import { providerManager, ProviderManager } from '../providers/provider-manager.js';
import { DownloadOptions, DownloadResult } from '../providers/base-provider.js';
import { db } from '../db/index.js';

export class DownloadService {
  constructor(private manager: ProviderManager = providerManager) {}

  async processUrl(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    // 1. SSRF and URL validation
    const validation = validateSafeUrl(url);
    if (!validation.valid || !validation.url) {
      throw new Error(`URL validation failed: ${validation.error || 'Invalid URL'}`);
    }

    // 2. Attempt download via fallback order (yt-dlp -> cobalt -> external)
    const result = await this.manager.processWithFallback(url, options);

    // 3. Record download transaction in db abstraction
    await db.saveDownloadRecord({
      sourceUrl: url,
      provider: result.provider,
      mediaType: result.mediaType,
      filename: result.filename,
      timestamp: new Date().toISOString(),
      success: true,
    });

    return result;
  }
}

export const downloadService = new DownloadService();
