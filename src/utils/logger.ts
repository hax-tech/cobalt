export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private prefix: string;

  constructor(prefix: string = 'HaxDownloader') {
    this.prefix = prefix;
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${typeof meta === 'object' ? JSON.stringify(meta) : String(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      console.debug(this.format('debug', message, meta));
    }
  }

  info(message: string, meta?: unknown): void {
    console.info(this.format('info', message, meta));
  }

  warn(message: string, meta?: unknown): void {
    console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: unknown): void {
    console.error(this.format('error', message, meta));
  }
}

export const logger = new Logger('App');
