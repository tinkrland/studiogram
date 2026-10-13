#!/usr/bin/env python3
# splits the eight ordered build parts into domain folders (dollification,
# setdesign, camera, socmed-integration, posing-studio, customized-hands,
# lighting, jewelry, core) at existing section boundaries, preserving the
# exact concatenation order so the artifact stays byte-identical.
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent  # repo root
PARTS = ROOT / "app" / "parts"

# chunk plan: part file -> [(start_line, end_line, target_path)]
PLAN = {
    "01-head.html": [(1, 254, "core/01-head.html")],
    "02-core.js": [(1, 40, "core/02-core.js")],
    "03-registry-state.js": [(1, 203, "core/03-registry-state.js")],
    "04-scene.js": [
        (1, 25, "core/40-render.js"),
        (26, 47, "lighting/41-lighting.js"),
        (48, 73, "setdesign/42-backdrops.js"),
        (74, 168, "core/43-render-composite.js"),
        (169, 206, "camera/45-camera-modes.js"),
    ],
    "05-hand.js": [
        (1, 83, "customized-hands/50-model.js"),
        (84, 101, "customized-hands/52-morphology.js"),
        (102, 231, "customized-hands/54-surface.js"),
        (232, 370, "customized-hands/56-tattoos.js"),
        (371, 390, "dollification/58-finish.js"),
        (391, 460, "posing-studio/60-posing.js"),
    ],
    "06-jewelry.js": [(1, 149, "jewelry/70-jewelry.js")],
    "07-panels.js": [
        (1, 50, "core/80-panel-infra.js"),
        (51, 242, "customized-hands/82-subject-panel.js"),
        (243, 334, "jewelry/84-jewelry-panel.js"),
        (335, 365, "posing-studio/86-pose-panel.js"),
        (366, 428, "camera/88-camera-panel.js"),
        (429, 467, "lighting/90-light-panel.js"),
        (468, 499, "setdesign/92-scene-panel.js"),
        (500, 525, "core/93-panel-shell.js"),
    ],
    "08-boot.js": [
        (1, 164, "socmed-integration/95-captures.js"),
        (165, 234, "core/96-state-io.js"),
        (235, 249, "core/98-boot.js"),
        (250, 398, "core/99-qa.js"),
    ],
}

# the old build joined part texts with a trailing newline; the final chunk of
# each part carries that separator so the manifest concatenation is identical.
for part, chunks in PLAN.items():
    text = (PARTS / part).read_text()
    lines = text.split("\n")
    assert lines[-1] == "", f"{part} does not end with a newline"
    body = lines[:-1]  # without the trailing empty element
    for i, (a, b, target) in enumerate(chunks):
        # line numbers are 1-based inclusive
        piece = "\n".join(body[a - 1:b]) + "\n"
        if i == len(chunks) - 1 and part != "01-head.html":
            piece += "\n"  # the separator the old build appended per part
            # (the head is used verbatim in the html artifact, not in the
            # manifest, so it carries no separator)
        out = ROOT / target
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(piece)
    rebuilt = "".join((ROOT / t).read_text() for _, _, t in chunks)
    expect = text + ("" if part == "01-head.html" else "\n")
    assert rebuilt == expect, f"reassembly mismatch for {part}"
    print(f"{part}: {len(chunks)} chunk(s) ok")
print("split complete")
