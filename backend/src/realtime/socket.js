// Real-time updates over WebSockets (Socket.IO).
// Every connection must send a valid access token. It then joins:
//   "user:<id>"  - events for this user (all their tabs/devices)
//   "admins"     - events for the admin panel (admins only)
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { userFromAccessToken } from '../middleware/auth.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientUrl, credentials: true } });

  // Authentication for the WebSocket handshake: same access token as the REST API
  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromAccessToken(socket.handshake.auth?.token);
      next();
    } catch (err) {
      const e = new Error('unauthorized');
      e.data = { code: err.code || 'INVALID_TOKEN' }; // the client refreshes its token on TOKEN_EXPIRED and reconnects
      next(e);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (user.role === 'admin') socket.join('admins');
  });

  return io;
}

export const emitToUser = (userId, event, data) => io?.to(`user:${userId}`).emit(event, data);
export const emitToAdmins = (event, data) => io?.to('admins').emit(event, data);

// Closes all open connections of a user, e.g. after "log out everywhere" or a role change
export function disconnectUser(userId, reason) {
  if (!io) return;
  if (reason) io.to(`user:${userId}`).emit('session:ended', { reason });
  io.in(`user:${userId}`).disconnectSockets(true);
}

// Number of users online right now (shown on the admin dashboard)
export async function onlineCount() {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  return new Set(sockets.map((s) => s.data.user.id)).size;
}
