import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { notFound, errorHandler } from './middleware/error';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import sprintRoutes from './routes/sprint.routes';
import taskRoutes from './routes/task.routes';
import commentRoutes from './routes/comment.routes';
import attachmentRoutes from './routes/attachment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import notificationRoutes from './routes/notification.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Routes below define their own full paths (mix of /projects/.. and /tasks/..).
  app.use('/api', sprintRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', commentRoutes);
  app.use('/api', attachmentRoutes);
  app.use('/api', dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
