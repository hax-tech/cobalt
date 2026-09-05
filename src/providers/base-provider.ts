export interface ProviderHealthStatus {
  available: boolean;
  statusMessage: string;
  version?: string;
}

export interface DownloadOptions {
  quality?: string;
  audioOnly?: boolean;
  format?: string;
}

export interface DownloadResult {
  provider: string;
  url: string;
  filename?: string;
  mediaType: 'video' | 'audio' | 'image';
  ext?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseProvider {
  abstract readonly name: string;

  /**
   * Performs an availability health-check on the provider instance.
   */
  abstract checkHealth(): Promise<ProviderHealthStatus>;

  /**
   * Processes the media URL and returns download stream/redirect information.
   */
  abstract process(url: string, options?: DownloadOptions): Promise<DownloadResult>;

  /**
   * Returns true if this provider is known to handle this specific URL or domain.
   * Default implementation allows all valid URLs.
   */
  canHandle(_url: string): boolean {
    return true;
  }
}
