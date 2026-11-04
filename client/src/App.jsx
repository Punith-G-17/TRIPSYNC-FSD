import { useState, useEffect } from 'react';
import { api } from './api';
import Trip from './Trip';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/' + mode, 'POST', f);
      localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
      onAuth(d.user);
    } catch (x) { setErr(x.message); }
  };
  return (
    <main><form className="card stack" style={{ maxWidth: 380, margin: '60px auto' }} onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in to TripSync' : 'Create your account'}</h2>
      {mode === 'register' && <input required placeholder="Your name" value={f.name} onChange={set('name')} />}
      <input required type="email" placeholder="Email" value={f.email} onChange={set('email')} />
      <input required type="password" placeholder="Password (6+ characters)" value={f.password} onChange={set('password')} />
      {err && <div className="err">{err}</div>}
      <button>{mode === 'login' ? 'Log in' : 'Sign up'}</button>{' '}
      <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </form></main>
  );
}

function Home({ open }) {
  const [trips, setTrips] = useState([]);
  const [f, setF] = useState({ name: '', destination: '', startDate: '' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api('/trips').then(setTrips); }, []);
  const go = (path, body) => async (e) => {
    e.preventDefault();
    try { const t = await api(path, 'POST', body); open(t._id); } catch (x) { setErr(x.message); }
  };
  return (
    <>
      {err && <div className="err">{err}</div>}
      <div className="grid">
        <form className="card stack" onSubmit={go('/trips', f)}>
          <h3>Plan a new trip</h3>
          <input required placeholder="Trip name (e.g. Goa 2027)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input placeholder="Destination" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
          <input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          <button>Create trip</button>
        </form>
        <form className="card stack" onSubmit={go('/trips/join', { code })}>
          <h3>Join with an invite code</h3>
          <input required placeholder="6-letter code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button>Join trip</button>
        </form>
      </div>
      <h3>Your trips</h3>
      {trips.length === 0 && <small>No trips yet. Create one or join a friend's trip with their invite code.</small>}
      {trips.map((t) => (
        <div className="card item" key={t._id}>
          <span><b>{t.name}</b> <small>{t.destination}</small></span>
          <button onClick={() => open(t._id)}>Open</button>
        </div>
      ))}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [tripId, setTripId] = useState(null);
  if (!user) return <Auth onAuth={setUser} />;
  return (
    <>
      <header className="top">
        <b onClick={() => setTripId(null)}>TripSync</b>
        <span>{user.name} <button className="link" onClick={() => { localStorage.clear(); setUser(null); setTripId(null); }}>Log out</button></span>
      </header>
      <main>{tripId ? <Trip id={tripId} user={user} /> : <Home open={setTripId} />}</main>
    </>
  );
}
