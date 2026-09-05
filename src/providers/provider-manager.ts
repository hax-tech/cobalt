import { BaseProvider, ProviderHealthStatus, DownloadResult, DownloadOptions } from './base-provider.js';
import { YtdlpProvider } from './ytdlp/ytdlp.provider.js';
import { CobaltProvider } from './cobalt/cobalt.provider.js';
import { ExternalApiProvider } from './external/external.provider.js';
import { logger } from '../utils/logger.js';

export class ProviderManager {
  private providers: Map<string, BaseProvider> = new Map();
  // Strictly enforce fallback order: yt-dlp -> cobalt -> external
  private fallbackOrder: string[] = ['yt-dlp', 'cobalt', 'external-api'];

  constructor(customProviders?: BaseProvider[]) {
    if (customProviders) {
      for (const p of customProviders) {
        this.providers.set(p.name, p);
      }
    } else {
      const ytdlp = new YtdlpProvider();
      const cobalt = new CobaltProvider();
      const external = new ExternalApiProvider();

      this.providers.set(ytdlp.name, ytdlp);
      this.providers.set(cobalt.name, cobalt);
      this.providers.set(external.name, external);
    }
  }

  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  getFallbackOrder(): string[] {
    return [...this.fallbackOrder];
  }

  /**
   * Health checks all registered providers.
   */
  async getProvidersStatus(): Promise<Record<string, ProviderHealthStatus>> {
    const statuses: Record<string, ProviderHealthStatus> = {};

    for (const name of this.fallbackOrder) {
      const provider = this.providers.get(name);
      if (provider) {
        try {
          statuses[name] = await provider.checkHealth();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          statuses[name] = {
            available: false,
            statusMessage: `Health check failed: ${msg}`,
          };
        }
      } else {
        statuses[name] = {
          available: false,
          statusMessage: 'Provider not registered',
        };
      }
    }

    return statuses;
  }

  /**
   * Processes a media URL using the fallback order:
   * yt-dlp -> cobalt -> external-api
   */
  async processWithFallback(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const name of this.fallbackOrder) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      if (!provider.canHandle(url)) {
        logger.debug(`Provider ${name} cannot handle URL: ${url}, skipping`);
        continue;
      }

      try {
        logger.info(`Attempting download with provider: ${name}`);
        const result = await provider.process(url, options);
        logger.info(`Provider ${name} succeeded for ${url}`);
        return result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`Provider ${name} failed: ${errorMsg}`);
        errors.push({ provider: name, error: errorMsg });
      }
    }

    const summary = errors.map((e) => `[${e.provider}: ${e.error}]`).join('; ');
    throw new Error(`All providers failed to process media. Attempts: ${summary}`);
  }
}

export const providerManager = new ProviderManager();
