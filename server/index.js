import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import db from './db.js';
import authRoutes from './auth.js';
import tripRoutes from './trips.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);
app.use(cors(), express.json());
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use((err, req, res, next) => {
  const status = err.status || (String(err.code).startsWith('SQLITE_CONSTRAINT') ? 400 : 500);
  res.status(status).json({ error: err.message });
});

// Real-time: the socket must carry a valid JWT, and can only join trips it belongs to
io.use((s, next) => {
  try { s.user = jwt.verify(s.handshake.auth.token, process.env.JWT_SECRET); next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', (s) => {
  s.on('join', (tripId) => {
    if (db.prepare('SELECT 1 FROM members WHERE tripId = ? AND userId = ?').get(Number(tripId), s.user.id)) s.join(String(tripId));
  });
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log('TripSync API running on port', port));
