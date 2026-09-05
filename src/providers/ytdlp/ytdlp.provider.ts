import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseProvider, ProviderHealthStatus, DownloadResult, DownloadOptions } from '../base-provider.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);

export class YtdlpProvider extends BaseProvider {
  public readonly name = 'yt-dlp';
  private readonly binPath: string;

  constructor(binPath?: string) {
    super();
    this.binPath = binPath || config.ytdlp.path;
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    try {
      const { stdout } = await execFileAsync(this.binPath, ['--version'], { timeout: 4000 });
      const version = stdout.trim();
      return {
        available: true,
        statusMessage: `yt-dlp is available (v${version})`,
        version,
      };
    } catch {
      return {
        available: false,
        statusMessage: `yt-dlp binary "${this.binPath}" is not found or not executable`,
      };
    }
  }

  async process(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    logger.debug(`Processing URL with yt-dlp: ${url}`);
    try {
      const args = ['--dump-single-json', '--no-warnings', '--no-playlist'];

      if (options.audioOnly) {
        args.push('-x', '--audio-format', options.format || 'mp3');
      }

      args.push(url);

      const { stdout } = await execFileAsync(this.binPath, args, { timeout: config.ytdlp.timeoutMs });
      const info = JSON.parse(stdout);

      const directUrl = info.url || (info.formats && info.formats.length > 0 ? info.formats[info.formats.length - 1].url : null);
      if (!directUrl) {
        throw new Error('yt-dlp could not extract a media URL');
      }

      return {
        provider: this.name,
        url: directUrl,
        filename: info.title ? `${info.title}.${options.audioOnly ? (options.format || 'mp3') : (info.ext || 'mp4')}` : undefined,
        mediaType: options.audioOnly ? 'audio' : 'video',
        metadata: {
          title: info.title,
          duration: info.duration,
          uploader: info.uploader,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`yt-dlp failed to process media: ${msg}`);
    }
  }
}
