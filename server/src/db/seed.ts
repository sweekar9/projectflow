import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './pool';

async function seed() {
  console.log('Seeding demo data...');

  const passwordHash = await bcrypt.hash('password123', 10);

  await withTransaction(async (run) => {
    // Clean slate for demo data (dev only).
    await run('TRUNCATE users, projects, memberships, sprints, tasks, comments, attachments, activities, notifications RESTART IDENTITY CASCADE');

    const [sweekar] = await run<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['sweekar@demo.dev', 'sweekar Owner', passwordHash]
    );
    const [sg] = await run<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      ['sg@demo.dev', 'sg Member', passwordHash]
    );

    const [project] = await run<{ id: string }>(
      `INSERT INTO projects (name, key, description, owner_id) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['ProjectFlow Demo', 'PF', 'A demo agile project', sweekar.id]
    );

    await run(`INSERT INTO memberships (project_id, user_id, role) VALUES ($1,$2,'owner')`, [project.id, sweekar.id]);
    await run(`INSERT INTO memberships (project_id, user_id, role) VALUES ($1,$2,'member')`, [project.id, sg.id]);

    const [sprint] = await run<{ id: string }>(
      `INSERT INTO sprints (project_id, name, goal, status, start_date, end_date)
       VALUES ($1,$2,$3,'active', now()::date, (now() + interval '14 days')::date) RETURNING id`,
      [project.id, 'Sprint 1', 'Ship the board']
    );

    const tasks: Array<[string, string, string, string]> = [
      ['Set up CI pipeline', 'todo', 'task', 'high'],
      ['Design board UI', 'in_progress', 'story', 'medium'],
      ['Fix drag-and-drop bug', 'in_review', 'bug', 'urgent'],
      ['Write API docs', 'backlog', 'task', 'low'],
      ['Auth flow', 'done', 'story', 'high'],
    ];

    let position = 0;
    for (const [title, status, type, priority] of tasks) {
      await run(
        `INSERT INTO tasks (project_id, sprint_id, title, status, type, priority, story_points, assignee_id, reporter_id, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [project.id, sprint.id, title, status, type, priority, 3, sg.id, sweekar.id, position++]
      );
    }

    await run(
      `INSERT INTO activities (project_id, actor_id, verb, entity) VALUES ($1,$2,'seeded','project')`,
      [project.id, sweekar.id]
    );
  });

  console.log('Seed complete.');
  console.log('Login with: sweekar@demo.dev / password123  (owner)');
  console.log('         or sg@demo.dev / password123    (member)');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
