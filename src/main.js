import * as THREE from 'three';
import { buildEnvironment } from './env.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { audio } from './audio.js';
import { particleScale, fxQuality } from './fx.js';
import { CY } from './config.js';
import { makePanel, FONT, roundRect, wrapText } from './text.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(0.5); // gentler than 1: keeps the side chalkboard text sharp
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070f);
scene.fog = new THREE.Fog(0x0a0812, 6, 30);

// Everything lives in `world` (stall-local space, origin = seated head). In XR it is
// moved so its origin sits at the player's head; on desktop it stays at the origin.
const world = new THREE.Group();
scene.add(world);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 120);
const DESK_EYE = new THREE.Vector3(0, 0.12, 0.3);
camera.position.copy(DESK_EYE);
camera.lookAt(0, -0.2, -0.75);
// ?cam=head renders from the seated player's eye (what the headset sees) for screenshots.
// ?cam=street slowly sweeps along the street side of the stall: B-roll for the trailer
// (combine with &demo=1 so the stall is busy).
const CAM = new URLSearchParams(location.search).get('cam');
if (CAM === 'head') {
  camera.fov = 90; camera.position.set(0, 0, 0); camera.lookAt(0, -0.35, -0.7); camera.updateProjectionMatrix();
}
const streetCam = (t) => {
  const a = Math.sin(t * 0.07) * 0.75; // swing ±43° around the stall
  camera.position.set(Math.sin(a) * 2.6, 0.05 + Math.sin(t * 0.05) * 0.12, -0.55 - Math.cos(a) * 2.6);
  camera.lookAt(0, -0.38, -0.5);
};
scene.add(camera);

const env = buildEnvironment(world);
const input = new Input(renderer, scene, camera, renderer.domElement, world);
const game = new Game(world, env, input);

// Pinch-point dots: show where a pinch will land, turn gold while pinching.
const dots = input.xrPointers.map(() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false }));
  m.renderOrder = 20; m.userData.noRay = true; m.visible = false; world.add(m); return m;
});

// "Can't see your hands" help: shown in VR when nothing is tracked for a few seconds
// (hand tracking declined in the browser prompt, or hands out of view).
const noHands = makePanel(0.5, 0.17, { pxPerM: 1400 });
noHands.redraw((c, w, h) => {
  roundRect(c, 4, 4, w - 8, h - 8, 30); c.fillStyle = 'rgba(30,14,6,0.95)'; c.fill(); c.lineWidth = 7; c.strokeStyle = '#ffb347'; c.stroke();
  c.textAlign = 'center'; c.fillStyle = '#ffb347'; c.font = FONT(h * 0.17, 900); c.fillText('Can’t see your hands', w / 2, h * 0.24);
  c.fillStyle = '#f6e7d0'; c.font = FONT(h * 0.105, 600);
  wrapText(c, 'Hold your hands up in front of you. If the browser asked about hand tracking, allow it (lock icon by the address bar). Controllers also work: trigger = pinch.', w / 2, h * 0.42, w * 0.9, h * 0.13, 'center');
});
noHands.position.set(0, 0.02, -0.6); noHands.userData.noRay = true; noHands.visible = false; noHands.renderOrder = 30;
noHands.material.depthTest = false;
world.add(noHands);
let xrStart = 0, lastTracked = 0;

// ---------------------------------------------------------------- recentering
let needRecenter = 0;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _f = new THREE.Vector3();
function recenterNow() {
  const xrCam = renderer.xr.getCamera();
  xrCam.matrixWorld.decompose(_p, _q, _f);
  _f.set(0, 0, -1).applyQuaternion(_q);
  world.position.copy(_p);
  world.rotation.set(0, Math.atan2(-_f.x, -_f.z), 0);
  world.updateMatrixWorld(true);
}
game.onRecenter = () => { needRecenter = 2; };

// ---------------------------------------------------------------- XR session
const enterBtn = document.getElementById('enter');
async function setupEnter() {
  let supported = false;
  try { supported = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')); } catch { supported = false; }
  if (!supported) {
    enterBtn.textContent = window.isSecureContext ? 'No VR headset here — desktop preview' : 'VR needs HTTPS — desktop preview';
    enterBtn.disabled = true;
    return;
  }
  enterBtn.textContent = 'Enter VR (hands)';
  enterBtn.disabled = false;
  const hint = document.getElementById('hint');
  if (hint) hint.innerHTML = 'Sit down and put your controllers away: <b>hands only</b>.<br />If the browser asks about hand tracking, tap <b>Allow</b>. Hold the Meta button to recenter.';
  enterBtn.onclick = async () => {
    audio.start();
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
      session.addEventListener('end', onSessionEnd);
      session.addEventListener('visibilitychange', () => {
        if (session.visibilityState !== 'visible') { game.systemPause(); audio.suspend(); } else audio.resume();
      });
      await renderer.xr.setSession(session);
      try { if (session.updateTargetFrameRate && session.supportedFrameRates?.includes(72)) session.updateTargetFrameRate(72); } catch { /* optional */ }
      needRecenter = 20;
      try { renderer.xr.getReferenceSpace()?.addEventListener('reset', () => { needRecenter = 3; }); } catch { /* optional */ }
      enterBtn.textContent = 'In VR';
      enterBtn.disabled = true;
      document.body.classList.add('in-xr');
      input.mode = 'xr'; // before showMenu, so the board shows the hands footer
      xrStart = lastTracked = performance.now();
      if (game.state === 'menu') game.showMenu(); // a night paused by taking the headset off stays paused, not lost
    } catch (err) {
      console.warn('XR session failed', err);
      enterBtn.textContent = 'Could not start VR — tap to retry';
    }
  };
}
function onSessionEnd() {
  document.body.classList.remove('in-xr');
  world.position.set(0, 0, 0);
  world.rotation.set(0, 0, 0);
  enterBtn.textContent = 'Enter VR (hands)';
  enterBtn.disabled = false;
  game.systemPause();
}
// Dev-only: ?emulate=1 installs Meta's IWER Quest 3 emulator with tracked hands so the
// XR code path can be tested in a desktop browser. Stripped from production builds.
const params = new URLSearchParams(location.search);
const wantDemo = params.has('demo');
let xrDevice = null;
if (import.meta.env.DEV && params.get('emulate')) {
  import('iwer').then(({ XRDevice, metaQuest3 }) => {
    const device = new XRDevice(metaQuest3);
    device.installRuntime({ forceInstall: true });
    device.primaryInputMode = 'hand';
    xrDevice = device;
    window.SUYA_XR = device;
    setupEnter();
    if (wantDemo) startDemoMode();
  });
} else {
  setupEnter();
  if (wantDemo) startDemoMode();
}

// ?demo=1: the game plays itself (trailer footage / attract loop). See src/demo.js.
function startDemoMode() {
  const begin = () => import('./demo.js').then(({ startDemo }) => {
    if (!xrDevice) document.body.classList.add('demo'); // emulator: the card hides once VR starts
    window.SUYA_DEMO = startDemo({ game, input, world, renderer, nextFrame, device: xrDevice, startNight: Number(params.get('night')) || 0, scene: params.get('scene') || '' });
  });
  if (xrDevice) { begin(); return; } // emulator: the player clicks "Enter VR" (that click also unlocks audio)
  const btn = document.createElement('button');
  btn.id = 'demoStart'; btn.textContent = '▶ Start demo (with sound)';
  btn.onclick = () => { audio.start(); btn.remove(); begin(); };
  document.getElementById('overlay').prepend(btn);
}

renderer.domElement.addEventListener('pointerdown', () => audio.start());
document.addEventListener('visibilitychange', () => { if (document.hidden) game.systemPause(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop
// nextFrame(): resolves after the next game update (used by the demo autopilot; works in XR too).
let frameWaiters = [];
function nextFrame() { return new Promise((r) => frameWaiters.push(r)); }
const clock = new THREE.Clock();
const head = new THREE.Vector3();

// Frame-rate safety net for the Quest: if frames stay slower than ~64 fps for a few seconds,
// trade detail for speed one step at a time (never back up, so it can't oscillate).
// Level 1: stronger fixed foveation (cheaper edges). Level 2: half the particles, no street glows.
// Off in the dev emulator (software rendering is always slow) unless ?adapt=1.
const quality = { level: 0, ema: 1 / 72, slowFor: 0 };
function setQuality(n) {
  quality.level = n;
  renderer.xr.setFoveation(n >= 1 ? 1 : 0.5);
  fxQuality.value = n >= 2 ? 0.5 : 1;
  env.setLowDetail(n >= 2);
}
function watchFrameRate(raw, now) {
  if (quality.level >= 2 || raw > 0.1 || now - xrStart < 6000) return; // skip pauses, loading hitches, session start
  if (xrDevice && !params.has('adapt')) return;
  quality.ema += (raw - quality.ema) * 0.05;
  quality.slowFor = quality.ema > 1 / 64 ? quality.slowFor + raw : Math.max(0, quality.slowFor - raw);
  if (quality.slowFor > 3) { setQuality(quality.level + 1); quality.slowFor = 0; quality.ema = 1 / 72; }
}

renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();
  const dt = Math.min(0.05, raw);
  const inXR = renderer.xr.isPresenting;
  if (inXR) watchFrameRate(raw, performance.now());
  if (inXR && needRecenter > 0) { needRecenter--; if (needRecenter === 0) recenterNow(); }

  const pointers = input.update(dt, inXR);

  if (inXR) {
    renderer.xr.getCamera().getWorldPosition(head);
    particleScale.value = 1000;
  } else {
    if (CAM === 'street') { streetCam(clock.elapsedTime); head.set(0, 0, 0); } // customers still face the cook's seat
    else head.copy(camera.position);
    particleScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
  }
  world.worldToLocal(head);

  if (inXR) {
    const now = performance.now();
    if (pointers.length) lastTracked = now;
    noHands.visible = now - lastTracked > 5000 && now - xrStart > 5000;
  } else noHands.visible = false;

  game.update(dt, pointers, head);
  if (frameWaiters.length) { const w = frameWaiters; frameWaiters = []; w.forEach((r) => r()); }
  input.xrPointers.forEach((p, i) => {
    const d = dots[i];
    d.visible = inXR && p.active;
    if (!d.visible) return;
    d.position.copy(p.pos);
    d.material.color.set(p.pinching ? 0xffc030 : 0xffffff);
    d.scale.setScalar(p.pinching ? 1.4 : 1);
  });
  renderer.render(scene, camera);
});

// Debug / test hook
window.SUYA = { camera, game, input, world, renderer, THREE, nextFrame, quality: { get level() { return quality.level; }, set: setQuality } };
