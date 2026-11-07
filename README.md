# Suya Night

A hands-first, seated VR cooking game for Meta Quest. Your father's suya stand is on
Allen Avenue in Lagos. He is in hospital, and the landlord gives you 3 nights to prove
the stall can make money. Fan the charcoal, grill, spice and wrap every order with your
bare hands.

Built with three.js + WebXR, so it runs in the Meta Quest Browser straight from a link.
There are no binary assets: every model, texture and sound is generated in code.

## Play
- **On Quest:** open the hosted link in the Quest Browser, then tap **Enter VR (hands)**.
  Put your controllers down. Hand tracking is the main input. Controllers also work, with
  the trigger acting as a pinch.
- **On desktop (testing only):** `npm run dev` and open http://localhost:5173. Click = pinch.
  Drag the woven fan fast over the grill to fan the coals. Add `?cam=head` to see the seated
  headset viewpoint.

### How to cook (all by hand)
| Action | Gesture |
| --- | --- |
| Fan the coals | Pinch the woven fan and wave it fast over the grill |
| Take meat | Pinch a stick in the tray |
| Grill / turn | Lay it on the grill. Pinch, lift and put it back down to turn it |
| Slide meat off | Drop the stick on the newspaper |
| Yaji pepper | Pinch the shaker and shake it over the paper (1–5 shakes = normal, 6+ = plenty) |
| Sides | Pinch onions / cabbage / tomatoes / masa from a bowl and drop them on the paper |
| Wrap | Pinch the newspaper and lift it |
| Serve | Let go of the wrap near the customer's open hand |
| Get paid | Pinch the naira note in their hand |
| Menus | Poke a button with a fingertip (or pinch it) |
| Pause | Poke **Pause** on the right of the counter. Taking the headset off also pauses |

## Develop
```bash
npm install
npm run dev          # desktop, http://localhost:5173
npm run dev:quest    # HTTPS on your LAN; open https://<your-mac-ip>:5173 on the Quest
npm run build        # production build in dist/
npm test             # headless Chrome: plays the full tutorial order, checks nights 2-3
```
`npm run dev:quest` uses a self-signed certificate. In the Quest Browser, choose
*Advanced → Proceed* the first time.

## Deploy (GitHub Pages)
1. Create a GitHub repo and push this folder to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push. The site URL appears
   in the workflow run. That URL is the build link for the Devpost form.

## Code map
| File | What it does |
| --- | --- |
| `src/main.js` | Renderer, WebXR session, recentering, frame loop |
| `src/input.js` | Hands / controllers / mouse → one `Pointer` API (pinch, tip, palm velocity) |
| `src/kitchen.js` | Grill & coals, skewers + cooking, tray, newspaper, yaji, sides, wrapping, waste bin |
| `src/customers.js` | Procedural characters, speech bubbles, order cards, patience, payment |
| `src/game.js` | Game state machine, nights, tutorial, scoring, story flow, pause |
| `src/story.js` | Characters, Pidgin dialogue, story beats |
| `src/ui.js` | Poke/pinch buttons, story board, chalkboard HUD, Papa's notebook, highlights |
| `src/env.js` | Night street, stall, lights, NEPA blackout |
| `src/audio.js` | Procedural ambience, Afrobeats-style loop, SFX, optional speech |
| `src/config.js` | Layout, meats, prices, per-night tuning, difficulty |
