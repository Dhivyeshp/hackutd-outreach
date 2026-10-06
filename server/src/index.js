import express from 'express';
import { randomUUID } from 'node:crypto';
import { resolveDomain, scrapeSchool } from './crawler.js';

const PORT = process.env.PORT ?? 3001;
const MAX_SCHOOLS = 200;
const SCHOOL_CONCURRENCY = 3;
const CSV_COLUMNS = ['university', 'name', 'email', 'title', 'department', 'source'];

// undici can throw from socket events that no try/catch sees; one bad site must not kill the API.
process.on('uncaughtException', (err) => process.stderr.write(`uncaught: ${err.message}\n`));
process.on('unhandledRejection', (err) => process.stderr.write(`unhandled: ${err?.message ?? err}\n`));

const jobs = new Map();
const app = express();
app.use(express.json({ limit: '256kb' }));

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows) =>
  [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\n');

/** Accepts "Name", "domain.edu", or "Name | domain.edu" per line. */
function parseSchools(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SCHOOLS)
    .map((line) => {
      const [name, domain] = line.split('|').map((p) => p.trim());
      return { name, domain: domain || '' };
    });
}

function publicJob(job) {
  return { id: job.id, status: job.status, schools: job.schools, total: job.rows.length };
}

function emit(job) {
  const payload = `data: ${JSON.stringify(publicJob(job))}\n\n`;
  for (const res of job.listeners) res.write(payload);
}

async function runSchool(job, school, perSchool) {
  const update = (patch) => {
    Object.assign(school, patch);
    emit(job);
  };
  try {
    update({ status: 'resolving' });
    const domain = await resolveDomain(school.domain || school.name, job.abort.signal);
    update({ domain, status: 'running' });
    const people = await scrapeSchool({
      domain,
      limit: perSchool,
      signal: job.abort.signal,
      onProgress: (p) => update({ pages: p.pages, found: p.found }),
    });
    job.rows.push(...people.map((p) => ({ university: school.name, ...p })));
    update({ found: people.length, status: people.length ? 'done' : 'empty' });
  } catch (err) {
    update({ status: job.abort.signal.aborted ? 'cancelled' : 'error', error: err.message });
  }
}

async function runJob(job, perSchool) {
  const pending = [...job.schools];
  const worker = async () => {
    while (pending.length && !job.abort.signal.aborted) await runSchool(job, pending.shift(), perSchool);
  };
  await Promise.all(Array.from({ length: SCHOOL_CONCURRENCY }, worker));
  job.status = job.abort.signal.aborted ? 'cancelled' : 'done';
  emit(job);
}

app.post('/api/jobs', (req, res) => {
  const schools = parseSchools(req.body?.universities);
  const perSchool = Math.min(Math.max(Number.parseInt(req.body?.perSchool, 10) || 100, 1), 1000);
  if (!schools.length) return res.status(400).json({ error: 'Provide at least one university.' });
  const job = {
    id: randomUUID(),
    status: 'running',
    rows: [],
    listeners: new Set(),
    abort: new AbortController(),
    schools: schools.map((s) => ({ ...s, status: 'queued', pages: 0, found: 0 })),
  };
  jobs.set(job.id, job);
  runJob(job, perSchool);
  res.status(201).json(publicJob(job));
});

app.get('/api/jobs/:id/events', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
  job.listeners.add(res);
  req.on('close', () => job.listeners.delete(res));
});

app.get('/api/jobs/:id/rows', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  res.json(job.rows);
});

app.get('/api/jobs/:id/csv', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  res.set({ 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="faculty.csv"' });
  res.send(toCsv(job.rows));
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  job.abort.abort();
  res.json({ ok: true });
});

app.listen(PORT, () => process.stdout.write(`API on http://localhost:${PORT}\n`));
