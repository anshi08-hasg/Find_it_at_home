/* =========================================================
   FIND IT AT HOME! — sound & motion kit
   Every sound is synthesised live with WebAudio: no files, works offline.
   Overlays (slate, flash, confetti) live outside #app so re-renders never cut them.
   ========================================================= */
(() => {
'use strict';

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const pref = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- audio engine ----------
let ctx = null, out = null, noise = null;
let muted = pref.get('fiah.muted') === '1';
let musicOn = pref.get('fiah.music') !== '0';

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = muted ? 0 : .8;
    out.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().then(() => Music.sync(), () => {});
  return ctx;
}
// browsers only allow audio after a user gesture; unlock on the first one
const unlock = () => { audio(); Music.sync(); };
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { once: true, passive: true });
// no music while the phone is showing another app
document.addEventListener('visibilitychange', () => Music.sync());

// sounds scheduled before the unlock would all fire at once later, so drop them instead
const live = () => { const a = audio(); return a && a.state === 'running' && !muted ? a : null; };

function env(g, t, peak, attack, dur) {
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
}

function tone({ f, f2, type = 'sine', at = 0, dur = .2, vol = .2, attack = .005, lp }) {
  const a = live(); if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, vol, attack, dur);
  let node = o;
  if (lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node.connect(fl); node = fl; }
  node.connect(g).connect(out);
  o.start(t); o.stop(t + dur + .05);
}

function hiss({ at = 0, dur = .1, vol = .2, type = 'bandpass', f = 1000, f2, q = 1, attack = .003 }) {
  const a = live(); if (!a) return;
  const t = a.currentTime + at;
  const s = a.createBufferSource(); s.buffer = noise;
  const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain(); env(g, t, vol, attack, dur);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}

// a struck bell: fundamental plus two inharmonic partials that die faster
const bell = (f, at = 0, dur = .8, vol = .12) => {
  tone({ f, at, dur, vol });
  tone({ f: f * 2.76, at, dur: dur * .5, vol: vol * .25 });
  tone({ f: f * 5.4, at, dur: dur * .25, vol: vol * .08 });
};
const pluck = (f, at = 0, vol = .15, dur = .25) => tone({ f, at, dur, vol, type: 'triangle', attack: .003 });

// ---------- background music ----------
// "The Chase": an original, upbeat detective groove, generated live. Two intensities:
//   calm (menus, lobby, reactions, results, wellness breaks) 108 bpm: walking bass, light hats, vibes
//   hunt (searching)                                         124 bpm: full kit, chromatic spy bass riff,
//                                                                     muted-guitar stabs, a sly minor lead
// Lively enough to be fun, never frantic: it is a wellness game, so nobody should feel rushed into running.
// The harmony is a 4-bar loop Am | Gm | F | E, an Andalusian-style descent with a chromatic
// approach note into each beat 3, which keeps it tense and "detective".
// Notes are scheduled ~0.3s ahead on the audio clock, so the beat never drifts.
const Music = (() => {
  const LEVEL = .5;
  const BPM = { calm: 108, hunt: 124 };
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  // spy bass riff, one bar per chord, eighth notes (0 = rest)
  const RIFF = [
    [45, 45, 48, 45, 51, 52, 48, 45],   // Am  with a D# -> E push
    [43, 43, 46, 43, 49, 50, 46, 43],   // Gm  with a C# -> D push
    [41, 41, 45, 41, 47, 48, 45, 41],   // F   with a B  -> C push
    [40, 40, 44, 40, 47, 52, 50, 47],   // E   climbing back to the top
  ];
  // relaxed walking bass for calm mood
  const WALK = [
    [45, 0, 52, 0, 45, 48, 0, 52],
    [43, 0, 50, 0, 43, 46, 0, 50],
    [41, 0, 48, 0, 41, 45, 0, 48],
    [40, 0, 47, 0, 40, 44, 0, 47],
  ];
  const CHORDS = [[57, 60, 64], [55, 58, 62], [53, 57, 60], [52, 56, 59]];
  // the lead hook: step (0-31 across the 4 bars) -> [note, length in eighths]
  const HOOK = {
    0: [76, 1], 2: [79, 1], 3: [81, 2], 6: [76, 1],
    8: [74, 1], 10: [70, 1], 11: [74, 2], 14: [67, 1],
    16: [72, 1], 18: [69, 1], 19: [72, 1], 21: [77, 2],
    24: [76, 1], 25: [75, 1], 26: [76, 1], 28: [68, 1], 30: [71, 2],
  };
  const VIBES = { 2: 76, 11: 74, 18: 72, 26: 71, 30: 68 };
  let bus = null, timer = null, next = 0, step = 0, mood = 'calm', target = 'calm';

  function note(t, f, { type = 'sine', dur = .3, vol = .2, attack = .005, lp } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    env(g, t, vol, attack, dur);
    let n = o;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; n.connect(fl); n = fl; }
    n.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + .05);
  }
  function hiss(t, f, dur, vol, type = 'highpass', q = 1) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, vol, .002, dur);
    src.connect(fl).connect(g).connect(bus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + .05);
  }
  // a tight drum kit
  const kick = (t, v = .9) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); env(g, t, v, .002, .22); o.connect(g).connect(bus); o.start(t); o.stop(t + .3); };
  const snare = (t, v = .32) => { hiss(t, 1900, .13, v, 'bandpass', .8); note(t, 190, { dur: .07, vol: v * .5 }); };
  const hat = (t, v = .1, open = false) => hiss(t, 8000, open ? .16 : .035, v);
  // muted surf-guitar chord stab
  const stab = (t, chord, v = .045) => chord.forEach(m => note(t, midi(m + 12), { type: 'square', dur: .08, vol: v, lp: 1900 }));
  // lead: a twangy square through a low-pass, with a soft sine an octave down for body
  const lead = (t, m, len, eighth, v = .085) => {
    const dur = Math.max(.12, len * eighth * .9);
    note(t, midi(m), { type: 'square', dur, vol: v, lp: 2400 });
    note(t, midi(m - 12), { dur, vol: v * .6 });
  };

  function play(i, t, eighth) {
    const pos = i % 8, bar = (i >> 3) % 4, loop = i >> 5;
    const half = t + eighth / 2;
    if (mood === 'calm') {
      const b = WALK[bar][pos];
      if (b) note(t, midi(b), { type: 'triangle', dur: .28, vol: .5, lp: 700 });
      if (pos === 0) kick(t, .5);
      if (pos % 2) hat(t, .06);
      const v = VIBES[i % 32];
      if (v) { note(t, midi(v), { dur: 1.5, vol: .1, attack: .01 }); note(t, midi(v) * 4, { dur: .4, vol: .012 }); }
      return;
    }
    // driving bass: the riff, doubled an octave up for bite
    const b = RIFF[bar][pos];
    note(t, midi(b), { type: 'sawtooth', dur: eighth * .85, vol: .32, lp: 800 });
    note(t, midi(b - 12), { dur: eighth * .9, vol: .35 });
    // kit: kick on 1, the "and" of 2 and 3; snare on 2 and 4; hats on every eighth
    if (pos === 0 || pos === 3 || pos === 4) kick(t);
    if (pos === 2 || pos === 6) snare(t);
    hat(t, pos % 2 ? .09 : .06);
    if (pos === 7 && bar === 3) hat(t, .08, true);
    // phrase-end fill: 16th snares into the top of the loop
    if (bar === 3 && pos >= 6) { snare(t, .22); snare(half, .26); }
    // guitar stabs on the off-beats of 2 and 4
    if (pos === 3 || pos === 7) stab(t, CHORDS[bar]);
    // lead hook: every other loop, so it stays fresh
    const h = HOOK[i % 32];
    if (h && loop % 2 === 1) lead(t, h[0], h[1], eighth);
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (next < ctx.currentTime) next = ctx.currentTime + .05;        // catch up after a stall instead of bursting
    while (next < ctx.currentTime + .3) {
      const eighth = 60 / BPM[mood] / 2;
      play(step, next, eighth);
      next += eighth; step++;
    }
  }
  const wanted = () => musicOn && !muted && !document.hidden && ctx && ctx.state === 'running';

  return {
    // start or stop to match the settings, fading so it never clicks in or out
    sync() {
      if (wanted() && !timer) {
        if (!bus) { bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out); }
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setTargetAtTime(LEVEL, ctx.currentTime, .5);
        next = ctx.currentTime + .1; step = 0;
        timer = setInterval(tick, 90);
        tick();
      } else if (!wanted() && timer) {
        clearInterval(timer); timer = null;
        if (bus && ctx) { bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(0, ctx.currentTime, .08); }
      }
    },
    // switching intensity lands on the next bar line so the groove never stumbles
    mood(m) {
      if (m === target || !BPM[m]) return;
      target = m;
      const toBar = (8 - (step % 8)) % 8;
      if (!timer || toBar === 0) mood = m;
      else setTimeout(() => { mood = target; }, toBar * 60 / BPM[mood] / 2 * 1000);
    },
    // dip under a big moment (stamp, fanfare), then come back up
    duck(ms = 3000) {
      if (!bus || !ctx || !timer) return;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(LEVEL * .2, t, .08);
      bus.gain.setTargetAtTime(LEVEL, t + ms / 1000, .5);
    },
    playing: () => !!timer,
    current: () => mood,
  };
})();

const Sound = {
  // UI
  tap()    { hiss({ dur: .022, vol: .05, type: 'highpass', f: 2600 }); },
  select() { tone({ f: 620, f2: 900, dur: .07, vol: .07 }); hiss({ dur: .018, vol: .035, type: 'highpass', f: 3200 }); },
  error()  { tone({ f: 233, f2: 196, dur: .16, vol: .1, type: 'triangle' }); },
  // paper being slid across the desk
  paper()  { hiss({ dur: .24, vol: .07, f: 1300, f2: 3400, q: .7, attack: .05 }); hiss({ at: .09, dur: .16, vol: .045, f: 2800, f2: 1500, q: .9, attack: .03 }); },
  // rubber stamp: low body thump, a felt slap, and a tiny contact click
  stamp()  { tone({ f: 165, f2: 48, dur: .22, vol: .5, attack: .002 }); hiss({ dur: .09, vol: .26, type: 'lowpass', f: 1100 }); hiss({ dur: .012, vol: .16, type: 'highpass', f: 4200 }); },
  thud()   { tone({ f: 120, f2: 55, dur: .18, vol: .3, attack: .002 }); hiss({ dur: .06, vol: .12, type: 'lowpass', f: 700 }); },
  pin()    { Sound.paper(); tone({ f: 1568, at: .13, dur: .06, vol: .05 }); bell(2093, .17, .4, .05); },
  // camera: mirror slap, then the shutter closing
  shutter() { hiss({ dur: .018, vol: .3, type: 'highpass', f: 2800 }); tone({ f: 260, f2: 120, dur: .05, vol: .12 }); hiss({ at: .075, dur: .022, vol: .2, type: 'highpass', f: 2200 }); },
  whoosh() { hiss({ dur: .4, vol: .18, f: 320, f2: 2800, q: 1.2, attack: .14 }); },
  sent()   { bell(1568, 0, .5, .07); bell(2093, .08, .6, .05); },
  tick(hi) { tone({ f: hi ? 1760 : 1320, dur: .035, vol: hi ? .13 : .07 }); hiss({ dur: .01, vol: .05, type: 'highpass', f: 5000 }); },
  vote()   { tone({ f: 560, f2: 270, dur: .09, vol: .18 }); hiss({ dur: .015, vol: .07, type: 'highpass', f: 3000 }); },
  blip()   { tone({ f: 990, dur: .06, vol: .045 }); },
  alert()  { pluck(880, 0, .12, .12); pluck(1175, .09, .14, .22); },
  // a case opens: two knocks on the door, then a rising minor motif
  start()  {
    pluck(98, 0, .3, .32); pluck(98, .15, .24, .32);
    [392, 466.2, 587.3, 784].forEach((f, i) => pluck(f, .34 + i * .085, .13, .32));
    bell(1568, .7, 1, .07);
  },
  win()    { [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(f, i * .09, .9, .12)); hiss({ at: .32, dur: .7, vol: .035, type: 'highpass', f: 7000, attack: .05 }); },
  // muted trombone "wah-wah"
  lose()   {
    tone({ f: 392, f2: 370, dur: .32, vol: .13, type: 'sawtooth', lp: 900, attack: .03 });
    tone({ f: 349.2, f2: 311, at: .3, dur: .62, vol: .13, type: 'sawtooth', lp: 650, attack: .03 });
  },
  point()  { tone({ f: 988, dur: .07, vol: .07, type: 'square', lp: 2600 }); tone({ f: 1319, at: .07, dur: .26, vol: .07, type: 'square', lp: 2600 }); },
  // snare roll that swells, then a cymbal crash with a kick under it
  drumroll(sec = 1.5) {
    const n = Math.floor(sec / .045);
    for (let i = 0; i < n; i++) hiss({ at: i * .045, dur: .05, vol: .03 + .13 * (i / n), f: 240 + (i % 2) * 50, q: 1.3 });
    hiss({ at: sec, dur: 1.5, vol: .2, type: 'highpass', f: 5200 });
    tone({ f: 120, f2: 48, at: sec, dur: .35, vol: .45, attack: .002 });
  },
  fanfare() {
    [[523.3, 0], [659.3, .12], [784, .24], [1046.5, .36]].forEach(([f, at]) => tone({ f, at, dur: .55, vol: .09, type: 'sawtooth', lp: 2200, attack: .02 }));
    bell(1046.5, .36, 1.3, .1); bell(1318.5, .5, 1.3, .07);
  },

  muted: () => muted,
  // 'all' = music + effects, 'fx' = effects only, 'off' = silent
  state: () => muted ? 'off' : musicOn ? 'all' : 'fx',
  cycle() {
    if (muted) { muted = false; musicOn = true; }
    else if (musicOn) musicOn = false;
    else muted = true;
    pref.set('fiah.muted', muted ? '1' : '0');
    pref.set('fiah.music', musicOn ? '1' : '0');
    const a = audio();
    if (a && out) out.gain.setTargetAtTime(muted ? 0 : .8, a.currentTime, .02);
    Music.sync();
    return Sound.state();
  },
};

// ---------- overlays ----------
function layer(cls, html, ms) {
  const el = document.createElement('div');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

const FX = {
  reduced,
  // a bigger moment is about to land: get the "first upload" overlay out of its way
  clearOverlays() { document.querySelectorAll('.flash').forEach(el => el.classList.add('out')); },
  // camera flash
  flash() { if (!reduced()) layer('fx-flash', '', 500); },
  // title card between rounds; text must already be escaped
  slate(title, sub) {
    layer('fx-slate', `<div class="slate-card"><div class="slate-title">${title}</div>${sub ? `<div class="slate-sub">${sub}</div>` : ''}</div>`, reduced() ? 900 : 1500);
  },
  // paper confetti: tumbles and flutters as it falls instead of dropping like rain
  confetti({ count = 120, origin = [.5, .3], power = 1 } = {}) {
    if (reduced()) return;
    const c = document.createElement('canvas');
    c.className = 'fx-confetti';
    c.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    document.body.appendChild(c);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const colors = ['#b3261e', '#e0a43a', '#efe3c8', '#c9a46a', '#3f7d4e', '#2f5c7a', '#f7efdc'];
    const bits = Array.from({ length: count }, () => {
      const ang = -Math.PI / 2 + (Math.random() - .5) * 2, v = (8 + Math.random() * 10) * power;
      return {
        x: W * origin[0], y: H * origin[1], vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
        flip: Math.random() * 6.28, vf: .1 + Math.random() * .2, c: colors[Math.random() * colors.length | 0],
      };
    });
    const LIFE = 4200;
    let last = performance.now(), age = 0;
    const frame = now => {
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now; age += dt * 16.67;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = Math.max(0, Math.min(1, (LIFE - age) / 700));
      let alive = 0;
      for (const p of bits) {
        const drag = Math.pow(.982, dt);
        p.vx = p.vx * drag + Math.sin(p.flip) * .14 * dt;
        p.vy = p.vy * drag + .3 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.flip += p.vf * dt;
        if (p.y > H + 30) continue;
        alive++;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.flip));
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (alive && age < LIFE) requestAnimationFrame(frame); else c.remove();
    };
    requestAnimationFrame(frame);
  },
};

window.Sound = Sound;
window.Music = Music;
window.FX = FX;
})();
