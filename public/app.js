/* =========================================================
   FIND IT AT HOME! — client
   Find it. Click it. Upload it. Win it!
   ========================================================= */
(() => {
'use strict';

// ---------- constants ----------
const AVATARS = ['🦊', '🐼', '🦉', '🐯', '🐸', '🐙', '🦁', '🐨', '🐧', '🦝', '🐶', '🐱'];
const EMOJI = {
  positive: [['✅', 'Correct'], ['👍', 'Matches'], ['💯', 'Perfect'], ['🎯', 'Exact'], ['👏', 'Approved']],
  action:   [['❌', 'Wrong'], ['🔄', 'Retake'], ['🔍', 'Blurry'], ['👎', 'No match']],
  unsure:   [['🤔', 'Not sure']],
};
const LEVELS = { '1': 'Word Hunt', '2': 'Riddle Hunt', '3': 'Learn & Find', mixed: 'Mixed (1→2→3)' };
const STATUS_TEXT = { pending: 'Checking', approved: 'Approved', rejected: 'Rejected', retake: 'Retake' };

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
  modal: null, lastPhase: null,
  ui: {
    screen: 'intro', tab: 'host',
    name: prefs.name || '', avatar: prefs.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    code: '', typeText: '',
    settings: Object.assign({ seats: 4, mode: 'random', level: 'mixed', rounds: 5, timer: 120 }, prefs.settings || {}),
    capture: null, takenAt: null, busy: false,
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
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// little sound effects (WebAudio, no files)
let actx;
function beep(notes) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02); t += d * .85;
    }
  } catch {}
}
const SFX = {
  start: () => beep([[392, .12], [523, .12], [659, .2]]),
  upload: () => beep([[880, .08], [660, .08], [880, .14]]),
  win: () => beep([[523, .12], [659, .12], [784, .12], [1047, .3]]),
  no: () => beep([[300, .18], [220, .25]]),
};
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
      S.room = m.room; S.you = m.you;
      S.offset = m.room.serverNow - Date.now();
      if (SS) store.set('fiah.session', { code: m.room.code, pid: m.you }, SS);
      phaseChange(prev, m.room);
      render();
      break;
    }
    case 'photo': S.photos[m.id] = m.data; render(); break;
    case 'uploaded': S.ui.capture = null; S.ui.busy = false; SFX.upload(); render(); break;
    case 'firstUpload': {
      const p = player(m.pid);
      const first = S.room && S.room.uploads.filter(u => u.status !== 'pending').length === 0;
      flash(`${first ? 'First upload' : 'Next upload'}: ${p ? p.name : '?'}`);
      SFX.upload(); buzz([80, 40, 80]);
      break;
    }
    case 'toast': toast(m.text); break;
    case 'error': toast(m.text, true); S.ui.busy = false; render(); break;
    case 'resumeFailed': if (SS) store.del('fiah.session', SS); S.room = null; render(); break;
    case 'left': if (SS) store.del('fiah.session', SS); S.room = null; S.photos = {}; S.ui.screen = 'home'; render(); break;
  }
}

function phaseChange(prev, cur) {
  const key = `${cur.phase}:${cur.round}`;
  if (key === S.lastPhase) return;
  S.lastPhase = key;
  if (cur.phase === 'hunt' || cur.phase === 'choose') { S.ui.capture = null; S.ui.busy = false; S.ui.typeText = ''; }
  if (cur.phase === 'hunt' && (!prev || prev.phase !== 'hunt')) { SFX.start(); buzz(120); }
  if (cur.phase === 'result') {
    if (cur.lastResult && cur.lastResult.winnerId) SFX.win(); else SFX.no();
    if (cur.lastResult && cur.lastResult.winnerId === S.you) buzz([100, 50, 100, 50, 200]);
  }
  if (cur.phase === 'lobby') { S.photos = {}; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function flash(text) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.innerHTML = `<div class="stamp stamp-in">${esc(text)}</div>`;
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

function topbar(extra = '') {
  const r = S.room;
  let chip = '';
  if (r && r.round) chip = r.tiebreak ? `<span class="round-chip">Tiebreaker</span>` : `<span class="round-chip">Case ${r.round}/${r.totalRounds}</span>`;
  return `<header class="topbar">
    <div class="brand">🔎 Find It at Home!</div>
    ${chip}${extra}
    ${r && r.phase !== 'lobby' ? `<button class="icon-btn" data-act="scores" aria-label="Open scoreboard" title="Scoreboard">🏆</button>` : ''}
    <button class="icon-btn" data-act="rules" aria-label="How to play" title="How to play">?</button>
  </header>`;
}

function chips(name, options, value) {
  return `<div class="chips" role="group">${options.map(([v, label]) =>
    `<button class="chip" data-act="set" data-k="${name}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${label}</button>`).join('')}</div>`;
}

function rankList(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0, last = null;
  return sorted.map((p, i) => { if (p.score !== last) { rank = i + 1; last = p.score; } return { ...p, rank }; });
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function scoreboard() {
  const r = S.room;
  const ranked = rankList(r.players);
  const order = [...r.uploads].sort((a, b) => a.at - b.at);
  const rows = ranked.map(p => {
    const ups = order.filter(u => u.pid === p.id);
    const last = ups[ups.length - 1];
    const pos = last ? order.indexOf(last) + 1 : null;
    return `<tr class="${p.id === S.you ? 'me' : ''}">
      <td class="rank">${ordinal(p.rank)}</td>
      <td><div class="pl"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}</span>${p.connected ? '' : ' <small class="muted">(away)</small>'}</div></td>
      <td class="pts">${p.score}</td>
      <td class="tally" aria-label="${p.won} rounds won">${p.won ? '|'.repeat(p.won) : '–'}</td>
      <td>${last ? `<small>#${pos} · ${clock(last.at)}</small><br><span class="badge ${last.status}">${STATUS_TEXT[last.status]}</span>` : '<small class="muted">-</small>'}</td>
    </tr>`;
  }).join('');
  return `<section class="grid-paper" aria-label="Scoreboard">
    <div class="score-head"><h2 class="stencil">Case Board</h2><small class="poster">${r.tiebreak ? 'Tiebreaker' : `Round ${r.round || 0} of ${r.totalRounds}`}</small></div>
    <table class="score-table">
      <thead><tr><th>Rank</th><th>Detective</th><th>Pts</th><th>Won</th><th>This round</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function challengeCard(withStamp = '') {
  const r = S.room, c = r.challenge;
  if (!c) return '';
  const isWord = c.level === 1;
  const typed = c.typedBy ? player(c.typedBy) : null;
  return `<section class="paper casefile tilt-l">
    ${withStamp}
    <div class="level-line"><span class="stencil" style="font-size:24px">${c.typedBy ? 'HOME ITEM' : 'LEVEL ' + c.level}</span><span class="level-name">${esc(c.levelName)}</span></div>
    <hr class="rule">
    <div class="challenge-text">
      <span class="icon" aria-hidden="true">${c.icon}</span>
      ${isWord ? `<div class="label">Find a…</div><div class="word">${esc(c.text)}</div>` : `<div class="riddle">“${esc(c.text)}”</div>`}
      ${c.answer && !isWord ? `<div class="answer">Answer: <b>${esc(c.answer)}</b></div>` : ''}
    </div>
    ${typed ? `<div class="by-line">Chosen by ${typed.avatar} ${esc(typed.name)}</div>` : ''}
  </section>`;
}

// ---------- screens ----------
function viewIntro() {
  return `<div class="screen intro">
    <section class="paper tilt-l intro-hero">
      <span class="file-no">CASE FILE #001</span>
      <span class="stamp conf">Top secret</span>
      ${magnifierSVG}
      <h1 class="game-title">Find it <span>at home!</span></h1>
      <p class="tagline">Find it. Click it. Upload it. <b>Win it!</b></p>
      <div class="intro-meta">
        <div><b>2–6</b>Players</div>
        <div><b>2 modes</b>Random / Type an item</div>
        <div><b>1 point</b>First approved photo</div>
      </div>
    </section>
    <button class="btn btn-red" data-act="play" data-v="host">▶ Play Game</button>
    <button class="btn btn-dark" data-act="play" data-v="join">Join a case</button>
    <button class="btn btn-paper" data-act="rules">How to play</button>
  </div>`;
}

function viewHome() {
  const u = S.ui, s = u.settings, host = u.tab === 'host';
  const common = `
    <div class="field"><label class="label" for="nm">Detective name</label>
      <input class="input" id="nm" data-model="name" maxlength="16" autocomplete="nickname" placeholder="Enter your name" value="${esc(u.name)}"></div>
    <div class="field"><div class="label">Pick your avatar</div>
      <div class="avatars">${AVATARS.map(a => `<button class="avatar-opt" data-act="avatar" data-v="${a}" aria-pressed="${a === u.avatar}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div></div>`;
  const hostForm = `
    <div class="field"><div class="label">1 · How many players?</div>${chips('seats', [2, 3, 4, 5, 6].map(n => [n, n]), s.seats)}</div>
    <div class="field"><div class="label">2 · Game mode</div>
      <div class="modes">
        <button class="mode-card" data-act="set" data-k="mode" data-v="random" aria-pressed="${s.mode === 'random'}"><b>🎲 Random</b><small>The computer picks the clue. Everyone gets the same challenge.</small><div class="ex">e.g. SPOON</div></button>
        <button class="mode-card" data-act="set" data-k="mode" data-v="type" aria-pressed="${s.mode === 'type'}"><b>⌨️ Type a Home Item</b><small>Players take turns typing an item. Everyone races, even the typer!</small><div class="ex">e.g. WATER BOTTLE</div></button>
      </div></div>
    ${s.mode === 'random' ? `<div class="field"><div class="label">3 · Level</div>${chips('level', Object.entries(LEVELS), s.level)}</div>` : ''}
    <div class="field"><div class="label">Rounds</div>${chips('rounds', [[3, 3], [5, 5], [7, 7], [10, 10]], s.rounds)}</div>
    <div class="field"><div class="label">Timer per round</div>${chips('timer', [[0, 'Off'], [60, '1 min'], [90, '1½'], [120, '2 min'], [180, '3 min']], s.timer)}</div>
    <button class="btn btn-red" data-act="create" ${S.online && !u.busy ? '' : 'disabled'}>Open case file</button>`;
  const joinForm = `
    <div class="field"><label class="label" for="cd">Case code (from the host's screen)</label>
      <input class="input code" id="cd" data-model="code" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" value="${esc(u.code)}"></div>
    <button class="btn btn-red" data-act="join" ${S.online && !u.busy ? '' : 'disabled'}>Join the case</button>`;
  return `<div class="screen">
    <header class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">←</button><div class="brand">🔎 Find It at Home!</div><button class="icon-btn" data-act="rules" aria-label="How to play">?</button></header>
    <div>
      <div class="tabs"><button aria-selected="true" tabindex="-1">${host ? 'Open a new case' : 'Join a case'}</button></div>
      <section class="folder tab-body"><div class="paper">${common}${host ? hostForm : joinForm}</div></section>
    </div>
  </div>`;
}

function viewLobby() {
  const r = S.room, base = shareBase(), url = `${base}/join/${r.code}`;
  const slots = [];
  for (let i = 0; i < Math.max(r.seats, r.players.length); i++) {
    const p = r.players[i];
    slots.push(p
      ? `<div class="suspect ${p.connected ? '' : 'offline'}"><span class="pin"></span><div class="mug">${p.avatar}</div><div class="name">${esc(p.name)}</div><div class="role">${p.id === r.hostId ? 'HOST' : p.id === S.you ? 'YOU' : 'DETECTIVE'}</div></div>`
      : `<div class="suspect empty"><div class="mug">?</div><div class="name">Missing</div><div class="role">waiting…</div></div>`);
  }
  const n = r.players.length;
  return `<div class="screen">
    ${topbar()}
    <div class="lobby-head">
      <span class="tag">CASE ${esc(r.code)}</span>
      <button class="btn btn-dark btn-sm" data-act="copy" data-v="${esc(url)}">Copy invite link</button>
    </div>
    <p class="join-url">Everyone opens <b>${esc(base.replace(/^https?:\/\//, ''))}</b> → <b>Join a case</b> → code <b>${esc(r.code)}</b><br>or goes to ${esc(url)}</p>
    <section class="folder" data-tab="Detectives · ${n}/${r.seats}">
      <div class="suspects">${slots.join('')}</div>
    </section>
    <section class="paper">
      <div class="label">Case settings</div>
      <div class="settings-summary">
        <span>${r.settings.mode === 'type' ? '⌨️ Type a Home Item' : '🎲 Random'}</span>
        ${r.settings.mode === 'random' ? `<span>${LEVELS[r.settings.level]}</span>` : ''}
        <span>${r.settings.rounds} rounds</span>
        <span>${r.settings.timer ? `⏱ ${r.settings.timer}s` : 'No timer'}</span>
      </div>
      ${isHost() ? `<div class="field" style="margin-top:14px"><div class="label">Players expected</div>${chips('lobbySeats', [2, 3, 4, 5, 6].filter(x => x >= n).map(x => [x, x]), r.seats)}</div>` : ''}
    </section>
    ${isHost()
      ? `<button class="btn btn-red" data-act="start" ${n >= 2 ? '' : 'disabled'}>${n >= 2 ? `Start the hunt (${n}/${r.seats})` : 'Need at least 2 players'}</button>`
      : `<div class="paper center"><span class="spinner-glass" aria-hidden="true">🔎</span><p>Waiting for the host to start<span class="dots"></span></p></div>`}
    <button class="link-btn light" data-act="leave">Leave this case</button>
  </div>`;
}

function viewChoose() {
  const r = S.room, chooser = player(r.chooserId), mine = r.chooserId === S.you;
  return `<div class="screen">
    ${topbar()}
    ${mine ? `
      <section class="folder" data-tab="Your turn">
        <div class="paper">
          <h2 class="section">Choose a home item</h2>
          <p class="muted" style="margin-top:0">Type something everyone can find at home. You race too!</p>
          <div class="field"><label class="sr-only" for="ti">Home item</label>
            <input class="input" id="ti" data-model="typeText" maxlength="40" placeholder="e.g. WATER BOTTLE" value="${esc(S.ui.typeText)}" autocomplete="off"></div>
          <div class="chips" style="margin-bottom:16px">${['SPOON', 'SOCK', 'BOOK', 'PILLOW', 'TOOTHBRUSH'].map(x => `<button class="chip" data-act="suggest" data-v="${x}">${x}</button>`).join('')}</div>
          <button class="btn btn-red" data-act="typeItem">Send to everyone</button>
          <p class="muted" style="font-size:12px">Fair play: pick something safe. Nothing hot, sharp or fragile.</p>
        </div>
      </section>`
      : `<section class="paper waiting tilt-r">
          <div class="big-avatar">${chooser ? chooser.avatar : '🕵️'}</div>
          <h2 class="section" style="margin-top:10px">${esc(chooser ? chooser.name : 'Someone')} is choosing<span class="dots"></span></h2>
          <p class="muted">Get ready to search! Wait until the challenge appears.</p>
        </section>`}
    ${scoreboard()}
  </div>`;
}

function timerBlock() {
  const r = S.room;
  if (!r.settings.timer) return '';
  const total = r.settings.timer * 1000;
  const left = r.endsAt ? r.endsAt - now() : (r.remaining ?? total);
  return `<div class="timer-wrap">
    <div id="timer" class="timer ${r.endsAt ? '' : 'paused'} ${left < 15000 ? 'low' : ''}">${mmss(left)}</div>
    <div class="bar" aria-hidden="true"><i id="bar" style="width:${Math.max(0, Math.min(100, left / total * 100))}%"></i></div>
  </div>`;
}

function evidenceLog() {
  const r = S.room;
  if (!r.uploads.length) return '';
  const rows = [...r.uploads].sort((a, b) => a.at - b.at).map((u, i) => {
    const p = player(u.pid);
    return `<tr class="${u.id === r.reviewing ? 'hl' : ''}"><td>#${i + 1}</td><td>${clock(u.at)}</td><td>${p ? p.avatar + ' ' + esc(p.name) : '?'}</td><td><span class="badge ${u.status}">${STATUS_TEXT[u.status]}</span></td></tr>`;
  }).join('');
  return `<section class="paper tilt-r">
    <div class="label">Evidence record</div>
    <table class="log"><thead><tr><th>Order</th><th>Time</th><th>Detective</th><th>Check</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function captureBlock() {
  const r = S.room;
  const mine = r.uploads.filter(u => u.pid === S.you);
  const pending = mine.find(u => u.status === 'pending');
  if (r.tiebreak && !r.tiebreak.includes(S.you)) {
    return `<section class="paper center"><h2 class="section">You're the judge ⚖️</h2><p class="muted">Only the tied players hunt in the tiebreaker. You'll check their photos.</p></section>`;
  }
  if (pending) {
    return `<section class="paper center tilt-r"><span class="stamp">Evidence submitted</span><p>Your photo is in the queue. Hold tight while it gets checked<span class="dots"></span></p></section>`;
  }
  if (S.ui.capture) {
    return `<section class="stack">
      <figure class="polaroid" style="margin:0 auto"><span class="tape"></span><img src="${S.ui.capture}" alt="Your photo preview"><figcaption>Is it clear?</figcaption></figure>
      <div class="btn-row">
        <button class="btn btn-paper" data-act="retake">🔄 Retake</button>
        <button class="btn btn-red" data-act="upload" ${S.ui.busy ? 'disabled' : ''}>${S.ui.busy ? 'Uploading…' : 'Save & Upload'}</button>
      </div>
    </section>`;
  }
  const last = mine[mine.length - 1];
  const note = last && last.status === 'retake' ? `<p class="center light">🔄 The others asked for a clearer photo. Try again!</p>`
    : last && last.status === 'rejected' ? `<p class="center light">❌ That one didn't match. Keep looking!</p>` : '';
  return `<section class="stack">
    ${note}
    <button class="camera-seal" data-act="camera" aria-label="Take a photo">${cameraSVG}TAKE PHOTO</button>
    <p class="safety">🚶 Walk, don't run · no climbing · nothing hot, sharp or fragile · fresh photos only</p>
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
  const group = (title, list) => `<div><div class="emoji-group-title label">${title}</div><div class="emoji-row">${list.map(([e, l]) =>
    `<button class="emoji-btn" data-act="vote" data-v="${e}" aria-pressed="${myVote === e}" aria-label="${l}">${e}<small>${l}</small></button>`).join('')}</div></div>`;
  const pills = voters.map(v => {
    const e = u.votes[v.id];
    return `<span class="vote-pill"><span class="av">${v.avatar}</span>${esc(v.name)} ${e ? (e === '🤔' ? '🤔' : '✔︎') : '…'}</span>`;
  }).join('');
  return `
    <div class="review-banner">
      <div class="label light" style="color:var(--kraft)">${order === 0 ? 'First upload!' : `Upload #${order + 1}`} · ${clock(u.at)}</div>
      <div class="who">${up ? up.avatar + ' ' + esc(up.name) : '?'}</div>
    </div>
    <figure class="polaroid"><span class="tape"></span>
      ${S.photos[u.id] ? `<img src="${S.photos[u.id]}" alt="Photo uploaded by ${esc(up ? up.name : '')}">` : `<div style="aspect-ratio:1;display:grid;place-items:center;background:#222;color:#aaa">Loading photo…</div>`}
      <figcaption>Evidence #${order + 1}</figcaption>
    </figure>
    ${u.oldPhoto ? `<div class="warn">⚠️ This photo file looks older than this round. Fresh photos only!</div>` : ''}
    <section class="paper">
      ${isMine
        ? `<h2 class="section center">The detectives are checking your photo<span class="dots"></span></h2>`
        : `<h2 class="section">Emoji check: does it match?</h2>
           <div class="emoji-groups">
             ${group('Yes', EMOJI.positive)}
             ${group('Needs action', EMOJI.action)}
             ${group('Not sure yet', EMOJI.unsure)}
           </div>
           <p class="muted" style="font-size:12px;margin:0">Be fair and kind. 🔄 / 🔍 asks for a clearer photo. It doesn't mean wrong. 🤔 doesn't count as yes or no.</p>`}
      <hr class="rule">
      <div class="votes-strip">${pills || '<small class="muted">No one else can vote. Auto-approving.</small>'}</div>
      ${isHost() ? `<div style="margin-top:14px"><button class="btn btn-dark btn-sm" data-act="forceResolve" style="width:100%">Close the vote now</button></div>` : ''}
    </section>`;
}

// while a photo is being checked, others can still send theirs — it joins the upload queue
function queueBlock() {
  const r = S.room, u = r.uploads.find(x => x.id === r.reviewing);
  if (!u || u.pid === S.you) return '';
  if (r.tiebreak && !r.tiebreak.includes(S.you)) return '';
  return `<section class="folder" data-tab="Found it too?">
    <p style="margin:0 0 14px;font-size:14px">Your photo joins the queue in upload order. If this one isn't approved, the next earliest correct photo can win.</p>
    ${captureBlock()}
  </section>`;
}

function viewHunt() {
  const r = S.room;
  const canSkip = !r.reviewing && !r.uploads.length && r.skipsLeft > 0;
  return `<div class="screen">
    ${topbar()}
    ${timerBlock()}
    ${challengeCard()}
    ${r.reviewing ? reviewBlock() + queueBlock() : `
      ${captureBlock()}
      ${canSkip ? `<button class="link-btn light" data-act="skip">Can't find it? Ask for a different case (${r.skipsLeft} left)</button>` : ''}`}
    ${evidenceLog()}
    ${isHost() && !r.reviewing ? `<button class="link-btn light" data-act="endRound" style="opacity:.7">Host: end this round with no winner</button>` : ''}
  </div>`;
}

function viewResult() {
  const r = S.room, res = r.lastResult || {};
  const w = res.winnerId ? player(res.winnerId) : null;
  const photo = res.uploadId && S.photos[res.uploadId];
  const finalNext = r.round >= r.totalRounds || r.tiebreak;
  const top = Math.max(...r.players.map(p => p.score));
  const tied = r.players.filter(p => p.score === top).length > 1;
  let nextLabel = 'Next case ▶';
  if (finalNext) nextLabel = tied ? 'Tie! Play the tiebreaker ▶' : 'See final results ▶';
  return `<div class="screen">
    ${topbar()}
    <section class="paper result-card tilt-l">
      ${w ? `<span class="stamp big green stamp-in">Solved!</span>
             <div class="big-avatar">${w.avatar}</div>
             <div class="winner-line">${esc(w.name)} ${w.id === S.you ? '(you!)' : ''}</div>
             <p class="hand" style="font-size:22px;margin:4px 0;color:var(--red)">+1 point</p>`
          : `<span class="stamp big stamp-in">Unsolved</span><p>No approved photo this round. Nobody scores.</p>`}
      ${r.challenge ? `<p class="muted" style="margin-bottom:0">Case: “${esc(r.challenge.text)}”${r.challenge.level !== 1 ? `: <b>${esc(r.challenge.answer)}</b>` : ''}</p>` : ''}
    </section>
    ${photo ? `<figure class="polaroid"><span class="tape"></span><img src="${photo}" alt="Winning photo"><figcaption>Winning evidence</figcaption></figure>` : ''}
    ${scoreboard()}
    ${isHost() ? `<button class="btn btn-red" data-act="next">${nextLabel}</button>`
      : `<p class="center light">Waiting for the host to continue<span class="dots"></span></p>`}
  </div>`;
}

function viewFinal() {
  const r = S.room, ranked = rankList(r.players);
  const champ = ranked[0];
  const iWon = champ && champ.id === S.you;
  const pod = [ranked[1], ranked[0], ranked[2]];
  const cls = ['p2', 'p1', 'p3'], place = [2, 1, 3];
  return `<div class="screen">
    ${topbar()}
    <section class="paper result-card">
      <div class="label">Case closed</div>
      ${iWon ? `<span class="stamp big green stamp-in">Victory!</span>` : `<span class="stamp big stamp-in">Good hunt!</span>`}
      <div class="big-avatar">${champ ? champ.avatar : ''}</div>
      <div class="winner-line">${champ ? esc(champ.name) : ''} wins!</div>
      <p class="muted" style="margin:0">${champ ? champ.score : 0} point${champ && champ.score === 1 ? '' : 's'} · ${r.history.length} cases played</p>
    </section>
    <div class="podium">${pod.map((p, i) => p ? `<div class="step ${cls[i]}"><div class="av">${p.avatar}</div><div class="nm">${esc(p.name)}</div><div class="block">${place[i]}</div></div>` : '<div></div>').join('')}</div>
    ${scoreboard()}
    <section class="paper">
      <div class="label">Case history</div>
      <table class="log"><thead><tr><th>#</th><th>Case</th><th>Solved by</th></tr></thead><tbody>
      ${r.history.map(h => { const p = h.winnerId && player(h.winnerId); return `<tr><td>${h.tiebreak ? 'TB' : h.round}</td><td>${esc(h.challenge)}</td><td>${p ? p.avatar + ' ' + esc(p.name) + ` <small>${clock(h.time)}</small>` : '<small class="muted">Unsolved</small>'}</td></tr>`; }).join('')}
      </tbody></table>
    </section>
    ${isHost() ? `<button class="btn btn-red" data-act="playAgain">Play again</button>` : `<p class="center light">The host can start a new game.</p>`}
    <button class="btn btn-dark" data-act="leave">Leave</button>
  </div>`;
}

function rulesModal() {
  const emo = list => list.map(([e]) => e).join(' ');
  return `<div class="modal paper rules">
    <button class="close" data-act="closeModal" aria-label="Close">✕</button>
    <h2 class="stencil" style="font-size:28px">How to play</h2>
    <p class="lead">Find it. Snap it. Upload first. Win the round.</p>
    <ol class="steps">
      <li>Join with a name & avatar</li>
      <li>Read the clue</li>
      <li>Find it at home</li>
      <li>Photo &amp; upload</li>
    </ol>
    <h3>Levels</h3>
    <ol class="lv-list">
      <li><b>Word Hunt</b><small>Find a spoon</small></li>
      <li><b>Riddle Hunt</b><small>“I have pages and you read me”</small></li>
      <li><b>Learn &amp; Find</b><small>Something used to tell time</small></li>
    </ol>
    <h3>Emoji check</h3>
    <div class="emoji-key">
      <div><span>${emo(EMOJI.positive)}</span><small>Approve</small></div>
      <div><span>${emo(EMOJI.action)}</span><small>Reject / retake</small></div>
      <div><span>${emo(EMOJI.unsure)}</span><small>Not sure</small></div>
    </div>
    <p class="note">Majority of other players decides. You can't vote on your own photo.</p>
    <h3>Scoring</h3>
    <p class="note">First approved photo = <b>1 point</b>. Tie → one tiebreaker round.</p>
    <p class="note safe">⚠️ Walk, don't run. Nothing hot, sharp or high up.</p>
  </div>`;
}

function scoresModal() {
  return `<div class="modal"><button class="close" data-act="closeModal" aria-label="Close">✕</button>${scoreboard()}</div>`;
}

// ---------- render ----------
function render() {
  const active = document.activeElement;
  const focusId = active && active.id;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  let html;
  const r = S.room;
  if (r) {
    html = { lobby: viewLobby, choose: viewChoose, hunt: viewHunt, result: viewResult, final: viewFinal }[r.phase]();
  } else {
    html = S.ui.screen === 'home' ? viewHome() : viewIntro();
  }
  if (!S.online) html = `<div class="conn">Connecting to the game server…</div>` + html;
  $('#app').innerHTML = html;

  $('#modal-root').innerHTML = S.modal
    ? `<div class="modal-back" data-act="backdrop">${S.modal === 'rules' ? rulesModal() : (r ? scoresModal() : '')}</div>` : '';

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
  if (k === 'name') savePrefs();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.modal) { S.modal = null; render(); }
  if (e.key === 'Enter' && e.target.id === 'cd') act('join');
  if (e.key === 'Enter' && e.target.id === 'ti') act('typeItem');
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'backdrop' && e.target !== el) return;
  act(el.dataset.act, el.dataset);
});

function needName() {
  if (!S.ui.name.trim()) { toast('Write your detective name first.', true); const n = $('#nm'); if (n) n.focus(); return true; }
  return false;
}

function act(a, d = {}) {
  const u = S.ui;
  switch (a) {
    case 'play': u.screen = 'home'; u.tab = d.v; break;
    case 'back': u.screen = 'intro'; break;
    case 'rules': S.modal = 'rules'; break;
    case 'scores': S.modal = 'scores'; break;
    case 'closeModal': case 'backdrop': S.modal = null; break;
    case 'tab': u.tab = d.v; break;
    case 'avatar': u.avatar = d.v; savePrefs(); break;
    case 'set':
      if (d.k === 'lobbySeats') { send({ t: 'settings', settings: { seats: Number(d.v) } }); return; }
      u.settings[d.k] = ['seats', 'rounds', 'timer'].includes(d.k) ? Number(d.v) : d.v;
      savePrefs(); break;
    case 'create':
      if (needName()) return;
      if (send({ t: 'create', name: u.name.trim(), avatar: u.avatar, settings: u.settings })) u.busy = true;
      setTimeout(() => { u.busy = false; }, 3000);
      break;
    case 'join':
      if (needName()) return;
      if (u.code.length !== 4) { toast('The case code has 4 letters.', true); return; }
      send({ t: 'join', code: u.code, name: u.name.trim(), avatar: u.avatar });
      break;
    case 'copy':
      try { navigator.clipboard.writeText(d.v).then(() => toast('Invite link copied!'), () => toast(d.v)); } catch { toast(d.v); }
      return;
    case 'start': send({ t: 'start' }); return;
    case 'leave': send({ t: 'leave' }); return;
    case 'suggest': u.typeText = d.v; break;
    case 'typeItem':
      if (!u.typeText.trim()) { toast('Type a home item first.', true); return; }
      send({ t: 'typeItem', text: u.typeText.trim() });
      return;
    case 'camera': cam.click(); return;
    case 'retake': u.capture = null; render(); cam.click(); return;
    case 'upload':
      if (!u.capture || u.busy) return;
      if (send({ t: 'upload', photo: u.capture, takenAt: u.takenAt })) u.busy = true;
      break;
    case 'skip': send({ t: 'skip' }); return;
    case 'vote': {
      const r = S.room;
      send({ t: 'vote', uploadId: r.reviewing, emoji: d.v }); buzz(30);
      return;
    }
    case 'forceResolve': send({ t: 'forceResolve' }); return;
    case 'endRound': send({ t: 'endRoundNow' }); return;
    case 'next': send({ t: 'next' }); return;
    case 'playAgain': send({ t: 'playAgain' }); return;
  }
  render();
}

render();
connect();
})();
