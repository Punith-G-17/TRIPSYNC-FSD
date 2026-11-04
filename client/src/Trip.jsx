import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, getToken } from './api';

const COLORS = ['#0E8A7D', '#F2B134', '#14232E', '#7FB7BE', '#C8553D'];

const AV = ['#0F766E', '#B7791F', '#2F6F9F', '#7C5CBF', '#B5476B'];
const Avatar = ({ name }) => <span className="av" style={{ background: AV[name.charCodeAt(0) % AV.length] }}>{name[0]}</span>;

export default function Trip({ id, user }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [feed, setFeed] = useState([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/trips/' + id).then(setD).catch((e) => setErr(e.message)), [id]);

  // Real-time: server says "something changed" -> we refetch the trip
  useEffect(() => {
    load();
    const s = io({ auth: { token: getToken() } });
    s.on('connect', () => s.emit('join', id));
    s.on('update', (u) => { setFeed((f) => [`${u.by} changed ${u.type}`, ...f].slice(0, 8)); load(); });
    return () => s.disconnect();
  }, [id, load]);

  const act = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  if (!d) return <div>{err || 'Loading trip...'}</div>;
  const t = d.trip, base = '/trips/' + id;
  const days = t.startDate ? Math.ceil((new Date(t.startDate) - new Date()) / 864e5) : null;
  const props = { d, user, act, base, feed };
  const Tab = { Overview, Itinerary, Polls, Expenses, Checklist }[tab];

  return (
    <>
      <div className="pass">
        <div><h1>{t.name}</h1><div>{t.destination || 'Destination to be decided'}</div></div>
        <div className="stub">{days === null ? <small>No start date</small> : <><div className="big">{Math.max(days, 0)}</div><small>days to go</small></>}</div>
      </div>
      <div className="tabs">
        {['Overview', 'Itinerary', 'Polls', 'Expenses', 'Checklist'].map((n) => (
          <button key={n} className={n === tab ? 'on' : ''} onClick={() => setTab(n)}>{n}</button>
        ))}
      </div>
      {err && <div className="err">{err}</div>}
      <Tab {...props} />
    </>
  );
}

const group = (arr, key) => Object.entries(arr.reduce((m, e) => { const k = key(e); m[k] = (m[k] || 0) + e.amount; return m; }, {}))
  .map(([name, value]) => ({ name, value }));

function Overview({ d, feed }) {
  const total = d.expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = group(d.expenses, (e) => e.category), byPerson = group(d.expenses, (e) => e.paidBy?.name || '?');
  const empty = <small>Add an expense to see this chart.</small>;
  return (
    <>
      <div className="grid">
        <div className="card stat"><h3>Total spent</h3><h2>₹{total.toFixed(0)}</h2><small>{d.expenses.length} expenses, {d.activities.length} planned activities</small></div>
        <div className="card"><h3>Who is going</h3><div className="people">{d.trip.members.map((m) => <span className="chip" key={m._id}><Avatar name={m.name} />{m.name}</span>)}</div><div className="code">{d.trip.code}</div><br /><small>Share this invite code so friends can join</small></div>
      </div>
      <div className="grid">
        <div className="card"><h3>Spend by category</h3>{byCat.length ? (
          <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={byCat} dataKey="value" nameKey="name" outerRadius={80} label>
            {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : empty}</div>
        <div className="card"><h3>Paid by person</h3>{byPerson.length ? (
          <ResponsiveContainer width="100%" height={220}><BarChart data={byPerson}><XAxis dataKey="name" /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="#0E8A7D" /></BarChart></ResponsiveContainer>) : empty}</div>
      </div>
      <div className="card"><h3>Live activity</h3>
        {feed.length ? feed.map((f, i) => <div key={i}>{f}</div>) : <small>Changes from your friends show up here the moment they happen.</small>}</div>
    </>
  );
}

function Itinerary({ d, act, base }) {
  const [f, setF] = useState({ day: 1, time: '', title: '', place: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const days = [...new Set(d.activities.map((a) => a.day))].sort((a, b) => a - b);
  return (
    <>
      <form className="row card" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/activities', 'POST', { ...f, day: Number(f.day) })); setF({ ...f, time: '', title: '', place: '' }); }}>
        <input type="number" min="1" value={f.day} onChange={set('day')} style={{ maxWidth: 80 }} aria-label="Day number" />
        <input type="time" value={f.time} onChange={set('time')} aria-label="Time" />
        <input required placeholder="What are we doing?" value={f.title} onChange={set('title')} />
        <input placeholder="Place" value={f.place} onChange={set('place')} />
        <button>Add activity</button>
      </form>
      {days.length === 0 && <small>Nothing planned yet. Add the first activity above.</small>}
      {days.map((day) => (
        <div className="card" key={day}><h3>Day {day}</h3>
          {d.activities.filter((a) => a.day === day).map((a) => (
            <div className="item" key={a._id}>
              <span><b>{a.time || 'Anytime'}</b> {a.title}{a.place && ` at ${a.place}`} <small>added by {a.by?.name}</small></span>
              <button className="link" onClick={() => act(() => api(`${base}/activities/${a._id}`, 'DELETE'))}>Remove</button>
            </div>))}
        </div>))}
    </>
  );
}

function Polls({ d, user, act, base }) {
  const [q, setQ] = useState(''), [opts, setOpts] = useState('');
  const isAdmin = String(d.trip.admin) === String(user.id);
  return (
    <>
      <form className="row card" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/polls', 'POST', { question: q, options: opts.split(',').map((s) => s.trim()) })); setQ(''); setOpts(''); }}>
        <input required placeholder="Question (e.g. Where should we stay?)" value={q} onChange={(e) => setQ(e.target.value)} />
        <input required placeholder="Options, separated by commas" value={opts} onChange={(e) => setOpts(e.target.value)} />
        <button>Create poll</button>
      </form>
      {d.polls.length === 0 && <small>No polls yet. Ask the group a question above.</small>}
      {d.polls.map((p) => {
        const tot = p.options.reduce((s, o) => s + o.votes.length, 0);
        return (
          <div className="card" key={p._id}>
            <h3>{p.question} {p.locked && '(locked)'}</h3>
            {p.options.map((o, i) => (
              <div key={i} tabIndex={0} className={'opt' + (o.votes.includes(user.id) ? ' mine' : '')}
                onClick={() => !p.locked && act(() => api(`${base}/polls/${p._id}/vote`, 'POST', { index: i }))}>
                <div className="bar" style={{ width: tot ? (o.votes.length / tot) * 100 + '%' : 0 }} /><span>{o.text}</span><b>{o.votes.length}</b>
              </div>))}
            {isAdmin && !p.locked && <button className="link" onClick={() => act(() => api(`${base}/polls/${p._id}/lock`, 'POST'))}>Lock in result</button>}
          </div>);
      })}
    </>
  );
}

function Expenses({ d, act, base }) {
  const [f, setF] = useState({ title: '', amount: '', category: 'Food' });
  const [among, setAmong] = useState(d.trip.members.map((m) => m._id));
  const toggle = (id) => setAmong((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <>
      <form className="card" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/expenses', 'POST', { ...f, splitAmong: among })); setF({ ...f, title: '', amount: '' }); }}>
        <div className="row">
          <input required placeholder="What was it for?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input required type="number" min="1" placeholder="Amount (₹)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {['Food', 'Stay', 'Travel', 'Activities', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <p><small>You paid. Split between:</small>{' '}
          {d.trip.members.map((m) => (
            <label key={m._id} style={{ marginRight: 12 }}><input type="checkbox" checked={among.includes(m._id)} onChange={() => toggle(m._id)} /> {m.name}</label>))}</p>
        <button>Add expense</button>
      </form>
      <div className="card settle"><h3>Settle up</h3>
        {d.settlements.length ? d.settlements.map((s, i) => <div key={i}>{s.from} pays {s.to} ₹{s.amount}</div>) : <small>Everyone is even.</small>}</div>
      <div className="card"><h3>All expenses</h3>
        {d.expenses.length === 0 && <small>No expenses logged yet.</small>}
        {d.expenses.map((e) => (
          <div className="item" key={e._id}>
            <span>{e.title} <small>{e.category}, paid by {e.paidBy?.name}</small></span>
            <span><b>₹{e.amount}</b> <button className="link" onClick={() => act(() => api(`${base}/expenses/${e._id}`, 'DELETE'))}>Remove</button></span>
          </div>))}
      </div>
    </>
  );
}

function Checklist({ d, act, base }) {
  const [text, setText] = useState(''), [who, setWho] = useState('');
  return (
    <>
      <form className="row card" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/items', 'POST', { text, assignee: who })); setText(''); }}>
        <input required placeholder="Item to pack or book" value={text} onChange={(e) => setText(e.target.value)} />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assigned to">
          <option value="">Anyone</option>{d.trip.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <button>Add item</button>
      </form>
      <div className="card">
        {d.items.length === 0 && <small>The checklist is empty. Add the first item above.</small>}
        {d.items.map((i) => (
          <div className="item" key={i._id}>
            <label className={i.done ? 'done' : ''}><input type="checkbox" checked={i.done} onChange={() => act(() => api(`${base}/items/${i._id}`, 'PATCH'))} /> {i.text} <small>{i.assignee ? i.assignee.name : 'anyone'}</small></label>
            <button className="link" onClick={() => act(() => api(`${base}/items/${i._id}`, 'DELETE'))}>Remove</button>
          </div>))}
      </div>
    </>
  );
}
