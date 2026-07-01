# ProjectFlow

ProjectFlow is an agile project management system for teams that work with Scrum, Kanban, or a mix of both. It gives teams one place to manage projects, plan sprints, organize backlog items, track tasks on a Kanban board, assign work, leave comments, upload attachments, and follow project activity in real time.

The system also includes role-based access control for each project, notifications, activity history, and a metrics dashboard so teams can understand progress and workload more clearly.

## Tech Stack

ProjectFlow is built with:

- Node.js
- Express
- TypeScript
- PostgreSQL
- Socket.IO
- Next.js 14
- React

## Features

ProjectFlow includes the main features expected in a modern agile project management tool:

- User registration and login
- JWT-based authentication
- Project creation and management
- Project member management
- Per-project role-based access control
- Scrum sprint management
- Kanban task board
- Task creation, editing, moving, and deletion
- Task comments
- File attachments
- Activity feed
- Notifications
- Real-time updates with Socket.IO
- Metrics dashboard

## Project Structure

The project is organized as a monorepo with separate backend and frontend applications.

```text
projectflow/
├── server/
│   └── src/
│       ├── config/
│       ├── db/
│       ├── middleware/
│       ├── realtime/
│       ├── services/
│       ├── routes/
│       ├── utils/
│       ├── app.ts
│       └── index.ts
├── client/
│   ├── app/
│   └── lib/
├── docker-compose.yml
└── package.json
```

The `server` folder contains the Express and TypeScript backend. It handles authentication, database access, projects, sprints, tasks, comments, attachments, notifications, activity logs, permissions, and real-time events.

The `client` folder contains the Next.js frontend. It includes the pages and user interface for logging in, viewing projects, managing the board, working with sprints, and checking dashboard metrics.

## Getting Started

You need Node.js 18 or newer and PostgreSQL 14 or newer. If you do not already have PostgreSQL installed, you can use Docker.

### 1. Install Dependencies

From the root folder, install dependencies for both the server and client:

```bash
npm run install:all
```

### 2. Start PostgreSQL

If you are using Docker, start the local PostgreSQL database:

```bash
npm run db:up
```

If you already have PostgreSQL running locally, you can skip this step.

### 3. Create Environment Files

Create the environment files from the examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Update `server/.env` if your database URL is different. You should also replace the default JWT secret before using the app outside local development.

### 4. Create the Database Schema

Run the database migration:

```bash
npm run migrate
```

### 5. Add Demo Data

Seed the database with demo users and sample project data:

```bash
npm run seed
```

### 6. Start the Applications

Start the backend server:

```bash
npm run dev:server
```

In another terminal, start the frontend:

```bash
npm run dev:client
```

The backend API runs at:

```text
http://localhost:4000
```

The frontend runs at:

```text
http://localhost:3000
```

Open the frontend in your browser and log in with one of the demo accounts:

```text
alice@demo.dev / password123
bob@demo.dev   / password123
```

## Environment Variables

### Server

The backend uses the following environment variables:

```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/projectflow
JWT_SECRET=dev-only-change-me
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
UPLOAD_DIR=uploads
```

`PORT` is the port used by the API server.

`DATABASE_URL` is the PostgreSQL connection string.

`JWT_SECRET` is used to sign authentication tokens. Change this value before production use.

`JWT_EXPIRES_IN` controls how long login tokens remain valid.

`CLIENT_ORIGIN` is the frontend URL allowed to access the API and Socket.IO server.

`UPLOAD_DIR` is the folder where uploaded files are stored.

### Client

The frontend uses this environment variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

This tells the frontend where the backend API is running.

## API Overview

All backend routes are prefixed with `/api`.

Protected routes require an authorization token in this format:

```text
Authorization: Bearer <token>
```

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Authentication routes allow users to register, log in, and fetch their current profile.

### Projects

```text
GET  /api/projects
POST /api/projects
GET  /api/projects/:projectId
POST /api/projects/:projectId/members
GET  /api/projects/:projectId/activity
```

Project routes allow users to create projects, view projects they belong to, manage project members, and view the project activity feed.

### Sprints

```text
GET   /api/projects/:projectId/sprints
POST  /api/projects/:projectId/sprints
PATCH /api/sprints/:sprintId
```

Sprint routes support Scrum-style planning by allowing teams to create, list, and update sprints.

### Tasks and Kanban Board

```text
GET    /api/projects/:projectId/board
POST   /api/projects/:projectId/tasks
PATCH  /api/tasks/:taskId
PATCH  /api/tasks/:taskId/move
DELETE /api/tasks/:taskId
```

Task routes allow users to create, update, move, and delete tasks. The board route returns tasks grouped by Kanban column.

### Comments

```text
GET  /api/tasks/:taskId/comments
POST /api/tasks/:taskId/comments
```

Comment routes allow users to view and add comments on tasks.

### Attachments

```text
GET  /api/tasks/:taskId/attachments
POST /api/tasks/:taskId/attachments
GET  /api/attachments/:attachmentId/download
```

Attachment uploads use multipart form data. The file field name should be:

```text
file
```

### Dashboard

```text
GET /api/projects/:projectId/dashboard
```

The dashboard route returns project metrics such as task counts by status, priority counts, workload, and completion rate.

### Notifications

```text
GET   /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

Notification routes allow users to view notifications and mark them as read.

## Real-Time Updates

ProjectFlow uses Socket.IO for real-time updates.

The client connects with an authentication token:

```js
auth: {
  token: "your-jwt-token";
}
```

The server can emit these events:

```text
task:created
task:updated
task:moved
task:deleted
activity:new
notification:new
```

The client can send these events:

```text
project:join
project:leave
```

This allows users to receive live updates when tasks, activity, or notifications change.

## Role-Based Access Control

Roles are assigned per project. A user can have different roles in different projects.

The role levels are:

```text
viewer < member < admin < owner
```

A `viewer` can view project information.

A `member` can create and update project work items.

An `admin` can manage more project settings and members.

An `owner` has the highest level of access in the project.

The backend checks the user's role before allowing protected project actions.

## Current Implementation Status

The following features are implemented:

| Feature                   | Status          | Notes                                                  |
| ------------------------- | --------------- | ------------------------------------------------------ |
| JWT authentication        | Complete        | Register, login, and current user profile              |
| Password hashing          | Complete        | Passwords are hashed with bcrypt                       |
| Project management        | Complete        | Users can create and view projects                     |
| Project membership        | Complete        | Project members can be added                           |
| Role-based access control | Complete        | Roles are checked per project                          |
| Sprint management         | Complete        | Sprints can be created, listed, and updated            |
| Kanban board              | Complete        | Tasks are grouped into board columns                   |
| Task CRUD                 | Complete        | Tasks can be created, edited, moved, and deleted       |
| Comments                  | Complete        | Users can add and view task comments                   |
| File attachments          | Partial         | Files are stored on local disk                         |
| Activity feed             | Complete        | Project actions are logged                             |
| Notifications             | Complete        | Notifications are created for key events               |
| Real-time updates         | Complete        | Socket.IO sends live project updates                   |
| Metrics dashboard         | Complete        | Shows task and workload metrics                        |
| Drag-and-drop board       | Partial         | Task movement works, but not true drag-and-drop        |
| Automated tests           | Not implemented | Tests still need to be added                           |
| Refresh tokens            | Not implemented | Authentication currently uses stateless JWTs           |
| Pagination                | Partial         | Some lists are capped but do not use cursor pagination |

## Known Limitations

ProjectFlow is functional, but there are still areas that can be improved.

File attachments are stored on the local server. This is fine for local development, but production deployments should use object storage such as Amazon S3 or Google Cloud Storage.

The Kanban board does not yet support true drag-and-drop. Tasks can be moved between columns, but the board should eventually use a drag-and-drop library for a smoother experience.

The app does not currently include automated tests. Integration tests should be added for authentication, permissions, projects, and task movement.

Authentication does not include refresh tokens or logout token revocation. The current setup uses stateless JWT authentication.

Activity and notification lists are limited, but full pagination has not been implemented yet.

## Recommended Next Improvements

The best next improvements would be:

1. Add true drag-and-drop to the Kanban board using `dnd-kit`.
2. Use task position values for ordering tasks inside columns.
3. Add automated backend tests with Vitest or Jest and Supertest.
4. Move file attachments from local disk to cloud storage.
5. Add refresh tokens and logout/session revocation.
6. Add cursor-based pagination for activity and notifications.
7. Improve the board with optimistic UI updates.

## Scripts

### Root Scripts

```bash
npm run install:all
npm run db:up
npm run db:down
npm run migrate
npm run seed
npm run dev:server
npm run dev:client
```

`npm run install:all` installs dependencies for both the server and client.

`npm run db:up` starts PostgreSQL with Docker.

`npm run db:down` stops the Docker database.

`npm run migrate` creates the database schema.

`npm run seed` adds demo data.

`npm run dev:server` starts the backend development server.

`npm run dev:client` starts the frontend development server.

### Server Scripts

Run these from the `server` folder:

```bash
npm run dev
npm run build
npm start
npm run typecheck
```

`npm run dev` starts the backend with automatic reload.

`npm run build` compiles the TypeScript backend.

`npm start` runs the compiled backend.

`npm run typecheck` checks TypeScript types.

### Client Scripts

Run these from the `client` folder:

```bash
npm run dev
npm run build
npm start
```

`npm run dev` starts the Next.js development server.

`npm run build` creates a production build.

`npm start` runs the production build.

## License

MIT
