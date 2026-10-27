(() => {
  const MODES = {
    focus: { min: 25, idle: 'Ready', run: 'Locked in' },
    short: { min: 5, idle: 'Short break', run: 'Breathing' },
    long: { min: 15, idle: 'Long break', run: 'Recharging' },
  };
  const HOLD_MS = 1100;
  const SPRING = 'cubic-bezier(0.34, 1.45, 0.64, 1)';
  const SOFT = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const els = {
    digits: [0, 1, 2, 3].map((i) => $('#d' + i)),
    colon: $('.colon'), status: $('#status'), sessions: $('#sessions'),
    prog: $('#prog'), quote: $('#quote'), go: $('#go'), label: $('#label'),
    veil: $('#veil'), thumb: $('#thumb'),
    miniDigits: [0, 1, 2, 3].map((i) => $('#m' + i)),
    miniStatus: $('#miniStatus'), miniGo: $('#miniGo'), miniProg: $('#miniProg'),
  };

  // ───────── persisted bits ─────────
  const today = new Date().toDateString();
  const saved = (() => { try { return JSON.parse(localStorage.getItem('lockodoro')) || {}; } catch { return {}; } })();
  const state = {
    mode: 'focus',
    status: 'idle', // idle | running | paused
    total: MODES.focus.min * 60e3,
    remaining: MODES.focus.min * 60e3,
    endAt: 0,
    sessions: saved.date === today ? saved.sessions : 0,
    muted: !!saved.muted,
    compact: !!saved.compact,
    busy: false, // true while the lock-in ceremony plays
  };
  const persist = () => {
    try { localStorage.setItem('lockodoro', JSON.stringify({ date: today, sessions: state.sessions, muted: state.muted, compact: state.compact })); } catch {}
  };

  // ───────── sound: soft, synthesized ─────────
  let ctx, master;
  function ac() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      // a touch of lowpass keeps everything warm, never clicky
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      master.connect(lp).connect(ctx.destination);
    }
    return ctx;
  }
  function tone(freq, when = 0, dur = 0.6, vol = 0.1, type = 'sine', glideTo, attack = 0.012) {
    if (state.muted) return;
    const c = ac(), t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    tap: () => tone(740, 0, 0.09, 0.05, 'sine', 600, 0.004),
    pop: () => tone(480, 0, 0.16, 0.07, 'sine', 820, 0.006),
    lock: () => {
      tone(1100, 0, 0.05, 0.05, 'triangle', 700, 0.002); // shackle
      tone(190, 0.1, 0.42, 0.32, 'sine', 62, 0.006);      // warm thock
      tone(659, 0.34, 1.1, 0.055);                        // soft chime
      tone(988, 0.46, 1.3, 0.04);
    },
    unlock: () => { tone(988, 0, 0.5, 0.04); tone(659, 0.12, 0.7, 0.045); tone(330, 0.12, 0.25, 0.08, 'sine', 260); },
    done: () => { tone(523, 0, 1.6, 0.07); tone(659, 0.14, 1.6, 0.06); tone(784, 0.28, 1.8, 0.05); tone(1047, 0.42, 2.2, 0.035); },
  };

  // ───────── rolling digits ─────────
  function setDigit(el, ch, dir = 1) {
    if (el.dataset.v === ch) return;
    const old = el.lastElementChild;
    const span = document.createElement('span');
    span.textContent = ch;
    el.appendChild(span);
    el.dataset.v = ch;
    if (!old) return;
    // counting down rolls from above, like a drum turning toward you
    const d = dir > 0 ? -1 : 1;
    span.animate(
      [{ transform: `translateY(${d * 62}%)`, opacity: 0, filter: 'blur(6px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
      { duration: 560, easing: SPRING }
    );
    old.animate(
      [{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: `translateY(${-d * 58}%)`, opacity: 0, filter: 'blur(6px)' }],
      { duration: 420, easing: SOFT, fill: 'forwards' }
    ).onfinish = () => old.remove();
  }

  // ───────── status text ─────────
  let statusText = '';
  function setStatus(text) {
    if (text === statusText) return;
    statusText = text;
    const mini = els.miniStatus;
    mini.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(3px)' }], { duration: 160, easing: SOFT, fill: 'forwards' })
      .onfinish = () => {
        mini.textContent = text;
        mini.getAnimations().forEach((a) => a.cancel());
        mini.animate([{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: SOFT });
      };
    const el = els.status;
    el.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(3px)', transform: 'translateY(-4px)' }], { duration: 180, easing: SOFT, fill: 'forwards' })
      .onfinish = () => {
        el.getAnimations().forEach((a) => a.cancel());
        el.innerHTML = '';
        [...text].forEach((ch, i) => {
          const s = document.createElement('span');
          s.textContent = ch;
          s.className = 'in';
          s.style.animationDelay = `${i * 26}ms`;
          el.appendChild(s);
        });
      };
  }

  // ───────── sessions dots ─────────
  function renderSessions(popIndex = -1) {
    els.sessions.innerHTML = '';
    const filled = state.sessions % 4 || (state.sessions > 0 && state.mode !== 'focus' ? 4 : 0);
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('i');
      if (i < filled) d.className = 'done';
      if (i === popIndex) d.classList.add('pop');
      els.sessions.appendChild(d);
    }
    els.sessions.title = `${state.sessions} session${state.sessions === 1 ? '' : 's'} today`;
  }

  // ───────── quotes ─────────
  let lastQuote = -1;
  function nextQuote() {
    const pool = state.mode === 'focus' ? window.QUOTES : window.BREAK_QUOTES;
    let i;
    do { i = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && i === lastQuote);
    lastQuote = i;
    els.quote.classList.add('out');
    setTimeout(() => {
      els.quote.querySelector('p').textContent = pool[i][0];
      els.quote.querySelector('cite').textContent = '— ' + pool[i][1];
      els.quote.classList.remove('out');
    }, 380);
  }

  // ───────── render ─────────
  const pad = (n) => String(n).padStart(2, '0');
  let lastSec = -1;
  function renderTime(force) {
    const sec = Math.ceil(state.remaining / 1000);
    if (sec === lastSec && !force) return;
    const dir = sec <= lastSec || lastSec < 0 ? 1 : -1;
    lastSec = sec;
    const str = pad(Math.floor(sec / 60)) + pad(sec % 60);
    els.digits.forEach((el, i) => setDigit(el, str[i], dir));
    els.miniDigits.forEach((el, i) => setDigit(el, str[i], dir));
    document.querySelectorAll('.colon').forEach((c) => c.classList.toggle('dim', sec % 2 === 1));
    const p = 1 - state.remaining / state.total;
    els.prog.style.transform = els.miniProg.style.transform = `scaleX(${p})`;
    window.win?.progress(state.status === 'idle' ? -1 : p);
    const word = state.status === 'running' ? (state.mode === 'focus' ? 'Locked in' : 'Break') : 'Paused';
    document.title = state.status === 'idle' ? 'Lockodoro' : `${str.slice(0, 2)}:${str.slice(2)} · ${word}`;
  }

  function setLabel(text) {
    if (els.label.textContent === text) return;
    els.label.classList.add('swap');
    setTimeout(() => { els.label.textContent = text; els.label.classList.remove('swap'); }, 160);
  }

  function renderStatus() {
    const m = MODES[state.mode];
    const focus = state.mode === 'focus';
    app.dataset.mode = state.mode;
    app.dataset.status = state.status;
    app.classList.toggle('locked', focus && state.status === 'running');

    setStatus(state.status === 'running' ? m.run : state.status === 'paused' ? 'Paused' : m.idle);
    setLabel(
      focus
        ? { idle: 'Lock in', running: 'Hold to unlock', paused: 'Lock back in' }[state.status]
        : { idle: 'Start break', running: 'Pause', paused: 'Resume' }[state.status]
    );
  }

  function setMode(mode, { quote = true } = {}) {
    state.mode = mode;
    state.status = 'idle';
    state.total = state.remaining = MODES[mode].min * 60e3;
    document.querySelectorAll('.modes button').forEach((b, i) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      if (on) els.thumb.style.transform = `translateX(${i * 100}%)`;
    });
    renderStatus();
    renderTime(true);
    renderSessions();
    if (quote) nextQuote();
  }

  // ───────── timer ─────────
  let tick;
  function loop() {
    if (state.status !== 'running') return;
    state.remaining = Math.max(0, state.endAt - Date.now());
    renderTime();
    if (state.remaining <= 0) return finish();
    tick = setTimeout(loop, 200);
  }
  function run() {
    state.status = 'running';
    state.endAt = Date.now() + state.remaining;
    renderStatus();
    loop();
  }
  function pause() {
    clearTimeout(tick);
    state.remaining = Math.max(0, state.endAt - Date.now());
    state.status = 'paused';
    renderStatus();
    renderTime(true);
  }
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function lockIn() {
    if (state.busy) return;
    state.busy = true;
    restart(els.go, 'bloom');
    app.classList.add('locked'); // shackle closes on the button first
    sfx.lock();
    setTimeout(() => restart(els.veil, 'on'), 120);
    // WAAPI so the dip layers on top of the CSS shape-morph instead of replacing it
    setTimeout(() => app.animate([{ scale: 1 }, { scale: 0.99 }, { scale: 1 }], { duration: 520, easing: SOFT }), 260);
    setTimeout(() => {
      if (state.status === 'idle') nextQuote();
      run();
    }, 900);
    setTimeout(() => { state.busy = false; }, 1300);
  }

  function finish() {
    clearTimeout(tick);
    state.remaining = 0;
    renderTime(true);
    sfx.done();
    restart(app, 'ding');

    const wasFocus = state.mode === 'focus';
    if (wasFocus) { state.sessions++; persist(); }
    try {
      new Notification(wasFocus ? 'Session complete' : 'Break over', {
        body: wasFocus ? 'You stayed locked in. Take a breather.' : 'Back to it. Lock in.',
        silent: true,
      });
    } catch {}

    state.status = 'idle';
    app.classList.remove('locked');
    setStatus(wasFocus ? 'Nice work' : 'Time’s up');
    setTimeout(() => {
      const next = wasFocus ? (state.sessions % 4 === 0 ? 'long' : 'short') : 'focus';
      setMode(next);
      if (wasFocus) renderSessions((state.sessions - 1) % 4);
    }, 2000);
  }

  // ───────── the big button ─────────
  let holdTimer, holdBtn, swallowClick = false;
  const isLocked = () => state.mode === 'focus' && state.status === 'running';
  const activeGo = () => (state.compact ? els.miniGo : els.go);

  function startHold(e) {
    if (!isLocked() || state.busy) return;
    holdBtn = e?.currentTarget instanceof HTMLElement ? e.currentTarget : activeGo();
    holdBtn.classList.add('holding');
    holdTimer = setTimeout(() => {
      holdBtn.classList.remove('holding');
      swallowClick = e?.type === 'pointerdown'; // the release will fire a click
      sfx.unlock();
      pause();
    }, HOLD_MS);
  }
  function cancelHold() {
    if (!holdBtn?.classList.contains('holding')) return;
    clearTimeout(holdTimer);
    holdBtn.classList.remove('holding');
    restart(holdBtn, 'nudge'); // let go too early: a gentle "not yet"
  }
  function primary() {
    if (state.busy) return;
    if (swallowClick) { swallowClick = false; return; }
    if (isLocked()) return; // must hold
    if (state.mode === 'focus') return lockIn();
    sfx.pop();
    restart(els.go, 'bloom');
    state.status === 'running' ? pause() : run();
  }

  [els.go, els.miniGo].forEach((btn) => {
    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('click', primary);
  });

  // ───────── mini mode ─────────
  let resizing = false;
  async function setCompact(on, animate = true) {
    if (resizing) return;
    resizing = true;
    state.compact = on;
    persist();
    if (animate) {
      sfx.pop();
      app.classList.remove('unmelt');
      app.classList.add('melt');
      await new Promise((r) => setTimeout(r, 170));
    }
    await window.win?.compact(on);
    app.classList.toggle('compact', on);
    requestAnimationFrame(() => {
      app.classList.add('unmelt');
      app.classList.remove('melt');
      resizing = false;
    });
  }
  $('#shrink').addEventListener('click', () => setCompact(true));
  $('#grow').addEventListener('click', () => setCompact(false));
  $('#reset').addEventListener('click', () => { sfx.tap(); clearTimeout(tick); setMode(state.mode, { quote: false }); });
  $('#skip').addEventListener('click', () => {
    sfx.tap();
    clearTimeout(tick);
    setMode(state.mode === 'focus' ? 'short' : 'focus');
  });
  els.quote.addEventListener('click', () => { sfx.tap(); nextQuote(); });

  document.querySelectorAll('.modes button').forEach((b) =>
    b.addEventListener('click', () => {
      if (isLocked() || (b.dataset.mode === state.mode && state.status === 'idle')) return;
      sfx.pop();
      clearTimeout(tick);
      setMode(b.dataset.mode);
    })
  );

  // window controls
  const soundBtn = $('#sound');
  const syncSound = () => soundBtn.classList.toggle('muted', state.muted);
  soundBtn.addEventListener('click', () => { state.muted = !state.muted; persist(); syncSound(); sfx.tap(); });
  const pinBtn = $('#pin');
  pinBtn.addEventListener('click', async () => { pinBtn.classList.toggle('on', await window.win.togglePin()); });
  $('#min').addEventListener('click', () => window.win.minimize());
  $('#close').addEventListener('click', () => window.win.close());

  // keyboard: space = go (hold to unlock), R reset, S skip, M mute, P pin
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); isLocked() ? startHold(e) : primary(); }
    else if (e.code === 'KeyR' && !isLocked()) $('#reset').click();
    else if (e.code === 'KeyS' && !isLocked()) $('#skip').click();
    else if (e.code === 'KeyM') soundBtn.click();
    else if (e.code === 'KeyP') pinBtn.click();
    else if (e.code === 'KeyC') setCompact(!state.compact);
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') cancelHold(); });

  // ───────── boot ─────────
  els.digits.forEach((el) => setDigit(el, '0'));
  els.miniDigits.forEach((el) => setDigit(el, '0'));
  syncSound();
  if (state.compact) setCompact(true, false);
  document.fonts.ready.then(() => {
    setMode('focus', { quote: false });
    nextQuote();
  });
})();
