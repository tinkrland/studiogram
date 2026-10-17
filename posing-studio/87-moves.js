// ===== moves: take choreography =====
// an ordered list of finger moves the hand performs during a take: after a
// delay from record start, one value (a curl, a spread, thumb opposition)
// eases to its target over a duration. the list is state; evaluation is a
// pure function of (base pose, moves, t), so the same list re-renders the
// same motion — the export path captures pose as per-frame deltas exactly
// the way it captures lighting, and applies them the same way.
//
// outside a take or a preview, the pose stays manual: the sliders are the
// pose, the moves are the choreography that plays on top of it.

const MOVE_FINGERS = ["index", "middle", "ring", "pinky", "thumb"];
const MOVE_WHATS = { index: ["curl", "spread"], middle: ["curl", "spread"], ring: ["curl", "spread"], pinky: ["curl", "spread"], thumb: ["curl", "opposition"] };
const MOVE_T_MAX = 30, MOVE_OVER_MAX = 3;

function sanitizeMove(m, i) {
  const finger = MOVE_FINGERS.includes(m.finger) ? m.finger : "index";
  const what = (MOVE_WHATS[finger] || ["curl"]).includes(m.what) ? m.what : "curl";
  const t = Math.max(0, Math.min(MOVE_T_MAX, +m.t || 0));
  const to = Math.max(0, Math.min(1, +m.to || 0));
  const over = Math.max(0.1, Math.min(MOVE_OVER_MAX, +m.over || 0.8));
  return { id: typeof m.id === "string" ? m.id : "m" + i + "_" + Math.floor(t * 10), finger, what, t, to, over };
}

function clonePose(p) { return JSON.parse(JSON.stringify(p)); }

// the value a move targets, read from a pose
function readMoveValue(p, finger, what) {
  if (finger === "thumb") return p.thumb[what] || 0;
  return (p.fingers[finger] || {})[what] || 0;
}
function writeMoveValue(p, finger, what, v) {
  if (finger === "thumb") { p.thumb[what] = v; return; }
  if (!p.fingers[finger]) p.fingers[finger] = { curl: 0, spread: 0 };
  p.fingers[finger][what] = v;
}

function easeMove(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; } // easeInOutCubic

// pure evaluation: the pose the hand should hold t seconds into a take.
// moves chain in list order — a move eases from wherever the target is when
// it starts (the previous move's end, or the base pose) to its own target.
function poseAt(base, moves, t) {
  const p = clonePose(base);
  // keyframes per target, in list order
  const seq = {};
  for (const m of moves) {
    const k = m.finger + ":" + m.what;
    (seq[k] = seq[k] || []).push(m);
  }
  for (const k of Object.keys(seq)) {
    const [finger, what] = k.split(":");
    let v = readMoveValue(base, finger, what);
    for (const m of seq[k]) {
      if (t <= m.t) break;                        // not started yet: hold
      const kk = Math.min(1, (t - m.t) / m.over);
      const target = m.to;
      v = v + (target - v) * easeMove(kk);        // from = running value
    }
    writeMoveValue(p, finger, what, v);
  }
  return p;
}

// the live timeline: playing during a take or a preview, driven from the
// record sampler (or the preview loop). the base pose is captured at play
// start so the take never mutates the saved pose.
const MOVES = { base: null, t0: 0, playing: false, raf: null, onFrame: null, mode: "preview" };

function movesDuration(moves) {
  let end = 0;
  for (const m of moves) end = Math.max(end, m.t + m.over);
  return end;
}

function movesTick(now) {
  if (!MOVES.playing || !S.moves.length) return false;
  const t = (now - MOVES.t0) / 1000;
  const next = poseAt(MOVES.base, S.moves, t);
  // write only the targets the choreography owns; everything else is the
  // base pose, untouched
  for (const m of S.moves) writeMoveValue(S.pose, m.finger, m.what, readMoveValue(next, m.finger, m.what));
  applyPose();
  if (MOVES.onFrame) MOVES.onFrame(t);
  // natural end: a preview is a rehearsal and hands the pose back; a take
  // holds the choreography's final pose until recording stops
  if (t >= movesDuration(S.moves) + 0.25) stopMoves(MOVES.mode === "preview");
  return true;
}

function playMoves(fromMs) {
  MOVES.mode = "take";                  // caller may flip it back to preview
  MOVES.base = clonePose(S.pose);
  MOVES.t0 = fromMs || performance.now();
  MOVES.playing = true;
}

function stopMoves(restoreBase) {
  MOVES.playing = false;
  if (MOVES.raf) { clearInterval(MOVES.raf); cancelAnimationFrame(MOVES.raf); MOVES.raf = null; }
  if (MOVES.onFrame) MOVES.onFrame = null;
  if (restoreBase && MOVES.base) { S.pose = clonePose(MOVES.base); applyPose(); }
  MOVES.base = null;
}

// the preview loop: plays the choreography live, outside any take, so it can
// be rehearsed before recording. restores the pose it started from.
function previewMoves() {
  if (MOVES.playing || !S.moves.length) return;
  playMoves();
  MOVES.mode = "preview";
  // an interval, not rAF: the preview must keep stepping even when the
  // compositor is quiet (headless checks, background tabs); the take path
  // drives the same tick from the recorder's own clock
  MOVES.raf = setInterval(() => {
    if (!MOVES.playing) { stopMoves(); return; }
    movesTick(performance.now());
  }, 33);
  const secs = movesDuration(S.moves);
  toast("previewing " + S.moves.length + " moves (" + Math.ceil(secs) + "s). the pose returns when it ends.");
}
