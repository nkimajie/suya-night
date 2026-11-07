import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// Turns hand tracking, controllers and the desktop mouse into one Pointer API.
// All positions/velocities are in STALL-LOCAL space so gameplay never touches world space.
//   pos        – pinch point (between thumb and index tip)
//   tip        – index finger tip (for poking buttons)
//   palm       – palm centre (for fanning)
//   palmVel    – smoothed palm velocity (m/s)
//   pinching / pinchStarted / pinchEnded
export class Pointer {
  constructor(id, kind) {
    this.id = id;
    this.kind = kind;
    this.active = false;
    this.pos = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this.palm = new THREE.Vector3();
    this.prevPalm = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.palmVel = new THREE.Vector3();
    this.pinching = false;
    this.pinchStarted = false;
    this.pinchEnded = false;
    this.held = null;
    this.fresh = true;
    this.aim = new THREE.Vector3();
    this.aimT = 0;
  }
  // Where the player was aiming. Real fingers drift several cm while closing a pinch, so
  // grabs first try the pinch point from the last moment the fingers were clearly open
  // (what the player lined up with the object), then the current pinch point.
  candidates() {
    const out = [];
    if (this.aimT && performance.now() - this.aimT < 700) out.push(this.aim);
    out.push(this.pos);
    return out;
  }
  _setPinch(p) {
    this.pinchStarted = p && !this.pinching;
    this.pinchEnded = !p && this.pinching;
    this.pinching = p;
  }
  _velocities(dt) {
    if (this.fresh) { this.prevPos.copy(this.pos); this.prevPalm.copy(this.palm); this.fresh = false; }
    const k = Math.min(1, dt * 18);
    _v.subVectors(this.pos, this.prevPos).divideScalar(Math.max(dt, 1e-3));
    this.vel.lerp(_v, k);
    _v.subVectors(this.palm, this.prevPalm).divideScalar(Math.max(dt, 1e-3));
    this.palmVel.lerp(_v, k);
    this.prevPos.copy(this.pos);
    this.prevPalm.copy(this.palm);
  }
}
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();

const PINCH_ON = 0.022, PINCH_OFF = 0.038, AIM_OPEN = 0.04;
const MOUSE_FAR_Z = -0.72; // ~ LAYOUT.handZ

export class Input {
  constructor(renderer, scene, camera, dom, stall) {
    this.renderer = renderer;
    this.camera = camera;
    this.stall = stall;
    this.pointers = [];
    this.xrPointers = [new Pointer(0, 'hand'), new Pointer(1, 'hand')];
    this.mouse = new Pointer(2, 'mouse');
    this.sources = [null, null];
    this.mode = 'desktop';
    this.handsSeen = false;

    const handFactory = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const hand = renderer.xr.getHand(i);
      hand.add(handFactory.createHandModel(hand, 'mesh'));
      scene.add(hand);
      const grip = renderer.xr.getControllerGrip(i);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      stub.rotation.x = Math.PI / 2;
      grip.add(stub);
      scene.add(grip);
      const ctrl = renderer.xr.getController(i);
      scene.add(ctrl);
      ctrl.addEventListener('connected', (e) => { this.sources[i] = e.data; stub.visible = !e.data.hand; });
      ctrl.addEventListener('disconnected', () => { this.sources[i] = null; this.xrPointers[i].active = false; });
      this.xrPointers[i].hand = hand;
      this.xrPointers[i].grip = grip;
    }

    // Desktop mouse
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(0, -0.3);
    this.mouseDown = false;
    this.mouseInside = false;
    dom.addEventListener('pointermove', (e) => {
      this.ndc.set((e.clientX / dom.clientWidth) * 2 - 1, -(e.clientY / dom.clientHeight) * 2 + 1);
      this.mouseInside = true;
    });
    dom.addEventListener('pointerdown', (e) => { if (e.button === 0) this.mouseDown = true; this.ndc.set((e.clientX / dom.clientWidth) * 2 - 1, -(e.clientY / dom.clientHeight) * 2 + 1); this.mouseInside = true; });
    window.addEventListener('pointerup', () => { this.mouseDown = false; });
    dom.addEventListener('pointerleave', () => { this.mouseInside = false; });
  }

  // Test hook: drive the desktop pointer directly in stall-local coordinates.
  setScripted(pos, pinching) { this.scripted = { pos: pos.clone(), pinching }; }
  clearScripted() { this.scripted = null; }

  update(dt, inXR) {
    this.mode = inXR ? 'xr' : 'desktop';
    this.pointers.length = 0;
    if (inXR) {
      for (let i = 0; i < 2; i++) {
        const p = this.xrPointers[i];
        const src = this.sources[i];
        p.active = false;
        if (!src) { p._setPinch(false); continue; }
        if (src.hand) {
          p.kind = 'hand';
          const j = p.hand.joints;
          const ti = j && j['index-finger-tip'], th = j && j['thumb-tip'], pm = j && j['middle-finger-metacarpal'];
          if (!ti || !th || !pm || !ti.visible) { p._setPinch(false); p.fresh = true; continue; }
          this.handsSeen = true;
          p.active = true;
          ti.getWorldPosition(_v); th.getWorldPosition(_w);
          const d = _v.distanceTo(_w);
          p.tip.copy(_v);
          p.pos.addVectors(_v, _w).multiplyScalar(0.5);
          pm.getWorldPosition(p.palm);
          this._toLocal(p.tip); this._toLocal(p.pos); this._toLocal(p.palm);
          p._setPinch(p.pinching ? d < PINCH_OFF : d < PINCH_ON);
          if (!p.pinching && d > AIM_OPEN) { p.aim.copy(p.pos); p.aimT = performance.now(); }
        } else {
          p.kind = 'controller';
          p.active = true;
          p.grip.getWorldPosition(p.pos);
          p.grip.getWorldQuaternion(_q);
          _w.set(0, 0, -0.06).applyQuaternion(_q);
          p.pos.add(_w);
          p.tip.copy(p.pos); p.palm.copy(p.pos);
          this._toLocal(p.tip); this._toLocal(p.pos); this._toLocal(p.palm);
          const gp = src.gamepad;
          const pressed = !!gp && ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[1] && gp.buttons[1].pressed));
          p._setPinch(pressed);
        }
        p._velocities(dt);
        this.pointers.push(p);
      }
    } else {
      const m = this.mouse;
      if (this.scripted) {
        m.active = true;
        m.pos.copy(this.scripted.pos); m.tip.copy(m.pos); m.palm.copy(m.pos);
        m._setPinch(this.scripted.pinching);
      } else {
        m.active = this.mouseInside || this.mouseDown;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hits = this.raycaster.intersectObject(this.stall, true);
        const hit = hits.find((h) => !h.object.userData.noRay && h.object.visible && isVisibleChain(h.object));
        if (hit) {
          _v.copy(hit.point);
          const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
          _v.addScaledVector(n, hit.object.userData.panel ? 0.01 : 0.035);
          m.pos.copy(_v); this._toLocal(m.pos);
        }
        // Customers are not ray targets, so a ray past the counter would land on the street.
        // Stop it at the plane where customers hold out their hands (like a real arm's reach).
        if (!hit || m.pos.z < MOUSE_FAR_Z) {
          const ray = this.raycaster.ray;
          _w.copy(ray.origin); this._toLocal(_w);
          _v.copy(ray.origin).add(ray.direction); this._toLocal(_v); _v.sub(_w);
          if (_v.z < -1e-4) { const t = (MOUSE_FAR_Z - _w.z) / _v.z; m.pos.copy(_w).addScaledVector(_v, t); }
        }
        m.tip.copy(m.pos); m.palm.copy(m.pos);
        m._setPinch(this.mouseDown);
      }
      m._velocities(dt);
      if (m.active) this.pointers.push(m);
    }
    return this.pointers;
  }

  _toLocal(v) { this.stall.worldToLocal(v); }
}

function isVisibleChain(o) {
  while (o) { if (!o.visible) return false; o = o.parent; }
  return true;
}
