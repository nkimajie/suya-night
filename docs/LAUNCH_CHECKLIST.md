# Launch checklist (deadline: 18 Nov 2026, 20:00 GMT = 12:00 PST)

Plan: deploy now → feature freeze 14 Nov → record and edit the video 15–16 Nov → submit 17 Nov.

## 0. Before anything (you)
- [ ] You are a member of the Meta **Start** program and registered on the Devpost competition page.
- [ ] Read https://start-developer-competition-26.devpost.com/rules and /updates in a normal browser
      (our automated check could not load them) and confirm nothing changed.

## 1. Deploy (do this first: every other check uses the live link)
- [x] Public repo https://github.com/nkimajie/suya-night, `main` pushed.
- [x] Pages source = GitHub Actions; the workflow builds and publishes `dist/` to https://nkimajie.github.io/suya-night/
- [ ] Open the Pages URL on a desktop: the info card shows, the stall renders, the mouse works.
- [ ] Open it with Meta's **Immersive Web Emulator** Chrome extension and play Night 1 with emulated hands.
- [ ] Put the URL in `docs/SUBMISSION.md`, `README.md` and the Devpost form.
- [x] `og:image` in `index.html` is the absolute URL (https://nkimajie.github.io/suya-night/og.png) so link previews show the picture.

## 2. Test on a real Quest 3 / 3S (borrow one for an hour if you can)
Judges use a Quest 3 or 3S and expect ≥ 60 fps. Open the Pages URL in the Quest Browser, controllers down.
- [ ] "Enter VR (hands)" → allow hand tracking → the stall appears in front at a comfortable seated height.
- [ ] Menu buttons respond to a fingertip poke and to a pinch.
- [ ] Fan: pinching the woven fan and waving it over the grill fills the fire bar and throws embers.
- [ ] Tray, grill turn, paper, yaji (6 shakes = PLENTY), sides, wrap, hand-over and naira all work first try.
- [ ] The aim ring shows what each hand will grab; it does not flicker annoyingly.
- [ ] Pause on the counter edge is easy to poke and is not hit by accident while cooking.
- [ ] Taking the headset off pauses; putting it back on resumes on the pause board.
- [ ] Night 2 blackout: the lantern is bright enough to judge doneness.
- [ ] Frame rate smooth with 2 customers and a full grill (Night 7 is the heaviest).
- [ ] Voices: off by default. Try turning them on in Settings; if they sound bad, leave them off.
- [ ] Declining hand tracking shows the "Can't see your hands" card after ~5 s.

No headset? Everything above except frame rate and real hand feel is covered by `npm test`
(IWER emulator) and the extension. Values to tune if something feels off:
- Reach and layout: `LAYOUT` in `src/config.js` (`npm test` checks every interactable stays within 0.66 m)
- Night length, targets, patience, scripts: `LEVELS` in `src/levels.js`; difficulty: `MODES` in `src/config.js`
- Shop prices and effects: `src/upgrades.js` and `applyUpgrades()` in `src/game.js`
- Pinch sensitivity: `PINCH_ON` / `PINCH_OFF` in `src/input.js`; fan: `_fanAt()`; shake: `_updateShaking()` in `src/kitchen.js`

## 3. Feature freeze (14 Nov)
- [ ] `npm run build && npm test` green. Commit, push, check the live link once more.
- [ ] `npm run shots` and copy `docs/gallery/*.png` into the Devpost gallery (first image = thumbnail).

## 4. Record the video without a headset (15–16 Nov, under 3:00)
The rules allow footage "via XR Simulator or another equivalent emulator". The demo autopilot plays
the real game through Meta's IWER Quest 3 emulator with tracked-hand models, so the footage is genuine
gameplay. Put a small caption on screen: *"Captured in Meta's Immersive Web Emulator."*

Setup: `npm run dev`, Chrome window at 1920×1080 (or full screen), sound on, start a screen recorder
(macOS: Cmd+Shift+5 → record selected portion; or OBS). Open a URL, click **Enter VR** (that click
also starts the audio), and record:

| Clip | URL (dev server, http://localhost:5173/…) | What you get |
|---|---|---|
| A. Full tutorial | `?emulate=1&demo=1` (fresh save: Settings → Reset first, or a private window) | Menu, story cards, Night 1: fan, grill, turn, paper, yaji, onions, wrap, serve, naira |
| B. Rush + blackout | `?emulate=1&demo=1&night=2` | Two customers; NEPA takes the light ~1.5 min in |
| C. Driver rush | `?emulate=1&demo=1&night=5` | OyaGo drivers from ~1:20 |
| D. Grow the stall | `?emulate=1&demo=1&scene=shop` | Buys each upgrade; each appears on the stall |
| E. The rival | `?emulate=1&demo=1&night=7` | Gbam Burger sign, the manager tastes |
| F. B-roll | `?cam=street&demo=1` (click "Start demo") | Slow sweep along the street side of the busy stall |

Suggested cut (lead with the best footage; judges may stop watching early):

| Time | Shot |
|---|---|
| 0:00–0:08 | Close on hands fanning the coals, embers flying, sizzle (clip A). No title card first. |
| 0:08–0:14 | Title: SUYA NIGHT — "Hands only. Seated. Plays from a link." |
| 0:14–0:30 | Story: Papa in hospital, Chief Adebayo's 3-night ultimatum (clip A story cards, with subtitles). |
| 0:30–1:15 | Mama Nkechi's order as a montage of 2-second cuts: tray, grill, turn, paper, yaji, onions, wrap, hand over, take the naira (clip A). |
| 1:15–1:45 | Friday rush: two customers, "no pepper for madam", NEPA blackout by lantern (clip B). |
| 1:45–2:15 | Grow the business: stars and savings, buying upgrades that appear on the stall, a regular becoming FAMILY, a transfer "credit alert", the Gbam Burger rival (clips D, E). |
| 2:15–2:35 | Street B-roll + the wedding-invitation cliffhanger (clip F). |
| 2:35–2:50 | "Hands only · Seated · 5-minute nights · everything generated in code · ~240 KB." Build link. |

Add English subtitles for every Pidgin line (they are also in the speech bubbles). Upload to YouTube
(public), paste the link into Devpost and the README.

## 5. Submit (by 17 Nov)
- [ ] Fill the form from `docs/SUBMISSION.md` (description ≈ 480 words, tagline 131 characters,
      testing instructions, hand-interactions field, team, launch date).
- [ ] Build link + video link, gallery images, then **Submit**.
- [ ] `git tag submission-2026-11-17 && git push --tags`.

## 6. After the deadline (keep the build frozen and online through judging, until 11 Dec)
- [ ] Remove the `push:` trigger in `.github/workflows/deploy.yml` (keep `workflow_dispatch`) so no push
      can change the judged build. Do not delete the repo or disable Pages.
