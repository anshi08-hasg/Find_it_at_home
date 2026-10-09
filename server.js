// Find It at Home! — game server
// Serves the web app and runs shared game rooms over WebSockets.
// Run: npm install && npm start   → open the printed URL on every phone (same Wi-Fi).

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const { pick, LEVEL_NAMES } = require('./challenges');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

// ---------- static file server ----------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || /^\/join\/[A-Za-z]{4}\/?$/.test(p)) p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- constants ----------
const POSITIVE = ['✅', '👍', '💯', '🎯', '👏'];
const WRONG = ['❌', '👎'];
const RETAKE = ['🔄', '🔍'];
const UNSURE = ['🤔'];
const ALL_EMOJI = [...POSITIVE, ...WRONG, ...RETAKE, ...UNSURE];
const MAX_SKIPS = 2;

const rooms = new Map();          // code -> room
const sockets = new Map();        // ws -> { code, pid }

const uid = () => Math.random().toString(36).slice(2, 10);
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

// ---------- state helpers ----------
function publicState(room) {
  const reveal = room.phase !== 'hunt' || !!room.reviewing;
  const ch = room.challenge;
  return {
    code: room.code,
    solo: !!room.solo,
    hostId: room.hostId,
    seats: room.seats,
    settings: room.settings,
    phase: room.phase,
    round: room.round,
    totalRounds: room.settings.rounds,
    tiebreak: room.tiebreak,
    chooserId: room.chooserId,
    challenge: ch ? { level: ch.level, levelName: ch.levelName, text: ch.text, icon: ch.icon, typedBy: ch.typedBy, answer: reveal ? ch.answer : null } : null,
    endsAt: room.endsAt, remaining: room.remaining, serverNow: Date.now(),
    skipsLeft: room.skipsLeft,
    reviewing: room.reviewing,
    players: room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, won: p.won, connected: p.connected })),
    uploads: room.uploads.map(u => ({ id: u.id, pid: u.pid, at: u.at, status: u.status, votes: u.votes, oldPhoto: u.oldPhoto })),
    history: room.history,
    lastResult: room.lastResult,
  };
}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function broadcast(room, msg) {
  for (const p of room.players) if (p.ws) send(p.ws, msg);
}

function sync(room) {
  const st = publicState(room);
  for (const p of room.players) if (p.ws) send(p.ws, { t: 'state', you: p.id, room: st });
}

function toast(room, text) { broadcast(room, { t: 'toast', text }); }

const getPlayer = (room, pid) => room.players.find(p => p.id === pid);
const connected = room => room.players.filter(p => p.connected);

// ---------- timer ----------
function clearTimer(room) { if (room.timeout) clearTimeout(room.timeout); room.timeout = null; }

function resumeTimer(room) {
  clearTimer(room);
  if (!room.settings.timer || room.remaining == null) { room.endsAt = null; return; }
  if (room.remaining <= 0) return timeUp(room);
  room.endsAt = Date.now() + room.remaining;
  room.timeout = setTimeout(() => timeUp(room), room.remaining);
}

function pauseTimer(room) {
  if (room.endsAt) room.remaining = Math.max(0, room.endsAt - Date.now());
  clearTimer(room);
  room.endsAt = null;
}

function timeUp(room) {
  clearTimer(room);
  room.endsAt = null;
  room.remaining = 0;
  if (room.phase !== 'hunt' || room.reviewing) return;
  endRound(room, null);
}

// ---------- round flow ----------
function levelForRound(room) {
  const l = room.settings.level;
  if (l === 'mixed') return ((room.round - 1) % 3) + 1;
  return Number(l) || 1;
}

function startRound(room) {
  room.round += 1;
  room.uploads = [];
  room.reviewing = null;
  room.lastResult = null;
  room.challenge = null;
  room.skipsLeft = MAX_SKIPS;
  room.photos = new Map();
  clearTimer(room);
  room.endsAt = null;
  room.remaining = null;

  if (room.settings.mode === 'type') {
    // players take turns choosing the item
    const order = connected(room);
    const pool = order.length ? order : room.players;
    room.chooserId = pool[(room.turn++) % pool.length].id;
    room.phase = 'choose';
  } else {
    room.chooserId = null;
    room.challenge = pick(levelForRound(room), room.used);
    beginHunt(room);
  }
  sync(room);
}

function beginHunt(room) {
  room.phase = 'hunt';
  room.roundStart = Date.now();
  room.remaining = room.settings.timer ? room.settings.timer * 1000 : null;
  resumeTimer(room);
}

function canUpload(room, pid) {
  if (room.tiebreak && !room.tiebreak.includes(pid)) return false;
  return true;
}

function nextReview(room) {
  const pending = room.uploads.filter(u => u.status === 'pending').sort((a, b) => a.at - b.at);
  if (pending.length) {
    if (!room.reviewing) pauseTimer(room);
    room.reviewing = pending[0].id;
    const u = pending[0];
    if (!room.solo) broadcast(room, { t: 'firstUpload', pid: u.pid, uploadId: u.id });
    checkVotes(room); // handles the "nobody can vote" case
  } else {
    room.reviewing = null;
    if (room.phase === 'hunt') resumeTimer(room);
  }
}

// solo players check their own photo (honour system); otherwise everyone but the uploader votes
function eligibleVoters(room, upload) {
  if (room.solo) return room.players.filter(p => p.connected && p.id === upload.pid);
  return room.players.filter(p => p.connected && p.id !== upload.pid);
}

function checkVotes(room, force = false) {
  const u = room.uploads.find(x => x.id === room.reviewing);
  if (!u) return;
  const voters = eligibleVoters(room, u);
  const votes = voters.map(v => u.votes[v.id]).filter(Boolean);
  const decisive = votes.filter(e => !UNSURE.includes(e));
  const allDecided = voters.length === 0 || decisive.length === voters.length;
  if (!allDecided && !force) return;

  const pos = decisive.filter(e => POSITIVE.includes(e)).length;
  const wrong = decisive.filter(e => WRONG.includes(e)).length;
  const retake = decisive.filter(e => RETAKE.includes(e)).length;

  // "Most of the other players must approve it." With no one able to vote, auto-approve.
  if (voters.length === 0 || pos > voters.length / 2) {
    u.status = 'approved';
    return endRound(room, u);
  }
  u.status = (retake > 0 && retake >= wrong) ? 'retake' : 'rejected';
  const who = getPlayer(room, u.pid);
  if (!room.solo) toast(room, u.status === 'retake'
    ? `${who ? who.name : 'Player'} needs a clearer photo. Retake!`
    : `${who ? who.name : 'That'}'s photo does not match. The next photo will be checked, so keep hunting!`);
  room.reviewing = null;
  nextReview(room);
  sync(room);
}

function endRound(room, upload) {
  clearTimer(room);
  room.endsAt = null;
  room.reviewing = null;
  let winnerId = null;
  if (upload) {
    const w = getPlayer(room, upload.pid);
    if (w) { w.score += 1; w.won += 1; winnerId = w.id; }
  }
  room.lastResult = { winnerId, uploadId: upload ? upload.id : null };
  room.history.push({
    round: room.round, tiebreak: !!room.tiebreak,
    challenge: room.challenge ? room.challenge.text : '', answer: room.challenge ? room.challenge.answer : '',
    winnerId, time: upload ? upload.at : null,
  });
  room.phase = 'result';

  // Was that the last round?
  const regularDone = room.round >= room.settings.rounds;
  if (regularDone) {
    const top = Math.max(...room.players.map(p => p.score));
    const leaders = room.players.filter(p => p.score === top);
    room.pendingTiebreak = leaders.length > 1 ? leaders.map(p => p.id) : null;
    room.finished = !room.pendingTiebreak;
  }
  sync(room);
}

function next(room) {
  if (room.phase !== 'result') return;
  if (room.finished) { room.phase = 'final'; return sync(room); }
  if (room.pendingTiebreak) {
    room.tiebreak = room.pendingTiebreak;
    room.pendingTiebreak = null;
    toast(room, 'Tie! One final tiebreaker round.');
  }
  startRound(room);
}

function resetGame(room) {
  clearTimer(room);
  Object.assign(room, {
    phase: 'lobby', round: 0, turn: 0, uploads: [], reviewing: null, challenge: null, chooserId: null,
    tiebreak: null, pendingTiebreak: null, finished: false, history: [], lastResult: null,
    endsAt: null, remaining: null, used: new Set(), photos: new Map(),
  });
  room.players = room.players.filter(p => p.connected);
  room.players.forEach(p => { p.score = 0; p.won = 0; });
}

// ---------- message handlers ----------
function attach(ws, room, player) {
  if (player.ws && player.ws !== ws) { sockets.delete(player.ws); try { player.ws.close(); } catch (_) {} }
  player.ws = ws;
  player.connected = true;
  sockets.set(ws, { code: room.code, pid: player.id });
  // send any photos from the current round so a refreshed phone catches up
  for (const [id, data] of room.photos) send(ws, { t: 'photo', id, data });
}

const handlers = {
  create(ws, m) {
    const s = m.settings || {};
    const solo = Number(s.seats) === 1;
    const room = {
      code: newCode(),
      solo,
      seats: solo ? 1 : Math.min(6, Math.max(2, Number(s.seats) || 4)),
      settings: {
        // typing your own item to find would make solo trivial, so solo is always random
        mode: s.mode === 'type' && !solo ? 'type' : 'random',
        level: ['1', '2', '3', 'mixed'].includes(String(s.level)) ? String(s.level) : 'mixed',
        rounds: Math.min(15, Math.max(1, Number(s.rounds) || 5)),
        timer: [0, 60, 90, 120, 180].includes(Number(s.timer)) ? Number(s.timer) : 120,
      },
      players: [], hostId: null, skipsLeft: MAX_SKIPS,
    };
    resetGame(room);
    const p = { id: uid(), name: clean(m.name, 16) || 'Detective', avatar: clean(m.avatar, 4) || '🦊', score: 0, won: 0, connected: true };
    room.players.push(p);
    room.hostId = p.id;
    rooms.set(room.code, room);
    attach(ws, room, p);
    // nobody to wait for: go straight into the first case
    if (solo) return startRound(room);
    sync(room);
  },

  join(ws, m) {
    const room = rooms.get(String(m.code || '').toUpperCase().trim());
    if (!room) return send(ws, { t: 'error', text: 'No case found with that code.' });
    if (room.phase !== 'lobby') return send(ws, { t: 'error', text: 'That game has already started.' });
    if (room.solo) return send(ws, { t: 'error', text: 'That is a solo case. Ask them to start a group game.' });
    if (room.players.length >= room.seats) return send(ws, { t: 'error', text: 'That game room is full.' });
    const name = clean(m.name, 16) || 'Detective';
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase()))
      return send(ws, { t: 'error', text: 'Someone already uses that name. Pick another.' });
    const p = { id: uid(), name, avatar: clean(m.avatar, 4) || '🦊', score: 0, won: 0, connected: true };
    room.players.push(p);
    attach(ws, room, p);
    toast(room, `${p.avatar} ${p.name} joined the case.`);
    sync(room);
  },

  resume(ws, m) {
    const room = rooms.get(String(m.code || '').toUpperCase());
    const p = room && getPlayer(room, m.pid);
    if (!p) return send(ws, { t: 'resumeFailed' });
    attach(ws, room, p);
    if (!getPlayer(room, room.hostId)?.connected) room.hostId = p.id;
    sync(room);
  },

  settings(ws, m, room, me) {
    if (room.phase !== 'lobby' || me.id !== room.hostId) return;
    const s = m.settings || {};
    if (s.seats) room.seats = Math.min(6, Math.max(room.players.length, 2, Number(s.seats)));
    if (s.mode) room.settings.mode = s.mode === 'type' ? 'type' : 'random';
    if (s.level) room.settings.level = ['1', '2', '3', 'mixed'].includes(String(s.level)) ? String(s.level) : room.settings.level;
    if (s.rounds) room.settings.rounds = Math.min(15, Math.max(1, Number(s.rounds)));
    if (s.timer != null && [0, 60, 90, 120, 180].includes(Number(s.timer))) room.settings.timer = Number(s.timer);
    sync(room);
  },

  start(ws, m, room, me) {
    if (room.phase !== 'lobby' || me.id !== room.hostId) return;
    if (connected(room).length < 2) return send(ws, { t: 'error', text: 'You need at least 2 players.' });
    room.seats = Math.max(room.players.length, 2);
    startRound(room);
  },

  typeItem(ws, m, room, me) {
    if (room.phase !== 'choose' || me.id !== room.chooserId) return;
    const text = clean(m.text, 40).toUpperCase();
    if (text.length < 2) return send(ws, { t: 'error', text: 'Type a home item first.' });
    room.challenge = { level: 1, levelName: 'Type a Home Item', text, icon: '🏠', answer: text, typedBy: me.id };
    beginHunt(room);
    sync(room);
  },

  skip(ws, m, room, me) {
    if (room.phase !== 'hunt' || room.reviewing) return;
    if (room.uploads.length) return send(ws, { t: 'error', text: 'Evidence is already in. You can\'t change this case now.' });
    if (room.skipsLeft <= 0) return send(ws, { t: 'error', text: 'No new cases left this round.' });
    room.skipsLeft -= 1;
    if (room.settings.mode === 'type') {
      room.challenge = null;
      room.phase = 'choose';
      clearTimer(room);
      room.endsAt = null;
    } else {
      room.challenge = pick(levelForRound(room), room.used);
      beginHunt(room);
    }
    if (!room.solo) toast(room, `${me.name} asked for a different case.`);
    sync(room);
  },

  upload(ws, m, room, me) {
    if (room.phase !== 'hunt') return send(ws, { t: 'error', text: 'The round is over.' });
    if (!canUpload(room, me.id)) return send(ws, { t: 'error', text: 'Only tied players hunt in the tiebreaker. You get to judge!' });
    if (room.settings.timer && room.endsAt && Date.now() > room.endsAt) return send(ws, { t: 'error', text: 'Time is up!' });
    if (room.uploads.some(u => u.pid === me.id && u.status === 'pending'))
      return send(ws, { t: 'error', text: 'Your evidence is already waiting to be checked.' });
    const data = String(m.photo || '');
    if (!data.startsWith('data:image/') || data.length > 4.5e6) return send(ws, { t: 'error', text: 'That photo could not be uploaded.' });
    const u = {
      id: uid(), pid: me.id, at: Date.now() - room.roundStart, status: 'pending', votes: {},
      oldPhoto: !!(m.takenAt && Number(m.takenAt) < room.roundStart - 15000),
    };
    room.uploads.push(u);
    room.photos.set(u.id, data);
    broadcast(room, { t: 'photo', id: u.id, data });
    send(ws, { t: 'uploaded' });
    if (!room.reviewing) nextReview(room);
    sync(room);
  },

  vote(ws, m, room, me) {
    const u = room.uploads.find(x => x.id === room.reviewing);
    if (!u || u.id !== m.uploadId || (u.pid === me.id && !room.solo)) return;
    if (!ALL_EMOJI.includes(m.emoji)) return;
    u.votes[me.id] = m.emoji;
    sync(room);
    checkVotes(room);
  },

  forceResolve(ws, m, room, me) {
    if (me.id !== room.hostId || !room.reviewing) return;
    checkVotes(room, true);
  },

  endRoundNow(ws, m, room, me) {
    if (me.id !== room.hostId || room.phase !== 'hunt' || room.reviewing) return;
    endRound(room, null);
  },

  next(ws, m, room, me) { if (me.id === room.hostId) next(room); },

  playAgain(ws, m, room, me) {
    if (me.id !== room.hostId || room.phase !== 'final') return;
    resetGame(room);
    if (room.solo) return startRound(room);
    sync(room);
  },

  leave(ws, m, room, me) {
    room.players = room.players.filter(p => p.id !== me.id);
    sockets.delete(ws);
    send(ws, { t: 'left' });
    afterDisconnect(room, me);
  },
};

function afterDisconnect(room, me) {
  if (!room.players.some(p => p.connected)) {
    clearTimer(room);
    room.emptySince = Date.now();
    return;
  }
  if (room.hostId === me.id || !getPlayer(room, room.hostId)) {
    const h = connected(room)[0];
    if (h) { room.hostId = h.id; toast(room, `${h.name} is now the host.`); }
  }
  if (room.phase === 'choose' && room.chooserId === me.id) {
    const c = connected(room)[0];
    if (c) room.chooserId = c.id;
  }
  if (room.reviewing) checkVotes(room);
  sync(room);
}

// ---------- websocket wiring ----------
const wss = new WebSocketServer({ server, maxPayload: 6 * 1024 * 1024 });

const lanIps = () => Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

wss.on('connection', ws => {
  const ip = lanIps()[0];
  if (ip) send(ws, { t: 'hello', lan: `http://${ip}:${PORT}` });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') return send(ws, { t: 'pong' });
    const h = handlers[m.t];
    if (!h) return;
    if (m.t === 'create' || m.t === 'join' || m.t === 'resume') return h(ws, m);
    const s = sockets.get(ws);
    const room = s && rooms.get(s.code);
    const me = room && getPlayer(room, s.pid);
    if (!me) return send(ws, { t: 'error', text: 'You are not in a game.' });
    try { h(ws, m, room, me); } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    const s = sockets.get(ws);
    sockets.delete(ws);
    const room = s && rooms.get(s.code);
    const me = room && getPlayer(room, s.pid);
    if (!me || me.ws !== ws) return;
    me.connected = false;
    me.ws = null;
    if (room.phase === 'lobby') {
      // give them a few seconds to come back (page refresh) before freeing the seat
      setTimeout(() => {
        if (!me.connected && room.phase === 'lobby') {
          room.players = room.players.filter(p => p !== me);
          afterDisconnect(room, me);
        }
      }, 8000);
    }
    afterDisconnect(room, me);
  });
});

// heartbeat + room cleanup
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  for (const [code, room] of rooms) {
    if (!room.players.some(p => p.connected) && Date.now() - (room.emptySince || 0) > 15 * 60 * 1000) {
      clearTimer(room);
      rooms.delete(code);
    }
  }
}, 20000);

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIps();
  console.log('\n  🔎  FIND IT AT HOME! is running\n');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  On phones (Wi-Fi): http://${ip}:${PORT}`));
  console.log('\n  Levels:', Object.values(LEVEL_NAMES).join(' · '), '\n');
});
