import './env.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { initDb } from './db.js';
import { getChannel } from './sse.js';
import { runAgent } from './agent/index.js';
import { runMockScript } from './mock/script.js';
import { startReachablePoller, setActiveRunId } from './reachable.js';

const PORT = Number(process.env.PORT ?? 4000);
const MOCK = process.env.MOCK === '1';

initDb();
console.log(`[db] seeded fresh demo db${MOCK ? ' (practice mode)' : ''}`);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mock: MOCK });
});

app.post('/api/run', (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Reseed before every run, not just on server boot. Without this, the
  // second rehearsal in the same `npm start` session would find the
  // columns already dropped from the first run and the demo would go
  // sideways live -- same demo every single run, not just every restart.
  initDb();
  console.log('[db] reseeded for new run');

  const runId = randomUUID();
  setActiveRunId(runId);

  const runner = MOCK ? runMockScript(runId, prompt) : runAgent(runId, prompt);
  runner.catch((err) => {
    console.error(`[run ${runId}] failed:`, err instanceof Error ? err.message : err);
  });

  res.json({ runId, mock: MOCK });
});

app.get('/api/stream/:runId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const channel = getChannel(req.params.runId);
  channel.subscribe(res);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    channel.unsubscribe(res);
  });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}${MOCK ? ' [PRACTICE MODE]' : ''}`);
  if (!MOCK) {
    startReachablePoller();
  } else {
    console.log('[reachable-poller] skipped in practice mode -- no Twilio account needed');
  }
});
