# bust: the v2 subject proofs

proofs run 2026-10-14 against assets/bust.glb (cc0, see its provenance
note). each was rendered in the studio's own three.js 0.160 pipeline
with the same environment/lighting treatment as the live app; sheets in
previews/.

## ear frame (ear-frame.json)

authored like the nail plates: four sites on the right ear (lobe, helix,
tragus, conch), each with pos (surface point), out (outward normal), and
back (the exit point on the far side of the channel). machine-picked
from anatomy bands on the mesh; a human-eye pass should fine-tune lobe
height before shipping. the left ear mirrors.

## piercing rendering (previews/pierce-proof-sheet.png)

the front/back pair threads pieces through the ear: a lobe stud with gem
front and flat back disc, a hoop whose ring plane is fit through both
points (two-point fit), a helix labret. the occluded mid-segment needs
no boolean cuts; the ear hides it.

## tone (previews/tone-proof-sheet.png)

the hand's nine swatch-chart presets plus lightness/warmth/depth,
running verbatim on the bust's single clay material. tone becomes
subject-level state so hand and bust render one consistent person.

## necklace drape (previews/necklace-proof-sheet.png)

deterministic, no physics engine: exact mesh cross-sections from
clavicle to jaw, first-hit rays from each section center give the
resting surface; a single sag parameter is bisected until the loop's
arclength equals the necklace length. choker (no surplus) sits tight;
princess length dips onto the chest with the pendant at the lowest
point. chain-*.json are the solved curves for those two lengths (studio
space) as sample data; the in-app solver regenerates curves from the
rings on demand. necklace length is a number in scene state, so the
same scene re-renders the same drape.

next: integrate the bust as a real subject (subject kind + panels +
state), author shape keys per research/subject-morph-variance.md, and
re-run the anchors on any revised sculpt.
