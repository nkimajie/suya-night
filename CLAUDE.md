# Suya Night — project rules

Hands-first, seated WebXR game for the **Meta VR Start Developer Competition 2026**
(Gaming track, New Experience division). **Deadline: 18 Nov 2026, 20:00 GMT.**
After the deadline the build is frozen and must stay hosted through judging.

## Competition hard rules (never break these)
- **Hands only, end to end.** Every step — menus, story, cooking, serving, pause, retry —
  must be completable with hand tracking and no controller. Controllers and mouse are
  optional extras, never required.
- **Seated, two-foot radius.** Everything interactable stays within ~0.6 m of the
  player's head horizontally. No walking, no turning around, no reaching to the floor.
- **Quick in, quick out.** Cold start to cooking in under a minute. A night is ~4–5 min.
  Pause when the headset is taken off / the system menu opens; resume cleanly.
- **Original content only.** No real brands, company names, logos or real people
  (the landlord's fast-food chain is the fictional "Crunchy King"). Respect Meta
  Developer Content Guidelines: no slurs, no mocking religion or ethnic groups.

## Tech
- three.js + Vite, plain ES modules (no TypeScript, no framework). WebXR `immersive-vr`
  with `hand-tracking` as an optional feature.
- All art is procedural (primitives + canvas textures); all audio is procedural Web Audio.
  No binary assets unless there is a strong reason.
- `src/input.js` turns hands / controllers / mouse into one `Pointer` API
  (`pos`, `pinching`, `pinchStarted`, `pinchEnded`, `palmVel`). Gameplay code must only
  use that API so desktop testing exercises the same logic as VR.
- Stall geometry lives in stall-local space (`stall` group). On XR start the stall is
  placed relative to the seated head pose (`recenter`).

## Performance budget (Quest 2/3 browser)
- 72 fps: ≤ 4 dynamic lights, no real-time shadows, ≤ ~150 draw calls,
  pooled particles, canvas textures redrawn only when their content changes.

## Commands
- `npm run dev` — desktop dev server (mouse mode). `npm run dev:quest` — HTTPS on LAN
  for testing on a Quest.
- `npm run build` — production build to `dist/` (relative base, GitHub Pages ready).
- `npm test` — two headless Chrome tests, both fail on any console error:
  `tests/smoke.mjs` plays the full Night 1 tutorial order through the scripted pointer and
  checks nights 2–3 (`CAM=head` renders screenshots from the seated eye to `tests/shot-*.png`);
  `tests/xr.mjs` enters VR in Meta's IWER Quest 3 emulator (`?emulate=1`, dev only) and
  grabs/places/fans with emulated tracked hands.
- Hand pinches drift several cm while the fingers close; grabs use `Pointer.candidates()`
  (open-finger aim point first). Keep that when adding new grabbable things.

## Working rules
- Run `npm run build && npm test` after any non-trivial change.
- Scope discipline: finish and polish the core loop before adding features. Anything
  new must fit the deadline.
- Do not commit or push unless the user asks.
