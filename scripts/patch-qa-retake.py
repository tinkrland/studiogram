import pathlib

p = pathlib.Path("core/99-qa.js")
s = p.read_text()

anchor = '''  results.push("moves serialize with state: " + (Array.isArray(JSON.parse(st.moves)) && JSON.parse(st.moves).length === 3));'''
assert anchor in s

check = '''
  // the retake channel: a take's recorded hand motion replays on a new
  // take's clock while the camera is driven fresh. pure, so deterministic.
  {
    const rec = { path: [
      { t: 1000, pose: JSON.parse(JSON.stringify(S.pose)) },
      { t: 2000, pose: JSON.parse(JSON.stringify({ ...S.pose, fingers: { ...S.pose.fingers, index: { curl: 1, spread: 0 } } })) },
      { t: 4000, pose: JSON.parse(JSON.stringify({ ...S.pose, fingers: { ...S.pose.fingers, index: { curl: 0, spread: 0 }, middle: { curl: 1, spread: 0 } } })) },
    ] };
    const base = JSON.parse(JSON.stringify(S.pose));
    const early = replayPoseAt(rec, 500, base).fingers.index.curl;      // before motion: base
    const mid = replayPoseAt(rec, 1500, base).fingers.index.curl;        // between keyframes: eased
    const held = replayPoseAt(rec, 3000, base).fingers.index.curl;       // carried forward
    const late = replayPoseAt(rec, 5000, base).fingers;                  // after the channel: final pose holds
    const r1 = replayPoseAt(rec, 1500, base), r2 = replayPoseAt(rec, 1500, base);
    results.push("retake channel replays pure: " +
      (early === 0 && Math.abs(mid - 0.5) < 0.01 && Math.abs(held - 1) < 0.01 && late.index.curl === 0 && late.middle.curl === 1 && r1.fingers.index.curl === r2.fingers.index.curl) +
      " (base -> mid " + mid.toFixed(2) + " -> held 1.00 -> final index 0, middle 1)");
    const nomotion = { path: [{ t: 0 }, { t: 2000 }] };
    results.push("retake without motion returns the base: " + (replayPoseAt(nomotion, 1000, base) === base));
  }
'''

s = s.replace(anchor, anchor + check, 1)
p.write_text(s)
print("retake checks added")
