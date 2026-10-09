/* =========================================================
   FIND IT AT HOME! — client
   Find it. Click it. Upload it. Win it!
   ========================================================= */
(() => {
'use strict';

// ---------- constants ----------
const AVATARS = ['🦊', '🐼', '🦉', '🐯', '🐸', '🐙', '🦁', '🐨', '🐧', '🦝', '🐶', '🐱'];
const EMOJI = {
  positive: [['✅', 'Correct object'], ['👍', 'This matches'], ['💯', 'Perfect match'], ['🎯', 'Exact match'], ['👏', 'Approved']],
  action:   [['❌', 'Wrong object'], ['🔄', 'Please retake'], ['🔍', 'Photo is unclear'], ['👎', 'Does not match']],
  unsure:   [['🤔', 'Not sure']],
};
const ALL_LABELS = Object.fromEntries([...EMOJI.positive, ...EMOJI.action, ...EMOJI.unsure]);
const AVATAR_NAMES = { '🦊': 'Fox', '🐼': 'Panda', '🦉': 'Owl', '🐯': 'Tiger', '🐸': 'Frog', '🐙': 'Octopus', '🦁': 'Lion', '🐨': 'Koala', '🐧': 'Penguin', '🦝': 'Raccoon', '🐶': 'Dog', '🐱': 'Cat' };
const LEVELS = { '1': 'Word Hunt', '2': 'Riddle Hunt', '3': 'Learn & Find', mixed: 'Mixed (1→2→3)' };
const STATUS_TEXT = { pending: 'Checking', approved: 'Approved', rejected: 'Not a match', retake: 'Retake asked' };

// ---------- storage (never required) ----------
const store = {
  get(k, d, s = localStorage) { try { const v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch {} },
  del(k, s = localStorage) { try { s.removeItem(k); } catch {} },
};
const SS = (() => { try { return sessionStorage; } catch { return null; } })();

// ---------- app state ----------
const prefs = store.get('fiah.prefs', {});
const S = {
  ws: null, online: false, room: null, you: null, photos: {}, offset: 0,
  modal: null, modalAt: 0, confirm: null, lastPhase: null,
  view: { key: null, at: 0, base: 0 }, enterBase: 0, fx: new Map(), bumps: {}, timeline: [], lastTick: null,
  ui: {
    screen: 'intro', tab: 'host',
    name: prefs.name || '', avatar: prefs.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    code: '', typeText: '',
    settings: Object.assign({ seats: 4, mode: 'random', level: 'mixed', rounds: 5, timer: 120 }, prefs.settings || {}),
    capture: null, takenAt: null, busy: false, slow: false,
    nameError: '', codeError: '', uploadError: '',
  },
};

// deep link: /join/ABCD or ?room=ABCD
const linkCode = (location.pathname.match(/\/join\/([A-Za-z]{4})/) || [])[1] || new URLSearchParams(location.search).get('room');
if (linkCode) { S.ui.code = linkCode.toUpperCase(); S.ui.tab = 'join'; S.ui.screen = 'home'; }

// ---------- helpers ----------
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const me = () => S.room && S.room.players.find(p => p.id === S.you);
const player = id => S.room && S.room.players.find(p => p.id === id);
const isHost = () => S.room && S.room.hostId === S.you;
const now = () => Date.now() + S.offset;
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const clock = ms => { const s = ms / 1000; return s < 60 ? `${s.toFixed(1)}s` : mmss(ms); };

function send(msg) {
  if (S.ws && S.ws.readyState === 1) { S.ws.send(JSON.stringify(msg)); return true; }
  toast('Not connected. Reconnecting…', true);
  return false;
}

function toast(text, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  if (err) Sound.error();
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// one polite live region for status changes, so screen readers hear what happened without re-reading the page
function announce(text) {
  const el = $('#announce');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
}

// sound & motion live in fx.js
const { Sound, Music, FX } = window;
const SOUND_STATES = {
  all: { icon: '🔊', label: 'Music and sound effects on' },
  fx: { icon: '🔈', label: 'Music off, sound effects on' },
  off: { icon: '🔇', label: 'All sound off' },
};

// ---------- motion bookkeeping ----------
// render() rebuilds the page on every update, so animations are keyed:
// an element animates the first time its key is seen, and --since lets a
// re-render mid-animation resume at the right frame instead of replaying.
const NEW_WINDOW = 1800;
function fxa(key, i = 0) {
  if (!S.fx.has(key)) S.fx.set(key, Date.now());
  const e = Date.now() - S.fx.get(key);
  return e < NEW_WINDOW ? ` data-new style="--since:${e}ms;--i:${i}"` : '';
}
// same, but only for keys marked by an interaction (a tap), never on first sight
function pop(key) {
  const t = S.fx.get(key);
  const e = t ? Date.now() - t : Infinity;
  return e < NEW_WINDOW ? ` data-new style="--since:${e}ms"` : '';
}
const mark = key => S.fx.set(key, Date.now());
function later(ms, fn) { S.timeline.push(setTimeout(fn, ms)); }
function clearTimeline() { S.timeline.forEach(clearTimeout); S.timeline = []; }

const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

// invite links must work on other devices, so swap localhost for the Wi-Fi address
const shareBase = () =>
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && S.lan ? S.lan : location.origin;

// ---------- network ----------
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  S.ws = ws;
  ws.onopen = () => {
    S.online = true;
    const sess = SS && store.get('fiah.session', null, SS);
    if (sess) send({ t: 'resume', code: sess.code, pid: sess.pid });
    render();
  };
  ws.onclose = () => {
    S.online = false; render();
    setTimeout(connect, 1500);
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    onMessage(m);
  };
}

function onMessage(m) {
  switch (m.t) {
    case 'hello': S.lan = m.lan; render(); break;
    case 'state': {
      const prev = S.room;
      if (!prev) { S.ui.busy = false; S.ui.nameError = ''; S.ui.codeError = ''; }
      S.room = m.room; S.you = m.you;
      S.offset = m.room.serverNow - Date.now();
      if (SS) store.set('fiah.session', { code: m.room.code, pid: m.you }, SS);
      react(prev, m.room);
      phaseChange(prev, m.room);
      render();
      break;
    }
    case 'photo': S.photos[m.id] = m.data; render(); break;
    case 'uploaded':
      Object.assign(S.ui, { capture: null, busy: false, slow: false, uploadError: '' });
      Sound.sent(); announce('Photo uploaded. Waiting for it to be checked.'); render(); break;
    case 'firstUpload': {
      const p = player(m.pid);
      const first = S.room && S.room.uploads.filter(u => u.status !== 'pending').length === 0;
      const who = p ? (p.id === S.you ? 'You' : p.name) : 'Someone';
      flash(first ? `${who} uploaded first!` : `Next upload: ${who}`, p && p.id === S.you ? 'Now the others check it' : 'Check the photo. It only counts if approved.');
      announce(`${who} uploaded ${first ? 'first' : 'a photo'}. ${p && p.id === S.you ? 'The others are checking it.' : 'Please check the photo.'}`);
      Sound.alert(); later(260, Sound.stamp); buzz([80, 40, 80]);
      break;
    }
    case 'toast': toast(m.text); break;
    case 'error': {
      // show the problem next to the thing that caused it where possible
      const u = S.ui;
      if (!S.room && /name/i.test(m.text)) { u.nameError = m.text; Sound.error(); }
      else if (!S.room && u.tab === 'join' && u.screen === 'home') { u.codeError = m.text; Sound.error(); }
      else if (S.room && u.busy && u.capture) { u.uploadError = m.text; Sound.error(); announce('Upload failed. ' + m.text); }
      else toast(m.text, true);
      u.busy = false; u.slow = false;
      render();
      break;
    }
    case 'resumeFailed': if (SS) store.del('fiah.session', SS); S.room = null; S.fx.clear(); render(); break;
    case 'left': if (SS) store.del('fiah.session', SS); S.room = null; S.photos = {}; S.fx.clear(); clearTimeline(); S.ui.screen = 'home'; render(); break;
  }
}

// small reactions to what other players just did
function react(prev, cur) {
  if (!prev || prev.code !== cur.code) return;
  if (cur.phase === 'lobby' && cur.players.length > prev.players.length) Sound.pin();
  if (cur.phase === 'hunt' && cur.reviewing && cur.reviewing !== prev.reviewing) Sound.paper();
  if (cur.reviewing && cur.reviewing === prev.reviewing) {
    const a = prev.uploads.find(u => u.id === cur.reviewing), b = cur.uploads.find(u => u.id === cur.reviewing);
    const iJustVoted = b && b.votes[S.you] && (!a || a.votes[S.you] !== b.votes[S.you]);
    if (a && b && !iJustVoted && Object.keys(b.votes).length > Object.keys(a.votes).length) Sound.blip();
  }
  // a verdict on my own photo
  for (const u of cur.uploads) {
    if (u.pid !== S.you || u.status === 'pending' || u.status === 'approved') continue;
    const o = prev.uploads.find(x => x.id === u.id);
    if (o && o.status === 'pending' && !cur.solo) { Sound.stamp(); buzz([60, 40, 60]); }
  }
  for (const p of cur.players) {
    const o = prev.players.find(x => x.id === p.id);
    if (o && p.score > o.score) S.bumps[p.id] = Date.now();
  }
}

function phaseChange(prev, cur) {
  const key = `${cur.phase}:${cur.round}`;
  if (key === S.lastPhase) return;
  S.lastPhase = key;
  clearTimeline();
  if (cur.phase === 'hunt' || cur.phase === 'choose') { S.ui.capture = null; S.ui.busy = false; S.ui.typeText = ''; }
  if (cur.phase === 'hunt' && (!prev || prev.phase !== 'hunt')) {
    // title card first, then the case file is dealt in underneath it
    const c = cur.challenge;
    FX.slate(esc(cur.tiebreak ? 'Tiebreaker' : `Case ${cur.round} of ${cur.totalRounds}`), c ? esc(c.typedBy ? 'Home item' : c.levelName) : '');
    S.enterBase = FX.reduced() ? 0 : 1050;
    Sound.start(); buzz(120); Music.duck(1600);
    if (c) announce(`${cur.tiebreak ? 'Tiebreaker' : `Round ${cur.round} of ${cur.totalRounds}`}. ${c.level === 1 ? 'Find: ' + c.text : c.text}`);
    later(1050, Sound.paper);
  }
  if (cur.phase === 'choose' || (cur.phase === 'lobby' && prev && prev.phase !== 'lobby')) Sound.paper();
  if (cur.phase === 'result' || cur.phase === 'final') { FX.clearOverlays(); Music.duck(cur.phase === 'final' ? 5000 : 3000); }
  if (cur.phase === 'result') {
    // timed to the stamp hitting the paper in the CSS (~600ms)
    const res = cur.lastResult || {};
    const wp = res.winnerId && cur.players.find(p => p.id === res.winnerId);
    announce(wp ? `Case solved. ${wp.id === S.you ? 'You win' : wp.name + ' wins'} this round.` : 'No winner this round.');
    if (res.winnerId) {
      // solo keeps the big burst for the finale
      later(600, () => { Sound.stamp(); FX.confetti({ count: cur.solo ? 70 : res.winnerId === S.you ? 170 : 70, origin: [.5, .28] }); });
      later(780, Sound.win);
      later(1050, Sound.point);
      if (res.winnerId === S.you) buzz([100, 50, 100, 50, 200]);
    } else {
      later(600, Sound.stamp);
      later(820, Sound.lose);
    }
  }
  if (cur.phase === 'final' && cur.solo) {
    // score this run against the best one saved on this phone for the same setup
    const solved = cur.history.filter(h => h.winnerId).length;
    const time = cur.history.reduce((t, h) => t + (h.winnerId ? h.time : 0), 0);
    const k = `fiah.best.${cur.settings.level}.${cur.totalRounds}.${cur.settings.timer}`;
    const prev = store.get(k, null);
    const isNew = solved > 0 && (!prev || solved > prev.solved || (solved === prev.solved && time < prev.time));
    if (isNew) store.set(k, { solved, time });
    S.solo = { solved, time, prev, isNew };
    later(600, () => { Sound.stamp(); if (solved) FX.confetti({ count: isNew ? 220 : 110, origin: [.5, .3], power: isNew ? 1.15 : 1 }); });
    later(800, solved ? (isNew ? Sound.fanfare : Sound.win) : Sound.lose);
    if (isNew) later(800, () => buzz([100, 50, 100, 50, 260]));
  } else if (cur.phase === 'final') {
    // podium: 3rd and 2nd thud into place, drumroll, then the winner lands with the stamp
    later(500, Sound.thud);
    later(1000, Sound.thud);
    later(1150, () => Sound.drumroll(1.5));
    later(2650, () => { Sound.stamp(); Sound.fanfare(); FX.confetti({ count: 220, origin: [.5, .32], power: 1.15 }); });
    later(2700, () => buzz([100, 50, 100, 50, 260]));
  }
  if (cur.phase === 'lobby') { S.photos = {}; }
  window.scrollTo({ top: 0, behavior: FX.reduced() ? 'auto' : 'smooth' });
}

function flash(text, sub = '') {
  const el = document.createElement('div');
  el.className = 'flash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="flash-card"><div class="stamp stamp-in">${esc(text)}</div>${sub ? `<p class="flash-sub">${esc(sub)}</p>` : ''}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ---------- camera ----------
const cam = document.createElement('input');
cam.type = 'file'; cam.accept = 'image/*'; cam.setAttribute('capture', 'environment'); cam.className = 'sr-only';
cam.setAttribute('aria-hidden', 'true'); cam.tabIndex = -1;
document.body.appendChild(cam);
cam.addEventListener('change', async () => {
  const f = cam.files && cam.files[0];
  cam.value = '';
  if (!f) return;
  try {
    S.ui.capture = await compress(f);
    S.ui.takenAt = f.lastModified || Date.now();
    S.ui.capId = (S.ui.capId || 0) + 1;
    Sound.shutter(); FX.flash(); buzz(40);
    render();
  } catch (e) { toast('Could not read that photo. Try again.', true); }
});

async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 960, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.76);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- shared components ----------
const magnifierSVG = `
<svg class="magnifier" viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="50" cy="50" r="32" fill="rgba(200,230,255,.35)" stroke="#2b1d12" stroke-width="9"/>
  <circle cx="50" cy="50" r="32" fill="none" stroke="#c9a46a" stroke-width="3"/>
  <path d="M38 36a18 18 0 0 1 18-6" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>
  <path d="M74 74l26 26" stroke="#2b1d12" stroke-width="16" stroke-linecap="round"/>
  <path d="M76 76l22 22" stroke="#b3261e" stroke-width="8" stroke-linecap="round"/>
</svg>`;

const cameraSVG = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 16h7l3-5h12l3 5h7a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3z" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="24" cy="27" r="7.5" stroke="currentColor" stroke-width="3.5"/></svg>`;

function topbar(back = false) {
  const r = S.room;
  let chip = '';
  if (r && r.round) chip = r.tiebreak ? `<span class="round-chip">Tiebreaker</span>` : `<span class="round-chip">Round ${r.round} of ${r.totalRounds}</span>`;
  return `<header class="topbar${chip ? ' in-game' : ''}">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Back to start" title="Back">←</button>` : ''}
    <div class="brand"><span aria-hidden="true">🔎</span><span class="brand-text">Find It at Home!</span></div>
    ${chip}
    ${r && r.phase !== 'lobby' ? `<button class="icon-btn" data-act="scores" aria-label="Open scoreboard" title="Scoreboard">🏆</button>` : ''}
    ${soundBtn()}
    <button class="icon-btn" data-act="rules" aria-label="How to play" title="How to play">?</button>
  </header>`;
}

// one button cycles: music + effects -> effects only -> off
function soundBtn(cls = '') {
  const st = SOUND_STATES[Sound.state()];
  return `<button class="icon-btn ${cls}" data-act="sound" aria-label="Sound: ${st.label}. Tap to change." title="${st.label}">${st.icon}</button>`;
}

function chips(name, options, value) {
  return `<div class="chips">${options.map(([v, label]) => {
    const on = String(v) === String(value);
    return `<button type="button" class="chip" data-act="set" data-k="${name}" data-v="${v}" aria-pressed="${on}"${on ? pop(`chip:${name}:${v}`) : ''}>${label}</button>`;
  }).join('')}</div>`;
}

// a labelled group of options (fieldset + legend keeps it understandable for screen readers)
const group = (title, body, extra = '') => `<fieldset class="field"><legend class="label step">${title}</legend>${body}${extra}</fieldset>`;

function rankList(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0, last = null;
  return sorted.map((p, i) => { if (p.score !== last) { rank = i + 1; last = p.score; } return { ...p, rank }; });
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function scoreboard(title = 'Case Board') {
  const r = S.room;
  const ranked = rankList(r.players);
  const order = [...r.uploads].sort((a, b) => a.at - b.at);
  const rows = ranked.map(p => {
    const last = order.filter(u => u.pid === p.id).pop();
    const lead = p.rank === 1 && p.score > 0;
    const bump = Date.now() - (S.bumps[p.id] || 0) < NEW_WINDOW ? ` data-new style="--since:${Date.now() - S.bumps[p.id]}ms"` : '';
    return `<tr class="${p.id === S.you ? 'me' : ''}${lead ? ' lead' : ''}">
      <td class="rank">${ordinal(p.rank)}</td>
      <td>
        <div class="pl"><span class="av" aria-hidden="true">${p.avatar}</span>
          <div class="pl-text">
            <span class="nm">${esc(p.name)}</span><span class="wins-inline sub"> · ${plural(p.won, 'win')}</span>${p.id === S.you ? '<span class="tag-chip">You</span>' : ''}${lead ? '<span class="tag-chip gold">Leader</span>' : ''}${p.connected ? '' : '<span class="sub"> (away)</span>'}
            ${last && r.phase === 'hunt' ? `<div class="status"><span class="badge ${last.status}">${STATUS_TEXT[last.status]}</span> <span class="sub">upload #${order.indexOf(last) + 1} · ${clock(last.at)}</span></div>` : ''}
          </div>
        </div>
      </td>
      <td class="num won">${p.won}</td>
      <td class="num pts"${bump}>${p.score}</td>
    </tr>`;
  }).join('');
  return `<section class="grid-paper scoreboard" aria-label="${esc(title)}">
    <div class="score-head"><h2 class="h2">${esc(title)}</h2><span class="eyebrow">${r.phase === 'final' ? plural(r.history.length, 'round') : r.tiebreak ? 'Tiebreaker' : `Round ${r.round || 0} of ${r.totalRounds}`}</span></div>
    <table class="score-table">
      <thead><tr><th scope="col">Rank</th><th scope="col">Detective</th><th scope="col" class="num">Wins</th><th scope="col" class="num">Points</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function challengeCard() {
  const r = S.room, c = r.challenge;
  if (!c) return '';
  const typed = c.typedBy ? player(c.typedBy) : null;
  const longest = Math.max(...c.text.split(/\s+/).map(w => w.length));
  const main = c.level === 1
    ? `<div class="clue-label">Find this object</div><div class="word" style="--n:${Math.max(6, longest)}">${esc(c.text)}</div>`
    : c.level === 2
      ? `<div class="clue-label">Solve the riddle</div><p class="riddle">“${esc(c.text)}”</p>`
      : `<div class="clue-label">Learn &amp; find</div><p class="riddle learn">${esc(c.text)}</p>`;
  const how = c.level === 2 ? 'Work out the answer, find it at home and take a photo.' : 'Find it at home and take a photo.';
  return `<section class="paper casefile tilt-l" aria-label="The clue">
    <div class="case-meta"><span class="eyebrow">${typed ? 'Home item' : esc(c.levelName)}</span>${typed ? `<span class="by-line">Chosen by ${typed.avatar} ${esc(typed.name)}</span>` : ''}</div>
    <div class="challenge-text">
      <span class="icon" aria-hidden="true">${c.icon}</span>
      ${main}
      ${c.answer && c.level !== 1 ? `<div class="answer">Answer: <b>${esc(c.answer)}</b></div>` : ''}
    </div>
    ${r.phase === 'hunt' && !r.reviewing ? `<p class="how">${how}</p>` : ''}
  </section>`;
}

// ---------- screens ----------
function viewIntro() {
  return `<div class="screen intro">
    ${soundBtn('corner')}
    <section class="paper tilt-l intro-hero">
      <span class="file-no">CASE FILE #001</span>
      <span class="stamp conf" aria-hidden="true">Top secret</span>
      ${magnifierSVG}
      <h1 class="game-title">Find it <span>at home!</span></h1>
      <p class="tagline">Find it. Click it. Upload it. <b>Win it!</b></p>
      <ul class="intro-meta" aria-label="About the game">
        <li><b>1–6</b>players</li>
        <li><b>2</b>game modes</li>
        <li><b>1 point</b>per verified win</li>
      </ul>
    </section>
    <div class="intro-actions">
      <button class="btn btn-red btn-lg" data-act="play" data-v="host">▶ Play Game</button>
      <button class="btn btn-dark" data-act="play" data-v="join">Join a game</button>
      <button class="btn btn-paper" data-act="rules">How to play</button>
    </div>
  </div>`;
}

const LEVEL_INFO = {
  '1': 'Find the object named on the card.',
  '2': 'Solve a riddle, then find the answer.',
  '3': 'Find anything that fits a description, like “something soft”.',
  mixed: 'Rounds go Word Hunt → Riddle Hunt → Learn & Find, then repeat.',
};

function nameField() {
  const u = S.ui, err = u.nameError;
  return `<div class="field">
      <label class="label step" for="nm">Your detective name</label>
      <input class="input" id="nm" data-model="name" maxlength="16" autocomplete="nickname" placeholder="Type your name" value="${esc(u.name)}"
        aria-describedby="nm-help${err ? ' nm-err' : ''}"${err ? ' aria-invalid="true"' : ''}>
      ${err ? `<p class="field-error" id="nm-err" role="alert">${esc(err)}</p>` : `<p class="help" id="nm-help">This is how the other players will see you.</p>`}
    </div>
    ${group('Pick your avatar', `<div class="avatars">${AVATARS.map(a =>
      `<button type="button" class="avatar-opt" data-act="avatar" data-v="${a}" aria-pressed="${a === u.avatar}" aria-label="${AVATAR_NAMES[a] || 'Avatar'}"${a === u.avatar ? pop('av:' + a) : ''}>${a}</button>`).join('')}</div>`)}`;
}

function viewHome() {
  const u = S.ui, s = u.settings, host = u.tab === 'host', solo = s.seats === 1;
  const busy = !S.online || u.busy;
  const modeCard = (v, icon, title, text, ex) => `<button type="button" class="mode-card" data-act="set" data-k="mode" data-v="${v}" aria-pressed="${s.mode === v}"${s.mode === v ? pop('chip:mode:' + v) : ''}>
      <span class="mode-top"><span class="mode-icon" aria-hidden="true">${icon}</span><span class="mode-check" aria-hidden="true">✓</span></span>
      <b>${title}</b><small>${text}</small><span class="ex">Example: ${ex}</span></button>`;
  const others = s.seats - 1;
  const settings = `
    ${group('How many players?', chips('seats', [[1, 'Solo'], ...[2, 3, 4, 5, 6].map(n => [n, n])], s.seats),
      `<p class="help">${solo ? 'Just you against the clock. You check your own photos, honestly!' : `You and ${plural(others, 'friend')}, each on your own phone.`}</p>`)}
    ${solo ? '' : group('Game mode', `<div class="modes">
      ${modeCard('random', '🎲', 'Random', 'The computer picks the clue. Everyone gets the same challenge.', 'SPOON')}
      ${modeCard('type', '⌨️', 'Type a Home Item', 'Players take turns choosing an item. Everyone races to find it.', 'WATER BOTTLE')}
    </div>`)}
    ${s.mode === 'random' || solo ? group('Level', chips('level', Object.entries(LEVELS), s.level), `<p class="help">${LEVEL_INFO[s.level] || ''}</p>`) : ''}
    ${group('Rounds', chips('rounds', [[3, 3], [5, 5], [7, 7], [10, 10]], s.rounds))}
    ${group('Time per round', chips('timer', [[0, 'No timer'], [60, '1 min'], [90, '1½ min'], [120, '2 min'], [180, '3 min']], s.timer))}`;
  const hostForm = `
    <div class="setup-grid">
      <div class="setup-col">${nameField()}</div>
      <div class="setup-col">${settings}</div>
    </div>
    <div class="cta">
      <button class="btn btn-red btn-lg" data-act="create" ${busy ? 'disabled' : ''}>${u.busy ? 'Opening…' : solo ? 'Start solo game' : 'Create game'}</button>
      <p class="help center">${solo ? 'Your first clue appears straight away.' : 'Next: invite players with a 4-letter code.'}</p>
    </div>`;
  const cerr = u.codeError;
  const joinForm = `
    ${nameField()}
    <div class="field">
      <label class="label step" for="cd">Game code</label>
      <input class="input code" id="cd" data-model="code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(u.code)}"
        aria-describedby="cd-help${cerr ? ' cd-err' : ''}"${cerr ? ' aria-invalid="true"' : ''}>
      ${cerr ? `<p class="field-error" id="cd-err" role="alert">${esc(cerr)}</p>` : `<p class="help" id="cd-help">4 letters, shown on the host's screen.</p>`}
    </div>
    <div class="cta"><button class="btn btn-red btn-lg" data-act="join" ${busy ? 'disabled' : ''}>${u.busy ? 'Joining…' : 'Join game'}</button></div>`;
  return `<div class="screen${host ? ' wide' : ''}">
    ${topbar(true)}
    <section class="folder setup" data-tab="${host ? 'New game' : 'Join a game'}">
      <div class="paper">
        <h1 class="h1">${host ? 'Set up your game' : 'Join a game'}</h1>
        ${host ? hostForm : joinForm}
      </div>
    </section>
  </div>`;
}

function viewLobby() {
  const r = S.room, base = shareBase(), url = `${base}/join/${r.code}`;
  const slots = [];
  for (let i = 0; i < Math.max(r.seats, r.players.length); i++) {
    const p = r.players[i];
    slots.push(p
      ? `<li class="suspect ${p.connected ? '' : 'offline'}"${fxa('p:' + p.id, i)}><span class="pin"></span><div class="mug" aria-hidden="true">${p.avatar}</div><div class="name">${esc(p.name)}</div><div class="role">${p.id === r.hostId ? 'Host' : p.id === S.you ? 'You' : 'Detective'}</div></li>`
      : `<li class="suspect empty"><div class="mug" aria-hidden="true">?</div><div class="name">Empty seat</div><div class="role">waiting…</div></li>`);
  }
  const n = r.players.length;
  const copied = Date.now() - (S.fx.get('copy') || 0) < 1600;
  return `<div class="screen">
    ${topbar()}
    <section class="paper invite">
      <span class="eyebrow">Game code</span>
      <div class="lobby-head">
        <span class="tag" aria-label="Game code ${esc(r.code.split('').join(' '))}">${esc(r.code)}</span>
        <button class="btn btn-dark btn-sm" data-act="copy" data-v="${esc(url)}"${pop('copy')}>${copied ? 'Copied ✓' : 'Copy invite link'}</button>
      </div>
      <p class="join-url">Everyone opens <b>${esc(base.replace(/^https?:\/\//, ''))}</b>, taps <b>Join a game</b> and types <b>${esc(r.code)}</b>.</p>
    </section>
    <section class="folder" data-tab="Detectives · ${n} of ${r.seats}">
      <ul class="suspects" aria-label="Players">${slots.join('')}</ul>
    </section>
    <section class="paper">
      <h2 class="label">Game settings</h2>
      <ul class="settings-summary">
        <li>${r.settings.mode === 'type' ? '⌨️ Type a Home Item' : '🎲 Random'}</li>
        ${r.settings.mode === 'random' ? `<li>${LEVELS[r.settings.level]}</li>` : ''}
        <li>${r.settings.rounds} rounds</li>
        <li>${r.settings.timer ? `⏱ ${r.settings.timer / 60} min each` : 'No timer'}</li>
      </ul>
      ${isHost() ? group('Players expected', chips('lobbySeats', [2, 3, 4, 5, 6].filter(x => x >= n).map(x => [x, x]), r.seats)) : ''}
    </section>
    ${isHost()
      ? `<div class="cta"><button class="btn btn-red btn-lg" data-act="start" ${n >= 2 ? fxa('ready:' + r.code) : 'disabled'}>${n >= 2 ? `Start the hunt (${n} players)` : 'Waiting for at least 2 players'}</button>
         ${n < 2 ? `<p class="help light center">Share the code above. The button wakes up when someone joins.</p>` : ''}</div>`
      : `<div class="paper center waiting-host"><span class="spinner-glass" aria-hidden="true">🔎</span><p>Waiting for the host to start<span class="dots"></span></p></div>`}
    <button class="link-btn light" data-act="leave">Leave this game</button>
  </div>`;
}

function viewChoose() {
  const r = S.room, chooser = player(r.chooserId), mine = r.chooserId === S.you;
  return `<div class="screen">
    ${topbar()}
    ${mine ? `
      <section class="folder" data-tab="Your turn">
        <div class="paper">
          <h1 class="h1">Choose a home item</h1>
          <div class="field">
            <label class="label" for="ti">Home item</label>
            <input class="input" id="ti" data-model="typeText" maxlength="40" placeholder="e.g. WATER BOTTLE" value="${esc(S.ui.typeText)}" autocomplete="off" aria-describedby="ti-help">
            <p class="help" id="ti-help">Pick something everyone can find at home. You race too!</p>
          </div>
          ${group('Or pick one', `<div class="chips">${['SPOON', 'SOCK', 'BOOK', 'PILLOW', 'TOOTHBRUSH'].map(x => `<button type="button" class="chip" data-act="suggest" data-v="${x}">${x}</button>`).join('')}</div>`)}
          <button class="btn btn-red btn-lg" data-act="typeItem">Send to everyone</button>
          <p class="help">Fair play: nothing hot, sharp or fragile.</p>
        </div>
      </section>`
      : `<section class="paper waiting tilt-r">
          <div class="big-avatar" aria-hidden="true">${chooser ? chooser.avatar : '🕵️'}</div>
          <h1 class="h1">${esc(chooser ? chooser.name : 'Someone')} is choosing<span class="dots"></span></h1>
          <p class="muted">Get ready to search! The item appears here in a moment.</p>
        </section>`}
    ${scoreboard()}
    ${leaveLink()}
  </div>`;
}

function timerBlock() {
  const r = S.room;
  if (!r.settings.timer) return '';
  const total = r.settings.timer * 1000;
  const left = r.endsAt ? r.endsAt - now() : (r.remaining ?? total);
  return `<div class="timer-wrap" role="timer" aria-label="Time left">
    <div id="timer" class="timer ${r.endsAt ? '' : 'paused'} ${left < 15000 ? 'low' : ''}">${mmss(left)}</div>
    <div class="bar" aria-hidden="true"><i id="bar" style="width:${Math.max(0, Math.min(100, left / total * 100))}%"></i></div>
    ${r.endsAt ? '' : `<span class="timer-note">Paused</span>`}
  </div>`;
}

function evidenceLog() {
  const r = S.room;
  if (!r.uploads.length) return '';
  const rows = [...r.uploads].sort((a, b) => a.at - b.at).map((u, i) => {
    const p = player(u.pid);
    return `<tr class="${u.id === r.reviewing ? 'hl' : ''}"${fxa('log:' + u.id)}><td>#${i + 1}</td><td>${clock(u.at)}</td><td>${p ? p.avatar + ' ' + esc(p.name) : '?'}</td><td><span class="badge ${u.status}"${fxa(`st:${u.id}:${u.status}`)}>${STATUS_TEXT[u.status]}</span></td></tr>`;
  }).join('');
  return `<section class="paper evidence">
    <h2 class="label">Evidence record</h2>
    <table class="log"><thead><tr><th scope="col">Order</th><th scope="col">Time</th><th scope="col">Detective</th><th scope="col">Check</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function captureBlock() {
  const r = S.room, u = S.ui;
  const mine = r.uploads.filter(x => x.pid === S.you);
  const pending = mine.find(x => x.status === 'pending');
  if (r.tiebreak && !r.tiebreak.includes(S.you)) {
    return `<section class="paper center"><h2 class="h2">You're the judge ⚖️</h2><p class="muted">Only the tied players hunt in the tiebreaker. You'll check their photos.</p></section>`;
  }
  if (pending) {
    return `<section class="paper center submitted tilt-r"><span class="stamp"${fxa('sub:' + pending.id)}>Evidence sent</span>
      <p>Your photo is waiting to be checked<span class="dots"></span><br><span class="muted">It only counts once the others approve it.</span></p></section>`;
  }
  if (u.capture) {
    return `<section class="stack capture">
      <figure class="polaroid develop${u.busy ? ' sent' : ''}"${fxa('cap:' + u.capId)}><span class="tape"></span><img src="${u.capture}" alt="Your photo"><figcaption>Your photo</figcaption></figure>
      <p class="help light center">Can you clearly see the object? If not, take it again.</p>
      ${u.uploadError ? `<div class="alert" role="alert"><b>Upload failed.</b> ${esc(u.uploadError)} Tap <b>Save</b> to try again.</div>` : ''}
      ${u.busy && u.slow ? `<p class="help light center" role="status">Still uploading… a weak connection can take a little longer.</p>` : ''}
      <div class="btn-row">
        <button class="btn btn-paper" data-act="retake" ${u.busy ? 'disabled' : ''}>🔄 Retake</button>
        <button class="btn btn-red" data-act="upload" ${u.busy ? 'disabled aria-busy="true"' : ''}>${u.busy ? '<i class="spin" aria-hidden="true"></i> Saving…' : '✓ Save'}</button>
      </div>
    </section>`;
  }
  const last = mine[mine.length - 1];
  const note = last && last.status === 'retake' ? `<div class="alert soft verdict"${fxa('v:' + last.id + ':retake')} role="status">🔄 The others asked for a clearer photo. Take it again!</div>`
    : last && last.status === 'rejected' ? `<div class="alert soft verdict no"${fxa('v:' + last.id + ':rejected')} role="status">❌ That photo didn't match. Keep looking!</div>` : '';
  return `<section class="stack capture">
    ${note}
    <button class="camera-seal" data-act="camera" aria-label="Take a photo">${cameraSVG}<span>Take photo</span></button>
    <p class="help light center">Camera won't open? Allow camera access for this site in your browser settings.</p>
    <p class="safety">🚶 Walk carefully. Don't run or climb.</p>
  </section>`;
}

function reviewBlock() {
  const r = S.room, u = r.uploads.find(x => x.id === r.reviewing);
  if (!u) return '';
  const up = player(u.pid);
  const order = [...r.uploads].sort((a, b) => a.at - b.at).indexOf(u);
  const isMine = u.pid === S.you;
  const voters = r.players.filter(p => p.connected && p.id !== u.pid);
  const myVote = u.votes[S.you];
  if (r.solo) return soloCheck(u);
  const c = r.challenge;
  const target = c ? (c.level === 1 ? c.text : c.answer) : '';
  const emojiGroup = (title, list, cls) => `<div class="emoji-group ${cls}"><h3 class="emoji-group-title">${title}</h3><div class="emoji-row">${list.map(([e, l]) =>
    `<button type="button" class="emoji-btn" data-act="vote" data-v="${e}" aria-pressed="${myVote === e}"${myVote === e ? pop(`vote:${u.id}:${e}`) : ''}><span class="emo" aria-hidden="true">${e}</span><span class="emo-label">${l}</span></button>`).join('')}</div></div>`;
  const voted = voters.filter(v => u.votes[v.id]).length;
  const pills = voters.map(v => {
    const e = u.votes[v.id];
    return `<li class="vote-pill${e ? ' done' : ''}"${fxa(`vp:${u.id}:${v.id}:${e ? 1 : 0}`)}><span class="av" aria-hidden="true">${v.avatar}</span>${esc(v.name)}: ${e ? (e === '🤔' ? 'not sure' : 'voted') : 'waiting'}</li>`;
  }).join('');
  const myLabel = myVote ? (ALL_LABELS[myVote] || '') : '';
  return `
    <div class="review-banner">
      <span class="eyebrow">${order === 0 ? 'Uploaded first' : `Upload #${order + 1}`} · ${clock(u.at)} · not checked yet</span>
      <div class="who"${fxa('who:' + u.id)}>${up ? up.avatar + ' ' + esc(up.name) : '?'}</div>
    </div>
    <div class="review-grid">
      <div>
        <figure class="polaroid"${fxa('rev:' + u.id)}><span class="tape"></span>
          ${S.photos[u.id] ? `<img src="${S.photos[u.id]}" alt="Photo uploaded by ${esc(up ? up.name : 'a player')}">` : `<div class="photo-loading">Loading photo…</div>`}
          <figcaption>Evidence #${order + 1}</figcaption>
        </figure>
        ${u.oldPhoto ? `<div class="alert">⚠️ This photo file looks older than this round. Fresh photos only!</div>` : ''}
      </div>
      <section class="paper verify">
        ${isMine
          ? `<h2 class="h2 center">The others are checking your photo<span class="dots"></span></h2><p class="center muted">It only counts once most of them approve it.</p>`
          : `<h2 class="h2">Does this photo show the correct object?</h2>
             ${target ? `<p class="target-line">Looking for: <span class="target">${esc(target)}</span></p>` : ''}
             <div class="emoji-groups">
               ${emojiGroup('Yes, approve', EMOJI.positive, 'pos')}
               ${emojiGroup('No, or retake', EMOJI.action, 'neg')}
               ${emojiGroup('Unsure', EMOJI.unsure, 'unsure')}
             </div>
             <p class="vote-status${myVote ? ' done' : ''}" role="status">${myVote ? `✓ You chose <b>${myVote} ${myLabel}</b>. You can change it until everyone has voted.` : 'Tap one. Most players must approve for it to count.'}</p>`}
        <div class="votes-head"><span class="label">Votes</span><span class="sub">${voted} of ${voters.length}</span></div>
        <ul class="votes-strip">${pills || '<li class="sub">No one else can vote, so it is approved automatically.</li>'}</ul>
        ${isHost() ? `<button class="btn btn-dark btn-sm full" data-act="forceResolve">Close the vote now</button>` : ''}
      </section>
    </div>`;
}

// nobody else can check a solo photo, so the player does it honestly
function soloCheck(u) {
  const c = S.room.challenge;
  const target = c ? (c.level === 1 ? c.text : c.answer) : '';
  return `
    <div class="review-banner"><span class="eyebrow">Self-check · found in ${clock(u.at)}</span></div>
    <figure class="polaroid compact"${fxa('rev:' + u.id)}><span class="tape"></span>
      ${S.photos[u.id] ? `<img src="${S.photos[u.id]}" alt="Your photo">` : `<div class="photo-loading">Loading photo…</div>`}
      <figcaption>Your evidence</figcaption>
    </figure>
    <section class="paper center verify">
      <h2 class="h2">Does it match${target ? `: <span class="target">${esc(target)}</span>` : ''}?</h2>
      <p class="muted">Be honest, detective. Only you can check this one.</p>
      <div class="btn-row">
        <button class="btn btn-paper" data-act="vote" data-v="🔄">🔄 Retake</button>
        <button class="btn btn-red" data-act="vote" data-v="✅">✅ It matches</button>
      </div>
    </section>`;
}

// while a photo is being checked, others can still send theirs — it joins the upload queue
function queueBlock() {
  const r = S.room, u = r.uploads.find(x => x.id === r.reviewing);
  if (!u || u.pid === S.you) return '';
  if (r.tiebreak && !r.tiebreak.includes(S.you)) return '';
  return `<section class="folder" data-tab="Found it too?">
    <p class="help">Send yours anyway. Photos are checked in upload order, so if this one isn't approved, the next one can still win.</p>
    ${captureBlock()}
  </section>`;
}

const leaveLink = () => `<button class="link-btn light quiet" data-act="leave">Leave game</button>`;

function viewHunt() {
  const r = S.room;
  const canSkip = !r.reviewing && !r.uploads.length && r.skipsLeft > 0;
  return `<div class="screen${r.reviewing && !r.solo ? ' wide' : ''}">
    ${topbar()}
    ${timerBlock()}
    ${r.reviewing ? '' : challengeCard()}
    ${r.reviewing ? reviewBlock() + queueBlock() : `
      ${captureBlock()}
      ${canSkip ? `<button class="link-btn light" data-act="skip">Can't find it? Get a different clue (${r.skipsLeft} left)</button>` : ''}`}
    ${evidenceLog()}
    <div class="footer-links">
      ${isHost() && !r.reviewing ? `<button class="link-btn light quiet" data-act="endRound">${r.solo ? 'Give up on this clue' : 'End this round (host)'}</button>` : ''}
      ${r.solo ? '' : leaveLink()}
    </div>
  </div>`;
}

function viewResult() {
  const r = S.room, res = r.lastResult || {};
  const w = res.winnerId ? player(res.winnerId) : null;
  const photo = res.uploadId && S.photos[res.uploadId];
  const finalNext = r.round >= r.totalRounds || r.tiebreak;
  const top = Math.max(...r.players.map(p => p.score));
  const tied = r.players.filter(p => p.score === top).length > 1;
  const won = res.uploadId && r.uploads.find(u => u.id === res.uploadId);
  let nextLabel = 'Next round ▶';
  if (finalNext) nextLabel = tied ? 'Tie! Play the tiebreaker ▶' : 'See final results ▶';
  const c = r.challenge;
  return `<div class="screen">
    ${topbar()}
    <section class="paper result-card tilt-l">
      ${w ? `<span class="stamp big green">Case solved!</span>
             <div class="big-avatar" aria-hidden="true">${w.avatar}</div>
             <h1 class="winner-line">${r.solo ? 'You found it!' : `${w.id === S.you ? 'You win' : esc(w.name) + ' wins'} this round!`}</h1>
             <p class="plus-one">+1 point</p>
             <p class="result-sub">${r.solo ? (won ? `Found in ${clock(won.at)}` : '') : `${w.id === S.you ? 'You now have' : esc(w.name) + ' now has'} ${plural(w.score, 'point')}.`}</p>`
          : `<span class="stamp big">Unsolved</span>
             <h1 class="winner-line">No winner this round</h1>
             <p class="result-sub">${r.solo ? 'This one got away. On to the next clue!' : 'No photo was approved in time, so nobody scores.'}</p>`}
      ${c ? `<p class="case-line">The clue: <b>${esc(c.text)}</b>${c.level !== 1 && c.answer ? ` · Answer: <b>${esc(c.answer)}</b>` : ''}</p>` : ''}
    </section>
    ${photo ? `<figure class="polaroid compact"><span class="tape"></span><img src="${photo}" alt="The winning photo"><figcaption>Winning evidence</figcaption></figure>` : ''}
    ${r.solo ? `<p class="center light solo-progress">Solved <b>${me() ? me().score : 0}</b> of ${r.round} so far · ${r.totalRounds - r.round} to go</p>` : scoreboard()}
    ${isHost() ? `<div class="cta"><button class="btn btn-red btn-lg" data-act="next">${nextLabel}</button></div>`
      : `<p class="center light">Waiting for the host to continue<span class="dots"></span></p>`}
    ${r.solo ? '' : leaveLink()}
  </div>`;
}

function viewFinal() {
  const r = S.room, ranked = rankList(r.players);
  const champ = ranked[0];
  const iWon = champ && champ.id === S.you;
  const pod = [ranked[1], ranked[0], ranked[2]];
  const cls = ['p2', 'p1', 'p3'], place = ['2nd', '1st', '3rd'];
  return `<div class="screen final">
    ${topbar()}
    <section class="paper result-card">
      <span class="eyebrow">Case closed</span>
      ${iWon ? `<span class="stamp big green">Victory!</span>` : `<span class="stamp big">Good hunt!</span>`}
      <div class="big-avatar" aria-hidden="true">${champ ? champ.avatar : ''}</div>
      <h1 class="winner-line">${champ ? (iWon ? 'You win the game!' : esc(champ.name) + ' wins the game!') : ''}</h1>
      <p class="result-sub">${champ ? plural(champ.score, 'point') : ''} · ${plural(r.history.length, 'round')} played</p>
    </section>
    <div class="podium" aria-hidden="true">${pod.map((p, i) => p ? `<div class="step ${cls[i]}"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div class="block">${place[i]}</div></div>` : '<div></div>').join('')}</div>
    ${scoreboard('Final standings')}
    ${historyTable()}
    ${isHost() ? `<div class="cta"><button class="btn btn-red btn-lg" data-act="playAgain">Play again</button></div>` : `<p class="center light">The host can start a new game.</p>`}
    <button class="btn btn-dark" data-act="leave">Leave</button>
  </div>`;
}

function historyTable() {
  return `<section class="paper">
      <h2 class="label">Case history</h2>
      <table class="log"><thead><tr><th scope="col">#</th><th scope="col">Clue</th><th scope="col">Solved by</th></tr></thead><tbody>
      ${S.room.history.map(h => { const p = h.winnerId && player(h.winnerId); return `<tr><td>${h.tiebreak ? 'TB' : h.round}</td><td>${esc(h.challenge)}</td><td>${p ? p.avatar + ' ' + esc(p.name) + ` <span class="sub">${clock(h.time)}</span>` : '<span class="sub">Unsolved</span>'}</td></tr>`; }).join('')}
      </tbody></table>
    </section>`;
}

function viewSoloFinal() {
  const r = S.room, st = S.solo || { solved: 0, time: 0 }, p = me();
  const all = st.solved === r.totalRounds;
  const headline = st.isNew ? 'New personal best!' : all ? 'Every clue solved!' : st.solved ? `${st.solved} of ${r.totalRounds} solved` : 'No clues solved this time';
  return `<div class="screen">
    ${topbar()}
    <section class="paper result-card">
      <span class="eyebrow">Case closed</span>
      ${st.solved ? `<span class="stamp big green">${all ? 'Perfect!' : 'Good hunt!'}</span>` : `<span class="stamp big">Unsolved</span>`}
      <div class="big-avatar" aria-hidden="true">${p ? p.avatar : '🕵️'}</div>
      <h1 class="winner-line">${headline}</h1>
      <dl class="solo-stats">
        <div><dt>Solved</dt><dd>${st.solved}/${r.totalRounds}</dd></div>
        <div><dt>Total time</dt><dd>${st.solved ? clock(st.time) : '-'}</dd></div>
        <div><dt>Per clue</dt><dd>${st.solved ? clock(st.time / st.solved) : '-'}</dd></div>
      </dl>
      ${st.prev && !st.isNew ? `<p class="best-line">Your best: ${st.prev.solved}/${r.totalRounds} in ${clock(st.prev.time)}</p>` : ''}
    </section>
    ${historyTable()}
    <div class="cta"><button class="btn btn-red btn-lg" data-act="playAgain">Play again</button></div>
    <button class="btn btn-dark" data-act="leave">Leave</button>
  </div>`;
}

function rulesModal() {
  const key = list => list.map(([e, l]) => `<li><span aria-hidden="true">${e}</span> ${l}</li>`).join('');
  return `<div class="modal paper rules" role="dialog" aria-modal="true" aria-labelledby="rules-title">
    <button class="close" data-act="closeModal" aria-label="Close" data-autofocus>✕</button>
    <h2 class="h1" id="rules-title">How to play</h2>
    <p class="lead">Find it. Snap it. Upload first. Win the round.</p>
    <ol class="steps">
      <li><span class="ico" aria-hidden="true">👥</span>Choose players and a game mode.</li>
      <li><span class="ico" aria-hidden="true">🔎</span>Look at the clue.</li>
      <li><span class="ico" aria-hidden="true">🏠</span>Find the object at home.</li>
      <li><span class="ico" aria-hidden="true">📷</span>Take a photo.</li>
      <li><span class="ico" aria-hidden="true">📤</span>Save and upload it.</li>
      <li><span class="ico" aria-hidden="true">✅</span>The other players check your photo.</li>
      <li><span class="ico" aria-hidden="true">⭐</span>An approved photo wins 1 point.</li>
      <li><span class="ico" aria-hidden="true">🏆</span>Check the scoreboard and play the next round.</li>
    </ol>
    <h3>Game modes</h3>
    <dl class="defs">
      <dt>🎲 Random</dt><dd>The computer picks the clue. Everyone gets the same one.</dd>
      <dt>⌨️ Type a Home Item</dt><dd>Players take turns typing an item. Everyone races to find it, even the person who typed it.</dd>
    </dl>
    <h3>Levels</h3>
    <dl class="defs">
      <dt>1. Word Hunt</dt><dd>Find a spoon.</dd>
      <dt>2. Riddle Hunt</dt><dd>“I have pages and you read me.”</dd>
      <dt>3. Learn &amp; Find</dt><dd>Find something used to tell time.</dd>
    </dl>
    <h3>Checking photos</h3>
    <div class="emoji-key">
      <div><h4>Approve</h4><ul>${key(EMOJI.positive)}</ul></div>
      <div><h4>Reject or retake</h4><ul>${key(EMOJI.action)}${key(EMOJI.unsure)}</ul></div>
    </div>
    <p class="note">Most of the other players must approve. You can't vote on your own photo. 🤔 doesn't count either way.</p>
    <h3>Scoring</h3>
    <p class="note">The first approved photo wins <b>1 point</b>. Uploading first is not enough: it has to pass the check. A tie at the end means one tiebreaker round.</p>
    <h3>Playing alone?</h3>
    <p class="note">Pick <b>Solo</b>. Check your own photos honestly and beat your best time.</p>
    <p class="safe" role="note">⚠️ Walk carefully. Do not run, climb, or touch dangerous objects.</p>
  </div>`;
}

function scoresModal() {
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Scoreboard"><button class="close" data-act="closeModal" aria-label="Close" data-autofocus>✕</button>${scoreboard()}</div>`;
}

function confirmModal() {
  const c = S.confirm;
  return `<div class="modal paper confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-text">
    <h2 class="h2" id="cf-title">${esc(c.title)}</h2>
    <p id="cf-text">${esc(c.text)}</p>
    <div class="btn-row">
      <button class="btn btn-paper" data-act="confirmNo" data-autofocus>Cancel</button>
      <button class="btn btn-red" data-act="confirmYes">${esc(c.yes)}</button>
    </div>
  </div>`;
}

// ---------- render ----------
function render() {
  const active = document.activeElement;
  const focusId = active && active.id;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  let html;
  const r = S.room;
  if (r) {
    html = { lobby: viewLobby, choose: viewChoose, hunt: viewHunt, result: viewResult, final: r.solo ? viewSoloFinal : viewFinal }[r.phase]();
  } else {
    html = S.ui.screen === 'home' ? viewHome() : viewIntro();
  }
  // a new screen gets one entrance; re-renders inside the window resume it via --since
  const key = r ? `${r.code}:${r.phase}:${r.round}:${r.phase === 'hunt' && r.challenge ? r.challenge.text : ''}`
    : (S.ui.screen === 'home' ? 'home:' + S.ui.tab : 'intro');
  if (key !== S.view.key) {
    S.view = { key, at: Date.now(), base: S.enterBase };
    S.enterBase = 0;
    if (key === 'intro') later(620, Sound.stamp);
    else if (key.startsWith('home')) Sound.paper();
  }
  Music.mood(r && r.phase === 'hunt' && !r.reviewing ? 'hunt' : 'calm');
  const since = Date.now() - S.view.at;
  const app = $('#app');
  app.classList.toggle('enter', since < 4500);
  app.style.setProperty('--since', since + 'ms');
  app.style.setProperty('--base', S.view.base + 'ms');

  if (!S.online) html = `<div class="conn">Connecting to the game server…</div>` + html;
  app.innerHTML = html;

  const mSince = Date.now() - S.modalAt;
  const dialog = S.confirm ? confirmModal() : S.modal === 'rules' ? rulesModal() : S.modal === 'scores' && r ? scoresModal() : '';
  $('#modal-root').innerHTML = dialog ? `<div class="modal-back" data-act="backdrop" style="--since:${mSince}ms">${dialog}</div>` : '';
  document.body.classList.toggle('has-modal', !!dialog);
  if (dialog && mSince < 300) { const f = $('#modal-root [data-autofocus]'); if (f) f.focus({ preventScroll: true }); }

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}

// timer ticker (no full re-render)
setInterval(() => {
  const r = S.room;
  if (!r || r.phase !== 'hunt' || !r.endsAt) return;
  const left = r.endsAt - now(), total = r.settings.timer * 1000;
  const t = $('#timer'), b = $('#bar');
  if (t) { t.textContent = mmss(left); t.classList.toggle('low', left < 15000); }
  const sec = Math.ceil(left / 1000);
  if (sec >= 1 && sec <= 10 && sec !== S.lastTick) { S.lastTick = sec; Sound.tick(sec <= 5); }
  if (b) b.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
}, 250);

// ---------- events ----------
function savePrefs() { store.set('fiah.prefs', { name: S.ui.name, avatar: S.ui.avatar, settings: S.ui.settings }); }

document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.model;
  if (!k) return;
  let v = e.target.value;
  if (k === 'code') { v = v.toUpperCase().replace(/[^A-Z]/g, ''); e.target.value = v; }
  S.ui[k] = v;
  if (k === 'name') { savePrefs(); if (S.ui.nameError && v.trim()) { S.ui.nameError = ''; refreshError('nm'); } }
  if (k === 'code' && S.ui.codeError) { S.ui.codeError = ''; refreshError('cd'); }
});

// drop an inline error without a full re-render (keeps the keyboard open on phones)
function refreshError(id) {
  const input = document.getElementById(id), err = document.getElementById(id + '-err');
  if (input) input.removeAttribute('aria-invalid');
  if (err) err.remove();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (S.modal || S.confirm)) closeModal();
  if (e.key === 'Enter' && e.target.id === 'cd') act('join');
  if (e.key === 'Enter' && e.target.id === 'ti') act('typeItem');
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'backdrop' && e.target !== el) return;
  if (!el.disabled && !QUIET.has(el.dataset.act)) Sound.tap();
  act(el.dataset.act, el.dataset);
});

// actions that make their own sound
const QUIET = new Set(['vote', 'camera', 'retake', 'upload', 'sound', 'copy', 'avatar', 'set', 'suggest', 'rules', 'scores']);

function openModal(kind) { S.modal = kind; S.modalAt = Date.now(); Sound.paper(); }
function closeModal() {
  const back = $('.modal-back');
  const done = () => { S.modal = null; S.confirm = null; render(); };
  if (!back || FX.reduced()) return done();
  back.classList.add('closing');
  setTimeout(done, 180);
}
// destructive actions ask first
function ask(title, text, yes, action, v = '') {
  S.confirm = { title, text, yes, action, v };
  S.modalAt = Date.now();
  Sound.paper();
  render();
}

function needName() {
  if (S.ui.name.trim()) return false;
  S.ui.nameError = 'Please type your name so the other players know who you are.';
  Sound.error();
  render();
  const n = $('#nm');
  if (n) { n.focus(); n.scrollIntoView({ block: 'center', behavior: FX.reduced() ? 'auto' : 'smooth' }); }
  return true;
}

function act(a, d = {}) {
  const u = S.ui;
  switch (a) {
    case 'play': u.screen = 'home'; u.tab = d.v; u.nameError = ''; u.codeError = ''; break;
    case 'back': u.screen = 'intro'; break;
    case 'rules': openModal('rules'); break;
    case 'scores': openModal('scores'); break;
    case 'closeModal': case 'backdrop': closeModal(); return;
    case 'sound': {
      const st = Sound.cycle();
      if (st !== 'off') Sound.select();
      toast(SOUND_STATES[st].label);
      break;
    }
    case 'tab': u.tab = d.v; break;
    case 'avatar': u.avatar = d.v; mark('av:' + d.v); Sound.select(); savePrefs(); break;
    case 'set':
      mark(`chip:${d.k}:${d.v}`); Sound.select();
      if (d.k === 'lobbySeats') { send({ t: 'settings', settings: { seats: Number(d.v) } }); return; }
      u.settings[d.k] = ['seats', 'rounds', 'timer'].includes(d.k) ? Number(d.v) : d.v;
      savePrefs(); break;
    case 'create':
      if (needName()) return;
      if (send({ t: 'create', name: u.name.trim(), avatar: u.avatar, settings: u.settings.seats === 1 ? { ...u.settings, mode: 'random' } : u.settings })) u.busy = true;
      setTimeout(() => { if (u.busy && !S.room) { u.busy = false; render(); } }, 6000);
      break;
    case 'join':
      if (needName()) return;
      if (u.code.length !== 4) {
        u.codeError = 'The game code has 4 letters. Ask the host to read it out.';
        Sound.error(); render();
        const c = $('#cd'); if (c) c.focus();
        return;
      }
      if (send({ t: 'join', code: u.code, name: u.name.trim(), avatar: u.avatar })) u.busy = true;
      setTimeout(() => { if (u.busy && !S.room) { u.busy = false; render(); } }, 6000);
      break;
    case 'copy':
      try { navigator.clipboard.writeText(d.v).then(() => toast('Invite link copied!'), () => toast(d.v)); } catch { toast(d.v); }
      mark('copy'); Sound.select(); setTimeout(render, 1650);
      break;
    case 'start': send({ t: 'start' }); return;
    case 'leave': {
      const r = S.room;
      if (!d.confirmed && r && r.phase !== 'final') {
        return ask('Leave this game?', r.phase === 'lobby' ? 'You can join again with the code while the game is still in the lobby.' : 'The game carries on without you, and you cannot rejoin it.', 'Leave game', 'leave');
      }
      send({ t: 'leave' }); return;
    }
    case 'confirmNo': closeModal(); return;
    case 'confirmYes': {
      const c = S.confirm;
      S.confirm = null; S.modal = null;
      render();
      if (c) act(c.action, { v: c.v, confirmed: '1' });
      return;
    }
    case 'suggest': u.typeText = d.v; Sound.select(); break;
    case 'typeItem':
      if (!u.typeText.trim()) { toast('Type a home item first.', true); return; }
      send({ t: 'typeItem', text: u.typeText.trim() });
      return;
    case 'camera': cam.click(); return;
    case 'retake': u.capture = null; u.uploadError = ''; render(); cam.click(); return;
    case 'upload': {
      if (!u.capture || u.busy) return;
      if (!send({ t: 'upload', photo: u.capture, takenAt: u.takenAt })) return;
      u.busy = true; u.slow = false; u.uploadError = '';
      const sent = u.capture;
      setTimeout(() => { if (u.busy && u.capture === sent) { u.slow = true; render(); } }, 12000);
      // anticipation dip, then the polaroid is sent off the table
      const pola = $('.polaroid.develop');
      if (pola) pola.classList.add('sending');
      Sound.whoosh();
      const btn = $('[data-act="upload"]');
      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.innerHTML = '<i class="spin" aria-hidden="true"></i> Saving…'; }
      const rb = $('[data-act="retake"]'); if (rb) rb.disabled = true;
      return;
    }
    case 'skip': send({ t: 'skip' }); return;
    case 'vote': {
      const r = S.room;
      mark(`vote:${r.reviewing}:${d.v}`); Sound.vote();
      announce(`Your vote: ${ALL_LABELS[d.v] || d.v}`);
      send({ t: 'vote', uploadId: r.reviewing, emoji: d.v }); buzz(30);
      return;
    }
    case 'forceResolve':
      if (!d.confirmed) return ask('Close the vote now?', 'The photo is decided using the votes already in.', 'Close the vote', 'forceResolve');
      send({ t: 'forceResolve' }); return;
    case 'endRound':
      if (!d.confirmed) return S.room && S.room.solo
        ? ask('Give up on this clue?', 'It will count as unsolved and the next clue starts.', 'Give up', 'endRound')
        : ask('End this round?', 'Nobody scores this round, for everyone in the game.', 'End round', 'endRound');
      send({ t: 'endRoundNow' }); return;
    case 'next': send({ t: 'next' }); return;
    case 'playAgain': send({ t: 'playAgain' }); return;
  }
  render();
}

render();
connect();
})();
