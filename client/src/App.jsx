import { useEffect, useMemo, useRef, useState } from 'react';

const PLACEHOLDER = `University of Texas at Dallas
MIT | mit.edu
stanford.edu`;

const STATUS_LABEL = {
  queued: 'Queued',
  resolving: 'Finding site',
  running: 'Scraping',
  done: 'Done',
  empty: 'No emails',
  error: 'Error',
  cancelled: 'Cancelled',
};

function SchoolRow({ school, target }) {
  const pct = Math.min(100, Math.round((school.found / target) * 100));
  return (
    <li className="school">
      <div className="school-head">
        <span className="school-name">{school.name}</span>
        <span className={`badge badge-${school.status}`}>{STATUS_LABEL[school.status]}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="school-meta">
        <span>
          {school.found} / {target} emails
        </span>
        <span>{school.domain ?? ''}</span>
        <span>{school.pages} pages</span>
      </div>
      {school.error && <p className="error">{school.error}</p>}
    </li>
  );
}

export default function App() {
  const [text, setText] = useState('');
  const [perSchool, setPerSchool] = useState(100);
  const [job, setJob] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const source = useRef(null);

  const running = job?.status === 'running';
  const lines = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text]);

  useEffect(() => () => source.current?.close(), []);

  async function loadRows(id) {
    const res = await fetch(`/api/jobs/${id}/rows`);
    if (res.ok) setRows(await res.json());
  }

  async function start() {
    setError('');
    setRows([]);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ universities: lines, perSchool }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setJob(data);
      source.current?.close();
      const es = new EventSource(`/api/jobs/${data.id}/events`);
      source.current = es;
      es.onmessage = (e) => {
        const next = JSON.parse(e.data);
        setJob(next);
        if (next.status !== 'running') {
          es.close();
          loadRows(next.id);
        }
      };
    } catch (err) {
      setError(err.message);
    }
  }

  const cancel = () => job && fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    return q ? rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : rows;
  }, [rows, filter]);

  return (
    <main>
      <header>
        <h1>Faculty Scraper</h1>
        <p>Paste universities, get a CSV of faculty emails from their public directories.</p>
      </header>

      <section className="card">
        <label htmlFor="unis">
          Universities <span className="hint">one per line · optional “Name | domain.edu” · {lines.length} entered</span>
        </label>
        <textarea
          id="unis"
          rows={8}
          value={text}
          placeholder={PLACEHOLDER}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
        />
        <div className="controls">
          <label className="inline">
            Professors per school
            <input
              type="number"
              min="1"
              max="1000"
              value={perSchool}
              onChange={(e) => setPerSchool(Number(e.target.value))}
              disabled={running}
            />
          </label>
          {running ? (
            <button className="btn btn-danger" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button className="btn" onClick={start} disabled={!lines.length}>
              Start scraping
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {job && (
        <section className="card">
          <div className="results-head">
            <h2>Progress</h2>
            <span className="total">{job.total} emails collected</span>
            <a
              className={`btn btn-secondary ${job.total ? '' : 'disabled'}`}
              href={`/api/jobs/${job.id}/csv`}
              download="faculty.csv"
            >
              Download CSV
            </a>
          </div>
          <ul className="schools">
            {job.schools.map((s) => (
              <SchoolRow key={s.name} school={s} target={perSchool} />
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="card">
          <div className="results-head">
            <h2>Preview</h2>
            <input
              className="search"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>University</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Title</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 500).map((r) => (
                  <tr key={`${r.university}-${r.email}`}>
                    <td>{r.university}</td>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.title}</td>
                    <td>{r.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 500 && <p className="hint">Showing 500 of {visible.length}. Download CSV for all.</p>}
        </section>
      )}
    </main>
  );
}
