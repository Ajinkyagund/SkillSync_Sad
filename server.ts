/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SkillSwap development / production server.
 *
 * Combines an Express HTTP server, a Socket.io real-time server (used by the
 * collaborative whiteboard in SessionWorkspace), and the Vite dev server
 * (middleware mode) so that a single process serves the app and the API.
 *
 * - `npm run dev` runs this file through `tsx` in development mode (Vite HMR).
 * - `npm run build && npm start` runs the bundled `dist/server.cjs` in
 *   production mode, serving the static client build from `dist/`.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {Server} from 'socket.io';
import {createServer} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function createAppServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Real-time layer: collaborative whiteboard strokes.
  const io = new Server(httpServer, {
    cors: {origin: '*'},
  });

  io.on('connection', (socket) => {
    // Join a session room so strokes are broadcast only to participants.
    socket.on('join-room', (room: string) => {
      if (room) socket.join(room);
    });

    // Broadcast a whiteboard stroke to everyone else in the session room.
    socket.on('canvas-draw-stroke', (data: {roomId?: string}) => {
      if (data && data.roomId) {
        socket.to(data.roomId).emit('canvas-draw-stroke', data);
      }
    });
  });

  if (isProduction) {
    // Serve the built client assets.
    app.use(express.static(path.join(__dirname, 'dist')));
    // SPA fallback so client-side routes resolve.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Development: let Vite handle HMR + transforms via middleware.
    // Use the default 'spa' app type so Vite serves index.html and provides
    // the SPA fallback (appType 'custom' skips HTML serving entirely).
    const vite = await createServer({
      server: {middlewareMode: true},
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, () => {
    console.log(`SkillSwap server running at http://localhost:${PORT}`);
  });
}

createAppServer();
