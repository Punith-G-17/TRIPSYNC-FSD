import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import db from './db.js';
import authRoutes from './auth.js';
import tripRoutes from './trips.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it to a long random string.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);
app.use(cors(), express.json({ limit: '100kb' }));

// Basic security headers (a lightweight stand-in for the helmet package)
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});

// Simple in-memory rate limiter for login/register: 20 tries per 15 minutes per IP
const hits = new Map();
const limitAuth = (req, res, next) => {
  const now = Date.now(), key = req.ip, rec = hits.get(key) || { n: 0, reset: now + 15 * 60 * 1000 };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + 15 * 60 * 1000; }
  rec.n++; hits.set(key, rec);
  if (rec.n > 20) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  next();
};

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', limitAuth, authRoutes);
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
