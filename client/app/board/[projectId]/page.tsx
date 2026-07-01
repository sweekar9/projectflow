'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api, getToken, API_URL } from '@/lib/api';

const COLUMNS = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
type Status = (typeof COLUMNS)[number];

interface Task {
  id: string;
  title: string;
  status: Status;
  type: string;
  priority: string;
  story_points?: number | null;
  assignee_name?: string | null;
}

type Columns = Record<Status, Task[]>;

export default function BoardPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [columns, setColumns] = useState<Columns>({ backlog: [], todo: [], in_progress: [], in_review: [], done: [] });
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    loadBoard();

    // Realtime: reload board on any task event for this project.
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => {
      setLive(true);
      socket.emit('project:join', projectId);
    });
    socket.on('disconnect', () => setLive(false));
    const reload = () => loadBoard();
    socket.on('task:created', reload);
    socket.on('task:updated', reload);
    socket.on('task:moved', reload);
    socket.on('task:deleted', reload);

    return () => {
      socket.emit('project:leave', projectId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBoard() {
    try {
      const data = await api<{ columns: Columns }>(`/projects/${projectId}/board`);
      setColumns(data.columns);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addTask() {
    if (!title.trim()) return;
    setError('');
    try {
      await api(`/projects/${projectId}/tasks`, { method: 'POST', body: { title, status: 'todo' } });
      setTitle('');
      // Realtime event will trigger reload; reload directly too for immediacy.
      loadBoard();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function move(task: Task, status: Status) {
    try {
      await api(`/tasks/${task.id}/move`, { method: 'PATCH', body: { status, position: 0 } });
      loadBoard();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(task: Task) {
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE' });
      loadBoard();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function nextStatus(s: Status): Status {
    const i = COLUMNS.indexOf(s);
    return COLUMNS[Math.min(i + 1, COLUMNS.length - 1)];
  }

  return (
    <div className="container stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Board</h2>
          <span className="tag" style={{ borderColor: live ? 'var(--accent)' : 'var(--border)' }}>
            {live ? 'live' : 'offline'}
          </span>
        </div>
        <div className="row">
          <button onClick={() => router.push(`/dashboard/${projectId}`)}>Metrics</button>
          <button onClick={() => router.push('/dashboard')}>All projects</button>
        </div>
      </div>

      <div className="card row">
        <input placeholder="New task title…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
        <button className="primary" onClick={addTask}>Add</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="board">
        {COLUMNS.map((col) => (
          <div key={col} className="column">
            <h4>{col.replace('_', ' ')} <span className="muted">({columns[col].length})</span></h4>
            {columns[col].map((task) => (
              <div key={task.id} className={`task-card priority-${task.priority}`}>
                <div>{task.title}</div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {task.type}{task.story_points ? ` · ${task.story_points}pt` : ''}{task.assignee_name ? ` · ${task.assignee_name}` : ''}
                  </span>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {col !== 'done' && (
                    <button style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => move(task, nextStatus(col))}>→</button>
                  )}
                  <button className="danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => remove(task)}>del</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
