# Viva notes for TripSync

## Run it (needs Node.js 20 or newer, nothing else)
1. Backend:   cd server && npm install && cp .env.example .env   (Windows CMD: copy .env.example .env)
              then edit .env and set JWT_SECRET to any long random text, then: npm run dev
2. Frontend:  cd client && npm install && npm run dev   -> open http://localhost:5173
The database file (server/tripsync.db) is created automatically. Delete it to reset all data.

Test real-time: sign up as two users in two browsers (one normal, one incognito). User 1 creates a trip, User 2 joins with the invite code. Edit anything and watch the other screen update live.

## Viva cheat sheet
- Auth: passwords hashed with bcrypt, login returns a JWT, `requireAuth` middleware protects every /api/trips route.
- Authorization: `r.param('id')` in trips.js joins trips with members, so only trip members get through; only the admin can lock polls.
- REST API: /api/auth, /api/trips (+ /activities, /expenses, /items, /polls).
- Database: SQLite (relational) with 10 tables: users, trips, members (many-to-many), activities, polls, poll_options, votes, expenses, expense_splits, items. Foreign keys with ON DELETE CASCADE; SQL JOINs build the trip page (db.js, trips.js).
- Transactions: creating a poll or expense (parent row + child rows) runs inside db.transaction so it is all-or-nothing.
- Real-time: Socket.io rooms (one per trip). The server emits "update" after any change; clients refetch. Sockets are authenticated with the JWT.
- Settle-up: net balance per member, then greedy matching of debtors to creditors (trips.js, settleUp()).
- Frontend: React hooks (useState, useEffect, useCallback), Recharts dashboard, Vite dev proxy to the API.
