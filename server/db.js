import Database from 'better-sqlite3';

// The whole database is one file (tripsync.db) created automatically on first run
const db = new Database(process.env.DB_FILE || 'tripsync.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // enforce relations + ON DELETE CASCADE

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, destination TEXT, startDate TEXT,
  code TEXT UNIQUE NOT NULL, admin INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS members (
  tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY (tripId, userId));
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day INTEGER DEFAULT 1, time TEXT, title TEXT NOT NULL, place TEXT, addedBy INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  question TEXT NOT NULL, locked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pollId INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS votes (
  optionId INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY (optionId, userId));
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL, amount REAL NOT NULL, category TEXT, paidBy INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS expense_splits (
  expenseId INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY (expenseId, userId));
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL, assignee INTEGER REFERENCES users(id), done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  userName TEXT NOT NULL, message TEXT NOT NULL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tripId INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// Tiny migration helper: add a column to an existing database without losing data
const addColumn = (table, column, def) => {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
};
addColumn('trips', 'budget', 'REAL DEFAULT 0');           // total group budget (shown as a progress bar)
addColumn('activities', 'kind', "TEXT DEFAULT 'Sightseeing'"); // Sightseeing, Food, Transport, Stay, Fun
export default db;
