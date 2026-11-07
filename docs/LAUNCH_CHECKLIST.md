# Launch checklist (deadline: 18 Nov 2026, 20:00 GMT)

## 1. Test on a Quest (needs the headset; cannot be automated)
Run `npm run dev:quest`, then open `https://<your-mac-ip>:5173` in the Quest Browser.
Controllers down, hand tracking on.

- [ ] Enter VR: the stall appears in front of you at a comfortable seated height.
      Hold the Meta button to recenter if needed.
- [ ] Menu buttons respond to a fingertip poke and to a pinch.
- [ ] Fanning: pinching the woven fan and waving it over the grill fills the fire bar and throws embers.
- [ ] Pinching a stick in the tray picks it up. The tray compartments are not too small.
- [ ] Turning a stick (pinch, lift, put down) flips it.
- [ ] Yaji: 6 shakes reach "PLENTY pepper". Shaking does not feel too sensitive or too stiff.
- [ ] Lifting the newspaper wraps the order. Handing it to the customer works on the first try.
- [ ] Pinching the naira note collects it.
- [ ] Taking the headset off pauses. Resume works.
- [ ] Night 2 NEPA blackout: the lantern light is still bright enough to judge doneness.
- [ ] Frame rate feels smooth with 2 customers and a full grill.
- [ ] Speech voices: if they sound bad, turn them off in the menu ("Voices off"). Speech
      bubbles always show the text.

Values to tune if something feels off (all in code):
- Reach and layout: `LAYOUT` in `src/config.js`
- Night length, targets, patience: `NIGHTS` / `MODES` in `src/config.js`
- Pinch sensitivity: `PINCH_ON` / `PINCH_OFF` in `src/input.js`
- Fan threshold: `_fanAt()` in `src/kitchen.js`; burn-down speed: `HEAT` in `src/config.js`
- Shake threshold: `_updateShaking()` in `src/kitchen.js`
- Cooking speed: `COOK.baseRate` in `src/config.js`

## 2. Deploy
- [ ] Push to GitHub (`main`), then set Settings → Pages → Source: GitHub Actions.
- [ ] Open the Pages URL on the Quest and play Night 1 end to end.
- [ ] Keep the repo and Pages live until judging ends.

## 3. Video (under 3:00, public on YouTube or Vimeo)
Record in the headset (Meta button → Camera → Record video). Lead with the best footage.

| Time | Shot |
| --- | --- |
| 0:00–0:12 | Night street, glowing grill, hand fanning the coals and embers flying. Title card. |
| 0:12–0:30 | Story: Mallam Sani is in hospital, Chief Adebayo's 3-night ultimatum. |
| 0:30–1:15 | Mama Nkechi's tutorial order: tray, grill, turn, slide off, yaji shake, onions, wrap, hand over, take the naira. |
| 1:15–1:45 | Night 2 rush: two customers, Big Boss Emeka's "no pepper for madam", NEPA blackout by lantern. |
| 1:45–2:20 | Night 3: Chief Adebayo tastes, black-cap man's hardest order, burning-stick save. |
| 2:20–2:45 | Ending: the blogger reveal and Mallam Sani's "The spot na your own now." |
| 2:45–3:00 | "Hands only. Seated. One night = 5 minutes." Build link. |

## 4. Submit
- [ ] Fill the form from `docs/SUBMISSION.md` (the tagline is 131 of 140 characters).
- [ ] Add the build link and video link, then submit before 18 Nov, 20:00 GMT.
