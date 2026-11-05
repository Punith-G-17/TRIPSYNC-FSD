import { useState, useEffect } from 'react';
import { api } from './api';
import Trip from './Trip';
import Icon, { Mark } from './Icon';
import { TONES } from './theme';

function ThemeToggle({ theme, setTheme }) {
  const dark = theme === 'dark';
  return (
    <button className="btn icon-btn" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

function Auth({ onAuth, theme, setTheme }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const d = await api('/auth/' + mode, 'POST', f);
      localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
      onAuth(d.user);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const login = mode === 'login';
  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="brand"><Mark size={34} /><span>TripSync</span></div>
        <div className="auth-copy">
          <h1>One shared plan for the whole group.</h1>
          <p>Build the itinerary, vote on decisions, split expenses and tick off the packing list together. Everyone sees changes the moment they happen.</p>
        </div>
        <ol className="route" aria-hidden="true">
          <li><i style={{ background: 'var(--accent)' }} /><span>Day 1</span><b>Arrive and check in</b></li>
          <li><i style={{ background: '#5ee0cf' }} /><span>Day 2</span><b>Beach, then dinner</b></li>
          <li><i style={{ background: '#fff' }} /><span>Day 3</span><b>Settle up and head home</b></li>
        </ol>
      </aside>
      <main className="auth-pane">
        <div className="auth-top"><ThemeToggle theme={theme} setTheme={setTheme} /></div>
        <form className="auth-form" onSubmit={submit}>
          <h2>{login ? 'Log in' : 'Create your account'}</h2>
          <p className="muted">{login ? 'Pick up where your group left off.' : 'Free, and it takes under a minute.'}</p>
          {!login && <label className="field"><span>Name</span><input required autoComplete="name" value={f.name} onChange={set('name')} /></label>}
          <label className="field"><span>Email</span><input required type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
          <label className="field"><span>Password</span><input required type="password" autoComplete={login ? 'current-password' : 'new-password'} placeholder="At least 6 characters" value={f.password} onChange={set('password')} /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn primary wide" disabled={busy}>{busy ? 'Please wait...' : login ? 'Log in' : 'Create account'}</button>
          <p className="switch">{login ? 'New to TripSync?' : 'Already have an account?'}{' '}
            <button type="button" className="textbtn" onClick={() => { setMode(login ? 'register' : 'login'); setErr(''); }}>{login ? 'Create an account' : 'Log in'}</button></p>
        </form>
      </main>
    </div>
  );
}

const daysTo = (d) => (d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Home({ open, user }) {
  const [trips, setTrips] = useState(null);
  const [f, setF] = useState({ name: '', destination: '', startDate: '' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState('create');
  useEffect(() => { api('/trips').then(setTrips); }, []);
  const go = (path, body) => async (e) => {
    e.preventDefault();
    try { const t = await api(path, 'POST', body); open(t._id); } catch (x) { setErr(x.message); }
  };
  const hour = new Date().getHours();
  return (
    <>
      <section className="welcome">
        <h1>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {user.name.split(' ')[0]}.</h1>
        <p>Start a new trip or jump back into one you're already planning.</p>
      </section>

      <section className="panel starter" aria-label="Start or join a trip">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={panel === 'create'} className={panel === 'create' ? 'on' : ''} onClick={() => { setPanel('create'); setErr(''); }}><Icon name="plus" size={16} /> New trip</button>
          <button role="tab" aria-selected={panel === 'join'} className={panel === 'join' ? 'on' : ''} onClick={() => { setPanel('join'); setErr(''); }}><Icon name="key" size={16} /> Join with a code</button>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        {panel === 'create' ? (
          <form className="form-row" onSubmit={go('/trips', f)}>
            <label className="field grow"><span>Trip name</span><input required placeholder="Goa 2027" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="field grow"><span>Destination</span><input placeholder="Where to?" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></label>
            <label className="field"><span>Start date</span><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
            <button className="btn primary">Create trip</button>
          </form>
        ) : (
          <form className="form-row" onSubmit={go('/trips/join', { code })}>
            <label className="field grow"><span>Invite code</span><input required placeholder="ABC123" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="codein" autoComplete="off" /></label>
            <button className="btn primary">Join trip</button>
          </form>
        )}
      </section>

      <div className="section-head"><h2>Your trips</h2>{trips && trips.length > 0 && <span className="muted">{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>}</div>
      {trips === null && <div className="skeleton" />}
      {trips && trips.length === 0 && (
        <div className="empty"><Icon name="globe" size={28} /><b>No trips yet</b><p className="muted">Create one above, or join a friend's trip with their invite code.</p></div>
      )}
      <div className="trip-list">
        {trips?.map((t) => {
          const d = daysTo(t.startDate);
          const status = d === null ? 'No date set' : d > 0 ? `${d} ${d === 1 ? 'day' : 'days'} to go` : d === 0 ? 'Starts today' : 'Finished';
          return (
            <button className="trip-card" key={t._id} onClick={() => open(t._id)} style={{ '--tone': TONES[t._id % TONES.length] }}>
              <span className="tone" aria-hidden="true">{(t.destination || t.name).slice(0, 2)}</span>
              <span className="trip-main">
                <b>{t.name}</b>
                <span className="meta"><Icon name="pin" size={14} />{t.destination || 'Destination to be decided'}</span>
              </span>
              <span className="trip-side">
                <span className={'status' + (d !== null && d >= 0 && d <= 14 ? ' soon' : '')}>{status}</span>
                <span className="meta"><Icon name="users" size={14} />{t.memberCount}{t.startDate ? ` · ${fmtDate(t.startDate)}` : ''}</span>
              </span>
              <Icon name="arrow" size={18} className="go" />
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [tripId, setTripId] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);

  if (!user) return <Auth onAuth={setUser} theme={theme} setTheme={setTheme} />;
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setTripId(null); };
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <button className="brand home-link" onClick={() => setTripId(null)} aria-label="TripSync home"><Mark size={30} /><span>TripSync</span></button>
        <div className="top-right">
          <span className="who"><span className="av" aria-hidden="true">{user.name[0]}</span><span className="who-name">{user.name}</span></span>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button className="btn quiet" onClick={logout}><Icon name="logout" size={16} /><span className="hide-sm">Log out</span></button>
        </div>
      </header>
      <main id="main">{tripId ? <Trip id={tripId} user={user} onExit={() => setTripId(null)} /> : <Home open={setTripId} user={user} />}</main>
    </>
  );
}
