# Devpost submission: Suya Night

Copy each block into the matching form field. Replace anything in [brackets].
All text must be in English (it is; Pidgin lines are always shown as text in speech bubbles).

## Submission name
Suya Night

## Tagline (≤ 140 characters)
Recommended (131): Dad's in hospital. The landlord wants his suya stand. You have 3 nights to grill, spice and serve Lagos with your bare hands in VR.

Alternative (128): Fan the coals, grill, spice and wrap Lagos suya with your bare hands. Save Papa's stall in 3 nights. No controllers. No install.

## Track / Division
Gaming · New Experience (conceived and built inside the competition window)

## Build link
https://nkimajie.github.io/suya-night/ — open it in the Meta Quest Browser and tap **Enter VR (hands)**.

## Video
[YouTube link, public, under 3:00]

## Description (≈ 480 words; Devpost suggests ≤ 500)

**Inspiration**
When the sun goes down in Lagos, the suya man lights his charcoal. The smoke, the yaji pepper, the
onions, the newspaper wrap, the Pidgin banter with regulars: a beloved ritual done entirely by
hand. That made it a natural fit for hands-first VR.

**The game**
Aminu's father, Mallam Sani, has run the most famous suya spot on Allen Avenue for thirty years.
Tonight he is in hospital, and the landlord gives Aminu three nights to prove the stall can make money.

Customers walk up and say their order. You pinch a woven fan and wave it over the coals to keep them
hot, lay skewers on the grill and turn them before they burn, slide the meat onto newspaper, shake
yaji until the pepper is right ("no pepper for madam o!"), add onions or masa, lift the paper to wrap
it, hand it over, and pinch the naira out of the customer's hand. Regulars greet you with a Lagos
handshake: slap palms, then snap. A soft ring shows what each hand will grab, so tracking feels precise.

Act 1 is three nights: a tutorial with Mama Nkechi, a Friday rush with a NEPA blackout cooked by
lantern, and the landlord's inspection. Act 2, "The Spot Grows", adds five nights of building the
business: stars, savings ("rent first, the rest na your own"), six upgrades that appear on your stall,
regulars who become family, bank-transfer customers whose alert is sometimes "pending", a driver
rush, and a fast-food rival opening a "Suya Burger" shop across the road.

**How we built it**
Suya Night is a WebXR app (three.js + Vite) that runs in the Quest Browser from a link, about 240 KB
to download. Every model, texture and sound is generated in code: the characters, the street, the
Afrobeats drifting from the phone shop next door, the sizzle and the generator hum. One input layer
turns hands, controllers or a mouse into the same pinch/poke API, so automated tests in Meta's IWER
emulator play the full tutorial with emulated hands, check that everything you touch stays within
seated reach, and check memory stays flat over a long session.

**Designed for the guidelines**
- Hands only, end to end: menus, story, cooking, pause and retry.
- Seated: everything within about 60 cm of your head, nothing behind you or on the floor.
- Narrow field of view: time and money sit on the counter right under your eyes; tutorial labels
  sit on the object you need.
- Quick in, quick out: first cooking action in about 40 seconds; a night is 5 minutes; removing the
  headset pauses.
- A reason to come back: 1–3 stars per night, savings, visible upgrades, loyal regulars and a daily special.

**What's next**
Stage 3 is already teased in the game: catering Mama Nkechi's daughter's owambe wedding. After that:
match night at a Surulere viewing centre, a Yaba campus spot, a sit-down Suya House in Lekki, and
the kilishi masters of Kano.

## Testing instructions (paste into the testing / notes field)

1. On a Meta Quest 3 or 3S, open the build link in the **Quest Browser**. Sound on.
2. Put the controllers down. Tap **Enter VR (hands)**. If the browser asks about hand tracking, tap **Allow**.
3. Sit. If the stall is not in front of you, hold the Meta button to recenter.
4. Poke **New story** with a fingertip (or pinch it). Night 1 is a guided tutorial (~5 min).
5. **Pause** is the small button on the counter edge, left of the time/money display. Removing the headset also pauses.
6. **Short on time?** Main menu → **Settings → Open all nights**, then **Map & shop**: jump to Night 2
   (blackout about 1.5 min in), Night 5 (driver rush), Night 7 (the rival) or Night 8 (finale), and try the shop
   (₦30,000 added).
7. Settings → Story mode (relaxed, default) / Rush mode (hard); One-hand play (no fanning needed);
   Counter height (lower / normal / higher). Voices are off by default; speech bubbles always show.
8. Note: a pinch with your palm facing you opens the Quest system menu; the game pauses and resumes.

## Hand interactions (optional field)
Every action is a natural hand gesture. Pinch the woven fan and wave it over the grill: how fast you
wave drives the heat, the glowing coals and the embers. Pinch to pick up skewers, sides and the yaji
shaker; turning a skewer is pinch, lift, place. Shaking is detected from direction reversals of the
pinching hand, and the number of shakes sets none / normal / plenty pepper. Lifting the newspaper
wraps the order, and serving is a real hand-to-hand exchange: you let go near the customer's open
hand, then pinch the naira from it. Mama Nkechi and regulars who become family offer a Lagos
handshake: pull back, slap their open palm, then pinch as the hands part for the snap. A soft ring shows what each hand would grab, the pinch point
glows gold while pinching, and pinches use the point where your fingers were last open, so the few
centimetres of drift as fingers close never costs you a grab. Menus are fingertip pokes.

## Special awards this entry fits
Boldest Original Concept · Best First Five Minutes · Best Reason to Come Back ·
Best Accessibility Forward Experience (seated, one-hand play, adjustable counter height, text for
every line, relaxed Story mode timers, doneness not shown by colour alone, a judge pass to any night).

## Gallery images (3:2, 1500×1000, first = thumbnail)
`docs/gallery/1-hand-it-over.png` (thumbnail), then 2 → 7 in order. Regenerate with `npm run shots`.

## Target launch date
[e.g. Q1 2027 on the Meta Horizon Store as a WebXR / PWA title]

## Team
[Name, email, role]
