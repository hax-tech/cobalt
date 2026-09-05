import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CobaltProvider } from '../src/providers/cobalt/cobalt.provider.js';

describe('CobaltProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends valid Cobalt request to POST / with required headers and payload', async () => {
    const provider = new CobaltProvider({
      baseUrl: 'https://api.cobalt.tools',
    });

    const mockResponse = {
      status: 'tunnel',
      url: 'https://api.cobalt.tools/tunnel/video-123.mp4',
      filename: 'sample-video.mp4',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.process('https://youtube.com/watch?v=sample');

    expect(fetchMock).toHaveBeenCalledWith('https://api.cobalt.tools/', expect.objectContaining({
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://youtube.com/watch?v=sample' }),
    }));
    expect(result.url).toBe('https://api.cobalt.tools/tunnel/video-123.mp4');
    expect(result.filename).toBe('sample-video.mp4');
    expect(result.provider).toBe('cobalt');
  });

  it('includes Authorization: Api-Key <key> only when COBALT_API_KEY is configured', async () => {
    const provider = new CobaltProvider({
      baseUrl: 'https://api.cobalt.tools',
      apiKey: 'secret-token-xyz',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'redirect',
        url: 'https://cdn.example.com/audio.mp3',
        filename: 'audio.mp3',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await provider.process('https://soundcloud.com/sample', { audioOnly: true });

    expect(fetchMock).toHaveBeenCalledWith('https://api.cobalt.tools/', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Api-Key secret-token-xyz',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        url: 'https://soundcloud.com/sample',
        downloadMode: 'audio',
      }),
    }));
  });

  it('maps 400 error response to informative error message with machine-readable code', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        status: 'error',
        error: {
          code: 'error.api.link.missing',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(provider.process('')).rejects.toThrow('Cobalt API error: error.api.link.missing');
  });

  it('handles successful redirect response', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'redirect',
        url: 'https://direct-stream.video/file.mp4',
        filename: 'direct.mp4',
      }),
    }));

    const result = await provider.process('https://twitter.com/i/status/123');
    expect(result.url).toBe('https://direct-stream.video/file.mp4');
    expect(result.filename).toBe('direct.mp4');
  });

  it('handles successful tunnel/stream response', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'tunnel',
        url: 'https://tunnel.cobalt.tools/media.mp4',
        filename: 'stream.mp4',
      }),
    }));

    const result = await provider.process('https://tiktok.com/@user/video/123');
    expect(result.url).toBe('https://tunnel.cobalt.tools/media.mp4');
    expect(result.filename).toBe('stream.mp4');
  });

  it('handles picker response for slideshows or multiple media items', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: 'picker',
        picker: [
          { type: 'photo', url: 'https://cdn.example.com/photo1.jpg' },
          { type: 'photo', url: 'https://cdn.example.com/photo2.jpg' },
        ],
      }),
    }));

    const result = await provider.process('https://tiktok.com/@user/photo/123');
    expect(result.url).toBe('https://cdn.example.com/photo1.jpg');
    expect(result.mediaType).toBe('image');
  });

  it('reports unavailable when instance is unreachable or network fails', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://unreachable.invalid' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const health = await provider.checkHealth();
    expect(health.available).toBe(false);
    expect(health.statusMessage).toContain('Connection refused');
  });

  it('handles timeout when processing exceeds timeout duration', async () => {
    const provider = new CobaltProvider({
      baseUrl: 'https://api.cobalt.tools',
      timeoutMs: 50,
    });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 60);
      });
    }));

    await expect(provider.process('https://youtube.com/watch?v=timeout')).rejects.toThrow(/timed out/i);
  });

  it('handles malformed non-JSON responses from Cobalt gracefully', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>502 Bad Gateway</html>',
    }));

    await expect(provider.process('https://youtube.com/watch?v=bad')).rejects.toThrow('Cobalt returned malformed JSON (HTTP 502)');
  });

  it('uses GET / for health checks without triggering 400 Bad Request', async () => {
    const provider = new CobaltProvider({ baseUrl: 'https://api.cobalt.tools' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cobalt: {
          version: '11.7.0',
          services: ['youtube', 'twitter', 'tiktok'],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const health = await provider.checkHealth();
    expect(health.available).toBe(true);
    expect(health.statusMessage).toBe('Cobalt API is reachable (v11.7.0)');
    expect(fetchMock).toHaveBeenCalledWith('https://api.cobalt.tools/', expect.objectContaining({
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }));
  });
});
