'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearToken, getToken } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const data = await api<{ projects: Project[] }>('/projects');
      setProjects(data.projects);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    setError('');
    if (!name || !key) {
      setError('Name and key are required');
      return;
    }
    try {
      await api('/projects', { method: 'POST', body: { name, key } });
      setName('');
      setKey('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function logout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <div className="container stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Your projects</h2>
        <button onClick={logout}>Log out</button>
      </div>

      <div className="card stack">
        <strong>New project</strong>
        <div className="row">
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Key (e.g. PF)" style={{ maxWidth: 120 }} value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="primary" onClick={createProject}>Create</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="muted">No projects yet. Create one above.</p>
      ) : (
        <div className="stack">
          {projects.map((p) => (
            <div key={p.id} className="card row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="row">
                  <span className="tag">{p.key}</span>
                  <strong>{p.name}</strong>
                  <span className="tag">{p.role}</span>
                </div>
                {p.description && <div className="muted" style={{ marginTop: 6 }}>{p.description}</div>}
              </div>
              <div className="row">
                <button onClick={() => router.push(`/board/${p.id}`)}>Board</button>
                <button onClick={() => router.push(`/dashboard/${p.id}`)}>Metrics</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
