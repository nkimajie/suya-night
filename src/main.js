import * as THREE from 'three';
import { buildEnvironment } from './env.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { audio } from './audio.js';
import { particleScale } from './fx.js';
import { CY } from './config.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
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
// ?cam=head renders from the seated player's eye (what the headset sees) for screenshots
if (new URLSearchParams(location.search).get('cam') === 'head') {
  camera.fov = 90; camera.position.set(0, 0, 0); camera.lookAt(0, -0.35, -0.7); camera.updateProjectionMatrix();
}
scene.add(camera);

const env = buildEnvironment(world);
const input = new Input(renderer, scene, camera, renderer.domElement, world);
const game = new Game(world, env, input);

// Pinch-point dots: show where a pinch will land, turn gold while pinching.
const dots = input.xrPointers.map(() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false }));
  m.renderOrder = 20; m.userData.noRay = true; m.visible = false; world.add(m); return m;
});

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
    enterBtn.textContent = window.isSecureContext ? 'VR not available here — desktop test mode' : 'VR needs HTTPS — desktop test mode';
    enterBtn.disabled = true;
    return;
  }
  enterBtn.textContent = 'Enter VR (hands)';
  enterBtn.disabled = false;
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
      game.showMenu();
    } catch (err) {
      console.warn('XR session failed', err);
      enterBtn.textContent = 'Could not start VR — tap to retry';
    }
  };
}
function onSessionEnd() {
  world.position.set(0, 0, 0);
  world.rotation.set(0, 0, 0);
  enterBtn.textContent = 'Enter VR (hands)';
  enterBtn.disabled = false;
  game.systemPause();
}
// Dev-only: ?emulate=1 installs Meta's IWER Quest 3 emulator with tracked hands so the
// XR code path can be tested in a desktop browser. Stripped from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('emulate')) {
  import('iwer').then(({ XRDevice, metaQuest3 }) => {
    const device = new XRDevice(metaQuest3);
    device.installRuntime({ forceInstall: true });
    device.primaryInputMode = 'hand';
    window.SUYA_XR = device;
    setupEnter();
  });
} else setupEnter();

renderer.domElement.addEventListener('pointerdown', () => audio.start());
document.addEventListener('visibilitychange', () => { if (document.hidden) game.systemPause(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const head = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const inXR = renderer.xr.isPresenting;
  if (inXR && needRecenter > 0) { needRecenter--; if (needRecenter === 0) recenterNow(); }

  const pointers = input.update(dt, inXR);

  if (inXR) {
    renderer.xr.getCamera().getWorldPosition(head);
    particleScale.value = 1000;
  } else {
    head.copy(camera.position);
    particleScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
  }
  world.worldToLocal(head);

  game.update(dt, pointers, head);
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
window.SUYA = { camera, game, input, world, renderer, THREE };
