import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, getToken, download, timeAgo } from './api';
import Icon from './Icon';
import { TONES } from './theme';

const COLORS = ['#1f43d6', '#f2a516', '#0e9384', '#c7372f', '#7a4fd0'];
const AV = ['#1f43d6', '#0e9384', '#c7372f', '#7a4fd0', '#c97a06', '#0b6a8f'];
const KINDS = { Sightseeing: 'landmark', Food: 'food', Transport: 'car', Stay: 'bed', Fun: 'party' };
const TABS = [['Overview', 'overview'], ['Itinerary', 'route'], ['Polls', 'poll'], ['Expenses', 'wallet'], ['Checklist', 'check'], ['Notes', 'note']];
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

const Avatar = ({ name }) => <span className="av" aria-hidden="true" style={{ background: AV[name.charCodeAt(0) % AV.length] }}>{name[0]}</span>;
const Progress = ({ value, warn, label }) => (
  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, value))} aria-label={label}>
    <div className={warn ? 'warn' : ''} style={{ width: Math.min(100, value) + '%' }} />
  </div>
);
const Empty = ({ icon, title, hint, flat }) => (
  <div className={'empty' + (flat ? ' flat' : '')}><Icon name={icon} size={28} /><b>{title}</b><p className="muted">{hint}</p></div>
);

export default function Trip({ id, user, onExit }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [toast, setToast] = useState(null);
  const load = useCallback(() => api('/trips/' + id).then(setD).catch((e) => setToast({ msg: e.message, bad: true })), [id]);
  const flash = useCallback((msg, bad = false) => setToast({ msg, bad }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  // Real-time: the server says "something changed" -> we refetch the trip
  useEffect(() => {
    load();
    const s = io({ auth: { token: getToken() } });
    s.on('connect', () => s.emit('join', id));
    s.on('update', (u) => {
      if (u.type === 'deleted') { flash('This trip was deleted by the admin', true); setTimeout(onExit, 1200); return; }
      if (u.by !== user.name) flash(`${u.by} updated ${u.type}`);
      load();
    });
    return () => s.disconnect();
  }, [id, load, flash, onExit, user.name]);

  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) flash(okMsg); load(); } catch (e) { flash(e.message, true); } };
  if (!d) return <div className="skeleton tall" />;

  const t = d.trip, base = '/trips/' + id;
  const days = t.startDate ? Math.ceil((new Date(t.startDate) - new Date()) / 864e5) : null;
  const Tab = { Overview, Itinerary, Polls, Expenses, Checklist, Notes }[tab];
  const props = { d, user, act, base, flash, onExit, id };

  return (
    <>
      <header className="hero" style={{ '--tone': TONES[id % TONES.length] }}>
        <button className="back" onClick={onExit}><Icon name="back" size={16} /> All trips</button>
        <div className="hero-body">
          <div className="hero-main">
            <h1>{t.name}</h1>
            <div className="sub"><Icon name="pin" size={16} />{t.destination || 'Destination to be decided'}</div>
            <div className="people-row">
              <span className="stack">{t.members.slice(0, 6).map((m) => <Avatar key={m._id} name={m.name} />)}</span>
              <span>{t.members.length} {t.members.length === 1 ? 'person' : 'people'} going</span>
            </div>
          </div>
          <div className="count" aria-live="polite">
            {days === null ? <span className="count-none">No start date yet</span> : days < 0 ? <><span className="n">Live</span><small>trip in progress</small></> :
              days === 0 ? <><span className="n">Today</span><small>departure day</small></> :
              <><span className="n">{days}</span><small>{days === 1 ? 'day to go' : 'days to go'}</small></>}
          </div>
        </div>
      </header>

      <nav className="tabs" aria-label="Trip sections">
        {TABS.map(([n, ic]) => <button key={n} className={n === tab ? 'on' : ''} aria-current={n === tab ? 'page' : undefined} onClick={() => setTab(n)}><Icon name={ic} size={17} />{n}</button>)}
      </nav>
      <div className="tab-body" key={tab}><Tab {...props} /></div>
      {toast && <div className={'toast' + (toast.bad ? ' bad' : '')} role="status">{toast.msg}</div>}
    </>
  );
}

const group = (arr, key) => Object.entries(arr.reduce((m, e) => { const k = key(e); m[k] = (m[k] || 0) + e.amount; return m; }, {})).map(([name, value]) => ({ name, value }));

function Overview({ d, user, act, base, flash, onExit, id }) {
  const t = d.trip, isAdmin = t.admin === user.id;
  const total = d.expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = group(d.expenses, (e) => e.category), byPerson = group(d.expenses, (e) => e.paidBy?.name || '?');
  const done = d.items.filter((i) => i.done).length;
  const pct = t.budget > 0 ? (total / t.budget) * 100 : 0;
  const [edit, setEdit] = useState({ name: t.name, destination: t.destination || '', startDate: t.startDate || '', budget: t.budget || 0 });
  const empty = <p className="muted chart-empty">Add an expense to see this chart.</p>;
  const copy = () => navigator.clipboard?.writeText(t.code).then(() => flash('Invite code copied'));

  return (
    <>
      <section className="strip" aria-label="Trip summary">
        <div className="stat"><span className="label">Total spent</span><b className="figure">{inr(total)}</b><small className="muted">{d.expenses.length} {d.expenses.length === 1 ? 'expense' : 'expenses'}</small></div>
        <div className="stat"><span className="label">Budget left</span>
          {t.budget > 0 ? <><b className="figure">{inr(Math.max(t.budget - total, 0))}</b><Progress value={pct} warn={pct > 90} label="Budget used" /><small className={pct > 100 ? 'over' : 'muted'}>{pct > 100 ? `Over by ${inr(total - t.budget)}` : `of ${inr(t.budget)}`}</small></>
            : <><b className="figure dim">Not set</b><small className="muted">{isAdmin ? 'Set a budget in trip settings' : 'The admin has not set one yet'}</small></>}</div>
        <div className="stat"><span className="label">Packed</span><b className="figure">{done}<span className="of">/{d.items.length}</span></b><Progress value={d.items.length ? (done / d.items.length) * 100 : 0} label="Checklist progress" /><small className="muted">checklist items</small></div>
        <div className="stat"><span className="label">Planned</span><b className="figure">{d.activities.length}</b><small className="muted">{d.activities.length === 1 ? 'activity' : 'activities'}, {d.polls.length} {d.polls.length === 1 ? 'poll' : 'polls'}</small></div>
      </section>

      <div className="grid">
        <section className="panel"><h3>Who is going</h3>
          <div className="people">{t.members.map((m) => <span className="chip" key={m._id}><Avatar name={m.name} />{m.name}</span>)}</div>
          <div className="invite">
            <div><small className="muted">Invite code</small><span className="code">{t.code}</span></div>
            <button className="btn" onClick={copy}><Icon name="copy" size={16} />Copy code</button>
          </div>
        </section>
        <section className="panel"><h3>Live activity</h3>
          {d.log.length ? <ul className="feed">{d.log.slice(0, 7).map((l) => <li key={l.id}><Avatar name={l.userName} /><span><b>{l.userName}</b> {l.message}<small className="muted"> · {timeAgo(l.createdAt)}</small></span></li>)}</ul>
            : <p className="muted">Changes from your friends show up here the moment they happen.</p>}</section>
      </div>

      <div className="grid">
        <section className="panel"><h3>Spend by category</h3>{byCat.length ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
              {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={inr} /></PieChart></ResponsiveContainer>
            <ul className="legend">{byCat.map((c, i) => <li key={c.name}><i style={{ background: COLORS[i % COLORS.length] }} />{c.name}<b>{inr(c.value)}</b></li>)}</ul>
          </div>) : empty}</section>
        <section className="panel"><h3>Paid by person</h3>{byPerson.length ? (
          <ResponsiveContainer width="100%" height={240}><BarChart data={byPerson}><XAxis dataKey="name" stroke="var(--mute)" tickLine={false} /><YAxis stroke="var(--mute)" tickLine={false} axisLine={false} width={48} /><Tooltip formatter={inr} cursor={{ fill: 'var(--tint)' }} />
            <Bar dataKey="value" fill="#1f43d6" radius={[6, 6, 0, 0]} maxBarSize={56} /></BarChart></ResponsiveContainer>) : empty}</section>
      </div>

      <section className="panel"><h3>Trip settings</h3>
        {isAdmin ? (
          <form className="form-row" onSubmit={(e) => { e.preventDefault(); act(() => api(base, 'PATCH', edit), 'Trip updated'); }}>
            <label className="field grow"><span>Trip name</span><input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="field grow"><span>Destination</span><input value={edit.destination} onChange={(e) => setEdit({ ...edit, destination: e.target.value })} /></label>
            <label className="field"><span>Start date</span><input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></label>
            <label className="field"><span>Budget (₹)</span><input type="number" min="0" value={edit.budget} onChange={(e) => setEdit({ ...edit, budget: e.target.value })} /></label>
            <button className="btn primary">Save changes</button>
          </form>) : <p className="muted">Only the trip admin can change trip details.</p>}
        <div className="danger-zone">
          {isAdmin
            ? <><div><b>Delete this trip</b><small className="muted">Removes it for everyone. This cannot be undone.</small></div><button className="btn danger" onClick={() => confirm('Delete this trip for everyone? This cannot be undone.') && act(() => api(base, 'DELETE').then(onExit))}>Delete trip</button></>
            : <><div><b>Leave this trip</b><small className="muted">You can rejoin later with the invite code.</small></div><button className="btn danger" onClick={() => confirm('Leave this trip?') && act(() => api(base + '/leave', 'POST').then(onExit))}>Leave trip</button></>}
        </div>
      </section>
    </>
  );
}

function Itinerary({ d, act, base }) {
  const [f, setF] = useState({ day: 1, time: '', title: '', place: '', kind: 'Sightseeing' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const days = [...new Set(d.activities.map((a) => a.day))].sort((a, b) => a - b);
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/activities', 'POST', { ...f, day: Number(f.day) }), 'Activity added'); setF({ ...f, time: '', title: '', place: '' }); }}>
        <h3>Add to the plan</h3>
        <div className="form-row">
          <label className="field narrow"><span>Day</span><input type="number" min="1" value={f.day} onChange={set('day')} /></label>
          <label className="field"><span>Time</span><input type="time" value={f.time} onChange={set('time')} /></label>
          <label className="field"><span>Type</span><select value={f.kind} onChange={set('kind')}>{Object.keys(KINDS).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label className="field grow wide-field"><span>What are we doing?</span><input required placeholder="Sunset at Chapora Fort" value={f.title} onChange={set('title')} /></label>
          <label className="field grow"><span>Place</span><input placeholder="Optional" value={f.place} onChange={set('place')} /></label>
          <button className="btn primary">Add activity</button>
        </div>
      </form>
      {days.length === 0 && <Empty icon="route" title="Nothing planned yet" hint="Add the first activity above and it becomes Day 1 of the route." />}
      {days.map((day) => (
        <section className="day" key={day}>
          <h3 className="day-title"><span>Day {day}</span></h3>
          <ol className="route-line">
            {d.activities.filter((a) => a.day === day).map((a) => (
              <li className={'stop k-' + (a.kind || 'Sightseeing')} key={a._id}>
                <span className="node" title={a.kind || 'Sightseeing'}><Icon name={KINDS[a.kind] || 'pin'} size={16} /></span>
                <div className="stop-body">
                  <b>{a.title}</b>
                  <span className="muted">{a.time || 'Anytime'}{a.place && ` · ${a.place}`} · added by {a.by?.name}</span>
                </div>
                <button className="btn icon-btn quiet" aria-label={`Remove ${a.title}`} onClick={() => act(() => api(`${base}/activities/${a._id}`, 'DELETE'))}><Icon name="x" size={16} /></button>
              </li>))}
          </ol>
        </section>))}
    </>
  );
}

function Polls({ d, user, act, base }) {
  const [q, setQ] = useState(''), [opts, setOpts] = useState('');
  const isAdmin = String(d.trip.admin) === String(user.id);
  const vote = (p, i) => !p.locked && act(() => api(`${base}/polls/${p._id}/vote`, 'POST', { index: i }));
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/polls', 'POST', { question: q, options: opts.split(',').map((s) => s.trim()) }), 'Poll created'); setQ(''); setOpts(''); }}>
        <h3>Ask the group</h3>
        <div className="form-row">
          <label className="field grow"><span>Question</span><input required placeholder="Where should we stay?" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field grow"><span>Options</span><input required placeholder="Separate with commas: Beach hut, Hostel, Villa" value={opts} onChange={(e) => setOpts(e.target.value)} /></label>
          <button className="btn primary">Create poll</button>
        </div>
      </form>
      {d.polls.length === 0 && <Empty icon="poll" title="No polls yet" hint="Put a decision to the group and watch the votes come in." />}
      <div className="poll-list">
        {d.polls.map((p) => {
          const tot = p.options.reduce((s, o) => s + o.votes.length, 0), top = Math.max(...p.options.map((o) => o.votes.length));
          return (
            <section className="panel" key={p._id}>
              <div className="spread"><h3>{p.question}</h3>{p.locked && <span className="tag"><Icon name="lock" size={13} />Result locked</span>}</div>
              <div className="opts">
                {p.options.map((o, i) => {
                  const mine = o.votes.includes(user.id), win = p.locked && tot > 0 && o.votes.length === top;
                  return (
                    <button key={i} type="button" disabled={p.locked} aria-pressed={mine}
                      className={'opt' + (mine ? ' mine' : '') + (p.locked ? ' closed' : '') + (win ? ' win' : '')} onClick={() => vote(p, i)}>
                      <span className="bar" style={{ width: tot ? (o.votes.length / tot) * 100 + '%' : 0 }} />
                      <span className="opt-text">{win && <Icon name="trophy" size={16} />}{o.text}{mine && <small>Your vote</small>}</span>
                      <b>{tot ? Math.round((o.votes.length / tot) * 100) : 0}%<small> · {o.votes.length} {o.votes.length === 1 ? 'vote' : 'votes'}</small></b>
                    </button>);
                })}
              </div>
              {isAdmin && !p.locked && <button className="btn" onClick={() => act(() => api(`${base}/polls/${p._id}/lock`, 'POST'), 'Result locked')}><Icon name="lock" size={16} />Lock in result</button>}
            </section>);
        })}
      </div>
    </>
  );
}

function Expenses({ d, act, base, flash }) {
  const [f, setF] = useState({ title: '', amount: '', category: 'Food' });
  const [among, setAmong] = useState(d.trip.members.map((m) => m._id));
  const toggle = (id) => setAmong((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/expenses', 'POST', { ...f, splitAmong: among }), 'Expense added'); setF({ ...f, title: '', amount: '' }); }}>
        <h3>Log an expense</h3>
        <div className="form-row">
          <label className="field grow"><span>What was it for?</span><input required placeholder="Dinner at the beach shack" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field"><span>Amount (₹)</span><input required type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="field"><span>Category</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {['Food', 'Stay', 'Travel', 'Activities', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </select></label>
        </div>
        <fieldset className="splitrow"><legend>You paid. Split between</legend>
          {d.trip.members.map((m) => <label key={m._id} className={'toggle' + (among.includes(m._id) ? ' on' : '')}><input type="checkbox" checked={among.includes(m._id)} onChange={() => toggle(m._id)} />{m.name}</label>)}
        </fieldset>
        <button className="btn primary">Add expense</button>
      </form>

      <section className="panel settle"><h3>Settle up</h3>
        {d.settlements.length ? d.settlements.map((s, i) => (
          <div className="pay" key={i}><b>{s.from}</b><span className="pays">pays</span><b>{s.to}</b><span className="amt">{inr(s.amount)}</span></div>
        )) : <p className="muted">Everyone is even. Nobody owes anything.</p>}</section>

      <section className="panel"><div className="spread"><h3>All expenses</h3>
        {d.expenses.length > 0 && <button className="btn" onClick={() => download(base + '/export', 'expenses.csv').catch((e) => flash(e.message, true))}><Icon name="download" size={16} />Export CSV</button>}</div>
        {d.expenses.length === 0 && <p className="muted">No expenses logged yet.</p>}
        {d.expenses.map((e) => (
          <div className="item" key={e._id}>
            <span><b>{e.title}</b><small className="muted block">{e.category} · paid by {e.paidBy?.name}</small></span>
            <span className="item-end"><b className="num">{inr(e.amount)}</b><button className="btn icon-btn quiet" aria-label={`Delete ${e.title}`} onClick={() => act(() => api(`${base}/expenses/${e._id}`, 'DELETE'))}><Icon name="x" size={16} /></button></span>
          </div>))}
      </section>
    </>
  );
}

function Checklist({ d, act, base }) {
  const [text, setText] = useState(''), [who, setWho] = useState('');
  const done = d.items.filter((i) => i.done).length;
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/items', 'POST', { text, assignee: who })); setText(''); }}>
        <h3>Add an item</h3>
        <div className="form-row">
          <label className="field grow"><span>Item to pack or book</span><input required placeholder="Sunscreen" value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label className="field"><span>Assigned to</span><select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Anyone</option>{d.trip.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select></label>
          <button className="btn primary">Add item</button>
        </div>
      </form>
      <section className="panel">
        {d.items.length > 0 && <><div className="spread"><b>{done} of {d.items.length} done</b><span className="muted">{Math.round((done / d.items.length) * 100)}%</span></div><Progress value={(done / d.items.length) * 100} label="Checklist progress" /></>}
        {d.items.length === 0 && <Empty flat icon="check" title="The checklist is empty" hint="Add the first item above." />}
        {d.items.map((i) => (
          <div className="item" key={i._id}>
            <label className={'check' + (i.done ? ' done' : '')}><input type="checkbox" checked={i.done} onChange={() => act(() => api(`${base}/items/${i._id}`, 'PATCH'))} /><span>{i.text}</span>{i.assignee && <small className="tag">{i.assignee.name}</small>}</label>
            <button className="btn icon-btn quiet" aria-label={`Remove ${i.text}`} onClick={() => act(() => api(`${base}/items/${i._id}`, 'DELETE'))}><Icon name="x" size={16} /></button>
          </div>))}
      </section>
    </>
  );
}

function Notes({ d, user, act, base }) {
  const [body, setBody] = useState('');
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => api(base + '/notes', 'POST', { body }), 'Note posted'); setBody(''); }}>
        <h3>Pin a note</h3>
        <textarea required rows={3} maxLength={500} aria-label="Note" placeholder="A tip, a link or a reminder for the group" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="spread"><small className="muted">{body.length}/500</small><button className="btn primary">Post note</button></div>
      </form>
      {d.notes.length === 0 && <Empty icon="note" title="No notes yet" hint="Pin useful info for everyone here." />}
      <div className="notes">
        {d.notes.map((n) => (
          <article className="note" key={n._id}>
            <p>{n.body}</p>
            <div className="spread"><small className="muted by"><Avatar name={n.byName} />{n.byName} · {timeAgo(n.createdAt)}</small>
              {(n.userId === user.id || d.trip.admin === user.id) && <button className="textbtn danger-text" onClick={() => act(() => api(`${base}/notes/${n._id}`, 'DELETE'))}>Delete</button>}</div>
          </article>))}
      </div>
    </>
  );
}
