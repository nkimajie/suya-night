import * as THREE from 'three';

// Pooled point-sprite particles with per-particle colour, alpha and size.
// One draw call per system. Positions are in the parent's local space.
const VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.05, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uSoft;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = vAlpha * smoothstep(1.0, uSoft, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }`;

export const particleScale = { value: 900 };
// Frame-rate safety net: below 1, a share of new particles is skipped (less smoke overdraw near the eyes).
export const fxQuality = { value: 1 };

export class Particles {
  constructor(max, { additive = false, soft = 0.0 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.startSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.startAlpha = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: particleScale, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
    this.points.renderOrder = 5;
  }

  emit(x, y, z, { vx = 0, vy = 0, vz = 0, spread = 0, life = 1, size = 0.02, grow = 0, color = 0xffffff, alpha = 1, gravity = 0 } = {}) {
    if (fxQuality.value < 1 && Math.random() > fxQuality.value) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx + (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 1] = vy + (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread;
    const c = _c.set(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size; this.startSize[i] = size; this.grow[i] = grow;
    this.alpha[i] = alpha; this.startAlpha[i] = alpha;
    this.gravity[i] = gravity;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.startSize[i] + this.grow[i] * (1 - t);
      this.alpha[i] = this.startAlpha[i] * Math.min(1, t * 2.5);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.aAlpha.needsUpdate = true; a.aSize.needsUpdate = true; a.aColor.needsUpdate = true;
  }
}
const _c = new THREE.Color();
