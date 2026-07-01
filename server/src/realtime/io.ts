import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';

let io: IoServer | null = null;

export function initRealtime(httpServer: HttpServer): IoServer {
  io = new IoServer(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  // Authenticate socket connections with the same JWT.
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyToken(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    // Personal room for notifications.
    socket.join(`user:${userId}`);

    socket.on('project:join', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });
    socket.on('project:leave', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });
  });

  return io;
}

export function getIo(): IoServer {
  if (!io) throw new Error('Realtime not initialised');
  return io;
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
