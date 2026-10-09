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
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// browsers only allow audio after a user gesture; unlock on the first one
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, audio, { once: true, passive: true });

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
  toggle() {
    muted = !muted;
    pref.set('fiah.muted', muted ? '1' : '0');
    const a = audio();
    if (a && out) out.gain.setTargetAtTime(muted ? 0 : .8, a.currentTime, .02);
    return muted;
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
window.FX = FX;
})();
