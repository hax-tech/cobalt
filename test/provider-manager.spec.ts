import { describe, it, expect, vi } from 'vitest';
import { ProviderManager } from '../src/providers/provider-manager.js';
import { BaseProvider, ProviderHealthStatus, DownloadResult } from '../src/providers/base-provider.js';
import { validateSafeUrl } from '../src/utils/ssrf.js';

class MockProvider extends BaseProvider {
  constructor(
    public readonly name: string,
    private shouldFail: boolean = false,
    private resultUrl: string = 'https://mock.example/video.mp4'
  ) {
    super();
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    return {
      available: !this.shouldFail,
      statusMessage: this.shouldFail ? 'Mock unavailable' : 'Mock available',
    };
  }

  async process(_url: string): Promise<DownloadResult> {
    if (this.shouldFail) {
      throw new Error(`Mock error from ${this.name}`);
    }
    return {
      provider: this.name,
      url: this.resultUrl,
      mediaType: 'video',
    };
  }
}

describe('ProviderManager and Fallback Order', () => {
  it('strictly preserves the fallback order: yt-dlp -> cobalt -> external-api', async () => {
    const ytdlp = new MockProvider('yt-dlp', true); // fails
    const cobalt = new MockProvider('cobalt', false, 'https://cobalt.mock/file.mp4'); // succeeds
    const external = new MockProvider('external-api', false); // should not be reached

    const manager = new ProviderManager([ytdlp, cobalt, external]);
    expect(manager.getFallbackOrder()).toEqual(['yt-dlp', 'cobalt', 'external-api']);

    const result = await manager.processWithFallback('https://example.com/video');
    expect(result.provider).toBe('cobalt');
    expect(result.url).toBe('https://cobalt.mock/file.mp4');
  });

  it('falls back to external-api when both yt-dlp and cobalt fail', async () => {
    const ytdlp = new MockProvider('yt-dlp', true);
    const cobalt = new MockProvider('cobalt', true);
    const external = new MockProvider('external-api', false, 'https://external.mock/file.mp4');

    const manager = new ProviderManager([ytdlp, cobalt, external]);
    const result = await manager.processWithFallback('https://example.com/video');
    expect(result.provider).toBe('external-api');
    expect(result.url).toBe('https://external.mock/file.mp4');
  });

  it('throws error when all providers fail', async () => {
    const ytdlp = new MockProvider('yt-dlp', true);
    const cobalt = new MockProvider('cobalt', true);
    const external = new MockProvider('external-api', true);

    const manager = new ProviderManager([ytdlp, cobalt, external]);
    await expect(manager.processWithFallback('https://example.com/video')).rejects.toThrow(
      /All providers failed/
    );
  });

  it('calls checkHealth() on providers and populates both available and isAvailable', async () => {
    const ytdlp = new MockProvider('yt-dlp', false);
    const cobalt = new MockProvider('cobalt', false);
    const external = new MockProvider('external-api', true);

    const checkHealthSpy = vi.spyOn(cobalt, 'checkHealth');

    const manager = new ProviderManager([ytdlp, cobalt, external]);
    const statuses = await manager.getProvidersStatus();

    expect(checkHealthSpy).toHaveBeenCalledTimes(1);
    expect(statuses['cobalt'].available).toBe(true);
    expect(statuses['cobalt'].isAvailable).toBe(true);
    expect(statuses['yt-dlp'].available).toBe(true);
    expect(statuses['yt-dlp'].isAvailable).toBe(true);
    expect(statuses['external-api'].available).toBe(false);
    expect(statuses['external-api'].isAvailable).toBe(false);
  });
});

describe('SSRF Protection & URL Validation', () => {
  it('allows safe public URLs', () => {
    expect(validateSafeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').valid).toBe(true);
    expect(validateSafeUrl('https://x.com/status/123').valid).toBe(true);
  });

  it('blocks loopback and localhost addresses', () => {
    expect(validateSafeUrl('http://localhost:8080').valid).toBe(false);
    expect(validateSafeUrl('http://127.0.0.1:3000').valid).toBe(false);
  });

  it('blocks cloud metadata endpoint 169.254.169.254', () => {
    expect(validateSafeUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
  });

  it('blocks private RFC 1918 subnets', () => {
    expect(validateSafeUrl('http://10.0.0.1/video').valid).toBe(false);
    expect(validateSafeUrl('http://192.168.1.1/video').valid).toBe(false);
    expect(validateSafeUrl('http://172.20.0.1/video').valid).toBe(false);
  });
});
