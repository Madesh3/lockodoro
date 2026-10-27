# Lockodoro

Lock in + Pomodoro. A tiny, soft, liquid-glass focus timer for Windows that sits in the corner of your screen.

- Press **Lock in**: the window blurs over, a gold ring ripples out, and you're locked in.
- While locked, the controls step back. To stop early you have to **hold** the button.
- Rolling serif digits, organic shapes that slowly breathe, motivation quotes under the timer.
- 25 / 5 / 15 minute cycles, a long break every 4 sessions, a notification and chime when time's up.

## Run

```bash
npm install
npm start
```

## Build a portable .exe

```bash
npm run dist
```

The exe lands in `dist/`.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | Lock in / hold to unlock |
| R | Reset |
| S | Skip |
| M | Mute |
| P | Pin on top |

Quotes live in `src/quotes.js`; session lengths are at the top of `src/app.js`.
