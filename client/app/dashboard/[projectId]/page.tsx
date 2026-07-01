'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

interface Dashboard {
  totals: { total: number; done: number; points: number; completionRate: number };
  statusCounts: { status: string; count: number }[];
  priorityCounts: { priority: string; count: number }[];
  workload: { id: string; name: string; open_tasks: number; open_points: number }[];
}

export default function MetricsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Dashboard>(`/projects/${params.projectId}/dashboard`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="container error">{error}</div>;
  if (!data) return <div className="container muted">Loading…</div>;

  return (
    <div className="container stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Project metrics</h2>
        <div className="row">
          <button onClick={() => router.push(`/board/${params.projectId}`)}>Board</button>
          <button onClick={() => router.push('/dashboard')}>All projects</button>
        </div>
      </div>

      <div className="grid-metrics">
        <div className="card"><div className="muted">Total tasks</div><h2 style={{ margin: 0 }}>{data.totals.total}</h2></div>
        <div className="card"><div className="muted">Completed</div><h2 style={{ margin: 0 }}>{data.totals.done}</h2></div>
        <div className="card"><div className="muted">Completion</div><h2 style={{ margin: 0 }}>{data.totals.completionRate}%</h2></div>
        <div className="card"><div className="muted">Story points</div><h2 style={{ margin: 0 }}>{data.totals.points}</h2></div>
      </div>

      <div className="card stack">
        <strong>Tasks by status</strong>
        {data.statusCounts.map((s) => (
          <div key={s.status} className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</span>
            <span className="tag">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="card stack">
        <strong>Workload distribution</strong>
        {data.workload.length === 0 && <span className="muted">No assigned tasks.</span>}
        {data.workload.map((w) => (
          <div key={w.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{w.name}</span>
            <span className="muted">{w.open_tasks} open · {w.open_points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
