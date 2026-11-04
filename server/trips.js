import { Router } from 'express';
import db from './db.js';
import { requireAuth } from './auth.js';

const r = Router();
r.use(requireAuth);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

// Tell everyone viewing this trip that something changed (Socket.io room = trip id)
const emit = (req, type) => req.app.get('io').to(String(req.trip.id)).emit('update', { type, by: req.user.name });

// Runs for every route containing :id -> only trip members get through
r.param('id', (req, res, next, id) => {
  req.trip = get('SELECT t.* FROM trips t JOIN members m ON m.tripId = t.id WHERE t.id = ? AND m.userId = ?', Number(id), req.user.id);
  if (!req.trip) return res.status(404).json({ error: 'Trip not found' });
  next();
});

// Who owes whom: net balance per member, then match debtors with creditors
function settleUp(expenses, members) {
  const net = {}, name = {};
  members.forEach((m) => { net[m._id] = 0; name[m._id] = m.name; });
  expenses.forEach((e) => {
    const among = e.splitAmong.length ? e.splitAmong.map(String) : members.map((m) => String(m._id));
    net[e.paidBy._id] += e.amount;
    among.forEach((u) => { net[u] -= e.amount / among.length; });
  });
  const cr = [], db_ = [];
  Object.entries(net).forEach(([u, v]) => (v > 0.01 ? cr.push({ u, v }) : v < -0.01 && db_.push({ u, v: -v })));
  const result = [];
  for (const d of db_) for (const c of cr) {
    const x = Math.min(d.v, c.v);
    if (x > 0.01) { result.push({ from: name[d.u], to: name[c.u], amount: +x.toFixed(2) }); d.v -= x; c.v -= x; }
  }
  return result;
}

r.get('/', (req, res) => res.json(all(
  'SELECT t.id AS _id, t.name, t.destination FROM trips t JOIN members m ON m.tripId = t.id WHERE m.userId = ? ORDER BY t.id DESC', req.user.id)));

r.post('/', (req, res) => {
  const { name, destination, startDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Trip name is required' });
  const code = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
  const id = db.transaction(() => {
    const t = run('INSERT INTO trips (name, destination, startDate, code, admin) VALUES (?, ?, ?, ?, ?)', name, destination || null, startDate || null, code, req.user.id);
    run('INSERT INTO members (tripId, userId) VALUES (?, ?)', t.lastInsertRowid, req.user.id);
    return t.lastInsertRowid;
  })();
  res.json({ _id: id });
});

r.post('/join', (req, res) => {
  const trip = get('SELECT id FROM trips WHERE code = ?', (req.body.code || '').trim().toUpperCase());
  if (!trip) return res.status(404).json({ error: 'No trip with that invite code' });
  run('INSERT OR IGNORE INTO members (tripId, userId) VALUES (?, ?)', trip.id, req.user.id);
  req.app.get('io').to(String(trip.id)).emit('update', { type: 'members', by: req.user.name });
  res.json({ _id: trip.id });
});

// One call returns everything the trip page needs (same JSON shape the React app expects)
r.get('/:id', (req, res) => {
  const id = req.trip.id;
  const members = all('SELECT u.id AS _id, u.name FROM members m JOIN users u ON u.id = m.userId WHERE m.tripId = ? ORDER BY m.rowid', id);
  const activities = all(
    `SELECT a.id AS _id, a.day, a.time, a.title, a.place, u.name AS byName FROM activities a
     LEFT JOIN users u ON u.id = a.addedBy WHERE a.tripId = ? ORDER BY a.day, a.time`, id)
    .map((a) => ({ ...a, by: { name: a.byName } }));
  const polls = all('SELECT id AS _id, question, locked FROM polls WHERE tripId = ? ORDER BY id DESC', id).map((p) => ({
    ...p, locked: !!p.locked,
    options: all('SELECT id, label AS text FROM poll_options WHERE pollId = ? ORDER BY id', p._id)
      .map((o) => ({ ...o, votes: all('SELECT userId FROM votes WHERE optionId = ?', o.id).map((v) => v.userId) })),
  }));
  const expenses = all(
    `SELECT e.id AS _id, e.title, e.amount, e.category, e.paidBy, u.name AS payer FROM expenses e
     JOIN users u ON u.id = e.paidBy WHERE e.tripId = ? ORDER BY e.id DESC`, id)
    .map((e) => ({ ...e, paidBy: { _id: e.paidBy, name: e.payer },
      splitAmong: all('SELECT userId FROM expense_splits WHERE expenseId = ?', e._id).map((s) => s.userId) }));
  const items = all(
    `SELECT i.id AS _id, i.label AS text, i.done, u.name AS who FROM items i
     LEFT JOIN users u ON u.id = i.assignee WHERE i.tripId = ? ORDER BY i.id`, id)
    .map((i) => ({ ...i, done: !!i.done, assignee: i.who ? { name: i.who } : null }));
  res.json({ trip: { ...req.trip, _id: id, members }, activities, polls, expenses, items, settlements: settleUp(expenses, members) });
});

// Write routes: run the change, tell the room, reply ok
const mutate = (method, path, type, fn) => r[method](`/:id/${path}`, (req, res) => {
  const result = fn(req) || { ok: true };
  emit(req, type); res.json(result);
});
const remove = (path, table, type) => mutate('delete', `${path}/:cid`, type, (req) => {
  run(`DELETE FROM ${table} WHERE id = ? AND tripId = ?`, Number(req.params.cid), req.trip.id);
});
const isMember = (tripId, userId) => !!get('SELECT 1 FROM members WHERE tripId = ? AND userId = ?', tripId, userId);

mutate('post', 'activities', 'itinerary', (req) => {
  const b = req.body;
  if (!b.title) fail('Enter what the activity is');
  run('INSERT INTO activities (tripId, day, time, title, place, addedBy) VALUES (?, ?, ?, ?, ?, ?)',
    req.trip.id, Number(b.day) || 1, b.time || null, b.title, b.place || null, req.user.id);
});
remove('activities', 'activities', 'itinerary');

mutate('post', 'expenses', 'expenses', (req) => {
  const b = req.body, amount = Number(b.amount);
  if (!b.title || !(amount > 0)) fail('Enter what it was for and an amount above 0');
  const split = (b.splitAmong || []).map(Number).filter((u) => isMember(req.trip.id, u));
  db.transaction(() => {
    const e = run('INSERT INTO expenses (tripId, title, amount, category, paidBy) VALUES (?, ?, ?, ?, ?)', req.trip.id, b.title, amount, b.category || 'Other', req.user.id);
    split.forEach((u) => run('INSERT OR IGNORE INTO expense_splits (expenseId, userId) VALUES (?, ?)', e.lastInsertRowid, u));
  })();
});
remove('expenses', 'expenses', 'expenses');

mutate('post', 'items', 'checklist', (req) => {
  const b = req.body, who = Number(b.assignee) || null;
  if (!b.text) fail('Enter an item');
  run('INSERT INTO items (tripId, label, assignee) VALUES (?, ?, ?)', req.trip.id, b.text, who && isMember(req.trip.id, who) ? who : null);
});
mutate('patch', 'items/:cid', 'checklist', (req) => { run('UPDATE items SET done = 1 - done WHERE id = ? AND tripId = ?', Number(req.params.cid), req.trip.id); });
remove('items', 'items', 'checklist');

mutate('post', 'polls', 'polls', (req) => {
  const opts = (req.body.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (!req.body.question || opts.length < 2) fail('A poll needs a question and at least 2 options');
  db.transaction(() => {
    const p = run('INSERT INTO polls (tripId, question) VALUES (?, ?)', req.trip.id, req.body.question);
    opts.forEach((o) => run('INSERT INTO poll_options (pollId, label) VALUES (?, ?)', p.lastInsertRowid, o));
  })();
});
mutate('post', 'polls/:pid/vote', 'polls', (req) => {
  const poll = get('SELECT * FROM polls WHERE id = ? AND tripId = ?', Number(req.params.pid), req.trip.id);
  if (!poll || poll.locked) fail('This poll is closed');
  const opts = all('SELECT id FROM poll_options WHERE pollId = ? ORDER BY id', poll.id);
  db.transaction(() => { // one vote per person: clear their old vote, then add the new one
    run('DELETE FROM votes WHERE userId = ? AND optionId IN (SELECT id FROM poll_options WHERE pollId = ?)', req.user.id, poll.id);
    if (opts[req.body.index]) run('INSERT INTO votes (optionId, userId) VALUES (?, ?)', opts[req.body.index].id, req.user.id);
  })();
});
mutate('post', 'polls/:pid/lock', 'polls', (req) => {
  if (req.trip.admin !== req.user.id) fail('Only the trip admin can lock a poll', 403);
  run('UPDATE polls SET locked = 1 WHERE id = ? AND tripId = ?', Number(req.params.pid), req.trip.id);
});
export default r;
