import { BaseProvider, ProviderHealthStatus, DownloadResult, DownloadOptions } from '../base-provider.js';
import { CobaltApiResponse, CobaltInstanceInfo } from './cobalt.types.js';
import { logger } from '../../utils/logger.js';

export interface CobaltProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class CobaltProvider extends BaseProvider {
  public readonly name = 'cobalt';
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: CobaltProviderConfig = {}) {
    super();
    this.baseUrl = (options.baseUrl || process.env.COBALT_URL || 'https://api.cobalt.tools').replace(/\/+$/, '');
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.COBALT_API_KEY;
    this.timeoutMs = options.timeoutMs || 15000;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers['Authorization'] = `Api-Key ${this.apiKey.trim()}`;
    }

    return headers;
  }

  /**
   * Health-check for Cobalt using the current API contract.
   * Cobalt serves instance info via GET / with Accept: application/json.
   * Probing GET / tests reachability without consuming media download rate-limits
   * and prevents 400 Bad Request responses caused by empty POST bodies.
   */
  async checkHealth(): Promise<ProviderHealthStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey && this.apiKey.trim().length > 0) {
        headers['Authorization'] = `Api-Key ${this.apiKey.trim()}`;
      }

      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json().catch(() => null) as CobaltInstanceInfo | null;
        const version = data?.cobalt?.version ? ` (v${data.cobalt.version})` : '';
        return {
          available: true,
          statusMessage: `Cobalt API is reachable${version}`,
          version: data?.cobalt?.version,
        };
      }

      // If status is 400 or other error, extract diagnostic information
      const errorJson = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      const diagnostic = errorJson?.error?.code ? ` [${errorJson.error.code}]` : '';

      return {
        available: false,
        statusMessage: `Cobalt API returned status ${response.status}${diagnostic}`,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort ? 'Request timed out after 5000ms' : (err instanceof Error ? err.message : String(err));
      return {
        available: false,
        statusMessage: `Cobalt API is unreachable: ${msg}`,
      };
    }
  }

  /**
   * Process a media URL with Cobalt using the current POST / contract.
   */
  async process(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const bodyPayload: Record<string, unknown> = {
        url,
      };

      if (options.audioOnly) {
        bodyPayload.downloadMode = 'audio';
      }
      if (options.quality) {
        bodyPayload.videoQuality = options.quality;
      }

      logger.debug(`Sending POST request to Cobalt at ${this.baseUrl}/`, { url });

      const response = await fetch(`${this.baseUrl}/`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await response.text();
      let data: CobaltApiResponse | null = null;
      try {
        data = JSON.parse(rawText) as CobaltApiResponse;
      } catch {
        throw new Error(`Cobalt returned malformed JSON (HTTP ${response.status})`);
      }

      if (!response.ok || !data) {
        if (data && 'status' in data && data.status === 'error') {
          const code = data.error?.code || 'unknown_error';
          throw new Error(`Cobalt API error: ${code}`);
        }
        throw new Error(`Cobalt API returned status ${response.status}`);
      }

      switch (data.status) {
        case 'tunnel':
        case 'redirect':
          return {
            provider: this.name,
            url: data.url,
            filename: data.filename,
            mediaType: options.audioOnly ? 'audio' : 'video',
          };

        case 'picker':
          if (data.picker && data.picker.length > 0) {
            const firstItem = data.picker[0];
            return {
              provider: this.name,
              url: firstItem.url,
              filename: `cobalt-picker-${Date.now()}`,
              mediaType: firstItem.type === 'photo' ? 'image' : 'video',
              metadata: {
                totalItems: data.picker.length,
                audio: data.audio,
              },
            };
          }
          throw new Error('Cobalt returned an empty picker list');

        case 'local-processing':
          if (data.tunnel && data.tunnel.length > 0) {
            return {
              provider: this.name,
              url: data.tunnel[0],
              filename: data.output?.filename || `cobalt-${Date.now()}`,
              mediaType: options.audioOnly ? 'audio' : 'video',
              metadata: {
                tunnelStreams: data.tunnel,
                output: data.output,
              },
            };
          }
          throw new Error('Cobalt local-processing returned no tunnel streams');

        case 'error':
          throw new Error(`Cobalt API error: ${data.error?.code || 'unknown'}`);

        default:
          throw new Error(`Cobalt returned unsupported status response`);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Cobalt request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }
}
