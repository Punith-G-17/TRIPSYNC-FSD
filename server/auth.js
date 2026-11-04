import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

// Middleware: reads "Authorization: Bearer <token>" and sets req.user
export const requireAuth = (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Please log in again' }); }
};
const out = (u) => ({
  token: jwt.sign({ id: u.id, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' }),
  user: { id: u.id, name: u.name },
});

const r = Router();
r.post('/register', async (req, res) => {
  const { name, password } = req.body, email = (req.body.email || '').toLowerCase();
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email already registered' });
  const info = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, await bcrypt.hash(password, 10));
  res.json(out({ id: info.lastInsertRowid, name }));
});
r.post('/login', async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get((req.body.email || '').toLowerCase());
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(401).json({ error: 'Wrong email or password' });
  res.json(out(u));
});
export default r;
