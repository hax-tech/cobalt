import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { providersRouter } from './routes/providers.routes.js';
import { downloadRouter } from './routes/download.routes.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// Register API routes
app.use(healthRouter);
app.use(providersRouter);
app.use(downloadRouter);

// Clean interactive UI for previewing service status and testing providers
app.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hax Media Downloader</title>
  <meta property="og:title" content="Hax Media Downloader">
  <meta name="description" content="Production-ready media downloader service with yt-dlp, Cobalt, and external provider fallbacks">
  <meta property="og:description" content="Production-ready media downloader service with yt-dlp, Cobalt, and external provider fallbacks">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-neutral-900 text-neutral-100 min-h-screen p-6 antialiased">
  <div class="max-w-4xl mx-auto space-y-6">
    <header class="flex items-center justify-between border-b border-neutral-800 pb-5">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <span class="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          Hax Media Downloader
        </h1>
        <p class="text-sm text-neutral-400 mt-1">Fallback Engine: yt-dlp &rarr; Cobalt &rarr; External API</p>
      </div>
      <div class="flex items-center gap-2">
        <a href="/health" target="_blank" class="text-xs px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono transition">
          GET /health
        </a>
        <a href="/api/providers" target="_blank" class="text-xs px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono transition">
          GET /api/providers
        </a>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div id="card-ytdlp" class="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sm text-neutral-200">yt-dlp</span>
          <span id="badge-ytdlp" class="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-300">Checking...</span>
        </div>
        <p id="msg-ytdlp" class="text-xs text-neutral-400">Probing local executable...</p>
      </div>

      <div id="card-cobalt" class="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sm text-neutral-200">Cobalt</span>
          <span id="badge-cobalt" class="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-300">Checking...</span>
        </div>
        <p id="msg-cobalt" class="text-xs text-neutral-400">Probing instance contract...</p>
      </div>

      <div id="card-external" class="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sm text-neutral-200">External API</span>
          <span id="badge-external" class="text-xs px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-300">Checking...</span>
        </div>
        <p id="msg-external" class="text-xs text-neutral-400">Probing external service...</p>
      </div>
    </div>

    <section class="p-5 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-4">
      <h2 class="text-base font-semibold text-neutral-200">Test Download Processing</h2>
      <form id="download-form" class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1">Source URL</label>
          <input
            id="url-input"
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=..."
            class="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
            <input id="audio-only" type="checkbox" class="rounded border-neutral-700 text-emerald-500 focus:ring-0">
            Audio Only
          </label>
          <button
            type="submit"
            id="submit-btn"
            class="ml-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition cursor-pointer"
          >
            Process Download
          </button>
        </div>
      </form>
      <div id="output-box" class="hidden mt-4 p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto"></div>
    </section>

    <section class="p-5 rounded-xl bg-neutral-800/40 border border-neutral-800 space-y-3">
      <h2 class="text-base font-semibold text-neutral-200">Current Cobalt API Contract</h2>
      <ul class="text-xs text-neutral-300 space-y-1.5 list-disc pl-5">
        <li><strong>Main Endpoint:</strong> <code>POST /</code> (legacy <code>/api/json</code> deprecated & removed).</li>
        <li><strong>Headers:</strong> <code>Accept: application/json</code>, <code>Content-Type: application/json</code>.</li>
        <li><strong>Optional Auth:</strong> <code>Authorization: Api-Key &lt;key&gt;</code> (via <code>COBALT_API_KEY</code>).</li>
        <li><strong>Health Probing:</strong> <code>GET /</code> returns instance info and avoids empty-body 400 errors.</li>
        <li><strong>Supported Responses:</strong> <code>tunnel</code>, <code>redirect</code>, <code>picker</code>, <code>local-processing</code>, <code>error</code>.</li>
      </ul>
    </section>
  </div>

  <script>
    async function loadProviders() {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        const providers = data.providers || {};

        updateProvider('ytdlp', providers['yt-dlp']);
        updateProvider('cobalt', providers['cobalt']);
        updateProvider('external', providers['external-api']);
      } catch (err) {
        console.error('Failed to load providers:', err);
      }
    }

    function updateProvider(id, info) {
      const badge = document.getElementById('badge-' + id);
      const msg = document.getElementById('msg-' + id);
      if (!info) return;

      const isAvail = info.isAvailable !== undefined ? info.isAvailable : info.available;
      if (isAvail) {
        badge.className = 'text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        badge.textContent = 'available';
      } else {
        badge.className = 'text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30';
        badge.textContent = 'unavailable';
      }
      msg.textContent = info.statusMessage || '';
    }

    document.getElementById('download-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('url-input').value;
      const audioOnly = document.getElementById('audio-only').checked;
      const btn = document.getElementById('submit-btn');
      const output = document.getElementById('output-box');

      btn.disabled = true;
      btn.textContent = 'Processing...';
      output.classList.remove('hidden');
      output.textContent = 'Executing request across fallback providers...';

      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, audioOnly }),
        });
        const json = await res.json();
        output.textContent = JSON.stringify(json, null, 2);
      } catch (err) {
        output.textContent = 'Network or server error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Process Download';
      }
    });

    loadProviders();
  </script>
</body>
</html>`);
});

// Centralized error handling
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Hax Media Downloader running on port ${config.port}`);
  });
}
