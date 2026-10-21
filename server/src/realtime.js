import { Server } from 'socket.io';
import { authenticate } from './auth.js';
import { one } from './db.js';

let io;

export function attachSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.use(async (socket, next) => {
    try { socket.uid = (await authenticate(socket.handshake.auth?.token)).uid; next(); } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', socket => {
    socket.join(`u:${socket.uid}`);
    socket.on('typing', ({ matchId, to }) => to && io.to(`u:${to}`).emit('typing', { matchId }));
  });
}

export const emitTo = (uid, event, data) => io?.to(`u:${uid}`).emit(event, data);
const online = async uid => (await io?.in(`u:${uid}`).fetchSockets())?.length > 0;

export const istHour = () => new Date(Date.now() + 5.5 * 3600e3).getUTCHours();
const inQuiet = ({ quietStart: s, quietEnd: e }, h = istHour()) => s == null || s === e ? false : s < e ? h >= s && h < e : h >= s || h < e;

/** type: matches | messages | daily | safety. Safety notices ignore preferences and quiet hours. */
export async function notify(uid, type, title, body, data = {}) {
  const u = await one('SELECT push_token, notif FROM users WHERE id=$1', [uid]);
  if (!u?.push_token) return;
  if (type !== 'safety' && (u.notif[type] === false || inQuiet(u.notif))) return;
  if (type === 'messages' && await online(uid)) return; // they'll see it in-app
  fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: u.push_token, title, body, data, sound: 'default', channelId: 'default' }),
  }).catch(e => console.error('push', e.message));
}

export { inQuiet };
