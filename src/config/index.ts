import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  cobalt: {
    url: string;
    apiKey?: string;
    timeoutMs: number;
  };
  externalApi: {
    url?: string;
    apiKey?: string;
    timeoutMs: number;
  };
  ytdlp: {
    path: string;
    timeoutMs: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export const config: AppConfig = {
  port: 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  cobalt: {
    url: (process.env.COBALT_URL || 'https://api.cobalt.tools').replace(/\/+$/, ''),
    apiKey: process.env.COBALT_API_KEY || undefined,
    timeoutMs: parseInt(process.env.COBALT_TIMEOUT_MS || '15000', 10),
  },
  externalApi: {
    url: process.env.EXTERNAL_API_URL ? process.env.EXTERNAL_API_URL.replace(/\/+$/, '') : undefined,
    apiKey: process.env.EXTERNAL_API_KEY || undefined,
    timeoutMs: parseInt(process.env.EXTERNAL_API_TIMEOUT_MS || '15000', 10),
  },
  ytdlp: {
    path: process.env.YTDLP_PATH || 'yt-dlp',
    timeoutMs: parseInt(process.env.YTDLP_TIMEOUT_MS || '20000', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};
