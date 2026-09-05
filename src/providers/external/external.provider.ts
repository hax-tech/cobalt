import { BaseProvider, ProviderHealthStatus, DownloadResult, DownloadOptions } from '../base-provider.js';
import { config } from '../../config/index.js';

export class ExternalApiProvider extends BaseProvider {
  public readonly name = 'external-api';
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor() {
    super();
    this.baseUrl = config.externalApi.url;
    this.apiKey = config.externalApi.apiKey;
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    if (!this.baseUrl) {
      return {
        available: false,
        statusMessage: 'External API is not configured (missing EXTERNAL_API_URL)',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        available: response.ok,
        statusMessage: response.ok ? 'External API is reachable' : `External API returned status ${response.status}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        statusMessage: `External API is unreachable: ${msg}`,
      };
    }
  }

  async process(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    if (!this.baseUrl) {
      throw new Error('External API is not configured');
    }

    const response = await fetch(`${this.baseUrl}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ url, ...options }),
    });

    if (!response.ok) {
      throw new Error(`External API returned status ${response.status}`);
    }

    const data = await response.json() as { url: string; filename?: string };
    return {
      provider: this.name,
      url: data.url,
      filename: data.filename,
      mediaType: options.audioOnly ? 'audio' : 'video',
    };
  }
}
