import { query } from '../db/pool';
import { emitToUser } from '../realtime/io';

interface NotifyInput {
  userId: string;
  projectId?: string | null;
  message: string;
  link?: string | null;
}

export async function notify(input: NotifyInput) {
  const [row] = await query(
    `INSERT INTO notifications (user_id, project_id, message, link)
     VALUES ($1,$2,$3,$4)
     RETURNING id, user_id, project_id, message, link, is_read, created_at`,
    [input.userId, input.projectId ?? null, input.message, input.link ?? null]
  );
  emitToUser(input.userId, 'notification:new', row);
  return row;
}
