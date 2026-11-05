import { Router } from 'express';
import db from './db.js';
import { requireAuth } from './auth.js';

const r = Router();
r.use(requireAuth);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const KINDS = ['Sightseeing', 'Food', 'Transport', 'Stay', 'Fun'];
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

// Tell everyone viewing this trip that something changed (Socket.io room = trip id)
// It also saves a readable line in the activity_log table, so the feed survives page refreshes
const emit = (req, type, message) => {
  if (message) run('INSERT INTO activity_log (tripId, userName, message) VALUES (?, ?, ?)', req.trip.id, req.user.name, message);
  req.app.get('io').to(String(req.trip.id)).emit('update', { type, by: req.user.name });
};

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
  `SELECT t.id AS _id, t.name, t.destination, t.startDate,
          (SELECT COUNT(*) FROM members WHERE tripId = t.id) AS memberCount
   FROM trips t JOIN members m ON m.tripId = t.id WHERE m.userId = ? ORDER BY t.id DESC`, req.user.id)));

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
    `SELECT a.id AS _id, a.day, a.time, a.title, a.place, a.kind, u.name AS byName FROM activities a
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
  const log = all('SELECT id, userName, message, createdAt FROM activity_log WHERE tripId = ? ORDER BY id DESC LIMIT 15', id);
  const notes = all(
    `SELECT n.id AS _id, n.body, n.createdAt, n.userId, u.name AS byName FROM notes n
     JOIN users u ON u.id = n.userId WHERE n.tripId = ? ORDER BY n.id DESC`, id);
  res.json({ trip: { ...req.trip, _id: id, members }, activities, polls, expenses, items, notes, log, settlements: settleUp(expenses, members) });
});

// Write routes: run the change, tell the room, reply ok
const mutate = (method, path, type, fn, message) => r[method](`/:id/${path}`, (req, res) => {
  const result = fn(req) || { ok: true };
  emit(req, type, typeof message === 'function' ? message(req) : message); res.json(result);
});
const remove = (path, table, type, message) => mutate('delete', `${path}/:cid`, type, (req) => {
  run(`DELETE FROM ${table} WHERE id = ? AND tripId = ?`, Number(req.params.cid), req.trip.id);
}, message);
const isMember = (tripId, userId) => !!get('SELECT 1 FROM members WHERE tripId = ? AND userId = ?', tripId, userId);

mutate('post', 'activities', 'itinerary', (req) => {
  const b = req.body;
  if (!b.title) fail('Enter what the activity is');
  const kind = KINDS.includes(b.kind) ? b.kind : 'Sightseeing';
  run('INSERT INTO activities (tripId, day, time, title, place, kind, addedBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
    req.trip.id, Math.max(1, Number(b.day) || 1), b.time || null, String(b.title).trim().slice(0, 120), (b.place || '').slice(0, 120) || null, kind, req.user.id);
}, (req) => `added "${String(req.body.title).trim().slice(0, 40)}" to Day ${Number(req.body.day) || 1}`);
remove('activities', 'activities', 'itinerary', 'removed an activity from the itinerary');

mutate('post', 'expenses', 'expenses', (req) => {
  const b = req.body, amount = Number(b.amount);
  if (!b.title || !(amount > 0)) fail('Enter what it was for and an amount above 0');
  const split = (b.splitAmong || []).map(Number).filter((u) => isMember(req.trip.id, u));
  db.transaction(() => {
    const e = run('INSERT INTO expenses (tripId, title, amount, category, paidBy) VALUES (?, ?, ?, ?, ?)', req.trip.id, b.title, amount, b.category || 'Other', req.user.id);
    split.forEach((u) => run('INSERT OR IGNORE INTO expense_splits (expenseId, userId) VALUES (?, ?)', e.lastInsertRowid, u));
  })();
}, (req) => `logged an expense: ${String(req.body.title).trim().slice(0, 40)} (₹${Number(req.body.amount)})`);
remove('expenses', 'expenses', 'expenses', 'removed an expense');

mutate('post', 'items', 'checklist', (req) => {
  const b = req.body, who = Number(b.assignee) || null;
  if (!b.text) fail('Enter an item');
  run('INSERT INTO items (tripId, label, assignee) VALUES (?, ?, ?)', req.trip.id, b.text, who && isMember(req.trip.id, who) ? who : null);
}, (req) => `added "${String(req.body.text).trim().slice(0, 40)}" to the checklist`);
mutate('patch', 'items/:cid', 'checklist', (req) => { run('UPDATE items SET done = 1 - done WHERE id = ? AND tripId = ?', Number(req.params.cid), req.trip.id); });
remove('items', 'items', 'checklist');

mutate('post', 'polls', 'polls', (req) => {
  const opts = (req.body.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (!req.body.question || opts.length < 2) fail('A poll needs a question and at least 2 options');
  db.transaction(() => {
    const p = run('INSERT INTO polls (tripId, question) VALUES (?, ?)', req.trip.id, req.body.question);
    opts.forEach((o) => run('INSERT INTO poll_options (pollId, label) VALUES (?, ?)', p.lastInsertRowid, o));
  })();
}, (req) => `started a poll: ${String(req.body.question).slice(0, 50)}`);
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
}, 'locked in a poll result');

// ---- New: trip notes (a small shared message board) ----
mutate('post', 'notes', 'notes', (req) => {
  const body = String(req.body.body || '').trim();
  if (!body) fail('Write something first');
  run('INSERT INTO notes (tripId, userId, body) VALUES (?, ?, ?)', req.trip.id, req.user.id, body.slice(0, 500));
}, 'posted a note');
mutate('delete', 'notes/:cid', 'notes', (req) => {
  // you can only delete your own notes (the admin can delete any)
  const n = get('SELECT userId FROM notes WHERE id = ? AND tripId = ?', Number(req.params.cid), req.trip.id);
  if (n && (n.userId === req.user.id || req.trip.admin === req.user.id)) run('DELETE FROM notes WHERE id = ?', Number(req.params.cid));
  else fail('You can only delete your own notes', 403);
});

// ---- New: edit trip details and budget (admin only) ----
r.patch('/:id', (req, res) => {
  if (req.trip.admin !== req.user.id) fail('Only the trip admin can edit the trip', 403);
  const b = req.body, budget = Number(b.budget);
  run('UPDATE trips SET name = ?, destination = ?, startDate = ?, budget = ? WHERE id = ?',
    String(b.name || req.trip.name).trim().slice(0, 80), b.destination ?? req.trip.destination, b.startDate || null,
    Number.isFinite(budget) && budget >= 0 ? budget : req.trip.budget, req.trip.id);
  emit(req, 'trip', 'updated the trip details');
  res.json({ ok: true });
});

// ---- New: delete a trip (admin) or leave it (any other member) ----
r.delete('/:id', (req, res) => {
  if (req.trip.admin !== req.user.id) fail('Only the trip admin can delete the trip', 403);
  run('DELETE FROM trips WHERE id = ?', req.trip.id);
  req.app.get('io').to(String(req.trip.id)).emit('update', { type: 'deleted', by: req.user.name });
  res.json({ ok: true });
});
r.post('/:id/leave', (req, res) => {
  if (req.trip.admin === req.user.id) fail('The admin cannot leave. Delete the trip instead.');
  run('DELETE FROM members WHERE tripId = ? AND userId = ?', req.trip.id, req.user.id);
  req.app.get('io').to(String(req.trip.id)).emit('update', { type: 'members', by: req.user.name });
  res.json({ ok: true });
});

// ---- New: download all expenses as a CSV file (opens in Excel / Sheets) ----
r.get('/:id/export', (req, res) => {
  const rows = all(`SELECT e.title, e.category, e.amount, u.name AS paidBy FROM expenses e
                    JOIN users u ON u.id = e.paidBy WHERE e.tripId = ? ORDER BY e.id`, req.trip.id);
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = ['Title,Category,Amount,Paid by', ...rows.map((x) => [x.title, x.category, x.amount, x.paidBy].map(q).join(','))].join('\n');
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${req.trip.name.replace(/[^a-z0-9]+/gi, '-')}-expenses.csv"` }).send(csv);
});
export default r;
