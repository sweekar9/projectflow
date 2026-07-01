import { query } from '../db/pool';
import { emitToProject } from '../realtime/io';

interface LogActivityInput {
  projectId: string;
  actorId: string;
  verb: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  const [row] = await query(
    `INSERT INTO activities (project_id, actor_id, verb, entity, entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, project_id, actor_id, verb, entity, entity_id, metadata, created_at`,
    [
      input.projectId,
      input.actorId,
      input.verb,
      input.entity,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  // Push to everyone watching this project's activity feed.
  emitToProject(input.projectId, 'activity:new', row);
  return row;
}
