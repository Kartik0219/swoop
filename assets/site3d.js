/* Swoop Sites: WebGL scenes. Each <canvas data-scene="..."> starts only when it nears the screen,
   and pauses when it leaves, so the page stays fast. Loaded after the page is idle. */
import * as THREE from './three.module.min.js';

const TEAL = 0x2dd4bf, CORAL = 0xff7a59, NAVY = 0x0f2a3d;

// Shared pointer (-1..1), eased per scene
const ptr = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
  ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

const SCENES = { shield, lock, wave };

document.querySelectorAll('canvas[data-scene]').forEach((cv) => {
  const make = SCENES[cv.dataset.scene];
  if (!make) return;
  let s = null;
  new IntersectionObserver((es) => {
    const on = es[0].isIntersecting;
    if (on && !s) s = start(cv, make);
    if (s) s.setVisible(on);
  }, { rootMargin: '300px 0px' }).observe(cv);
});

function start(canvas, make) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  const api = make(scene, camera, canvas);
  const m = { x: 0, y: 0 };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    api.resize && api.resize(w, h);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = false, raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = 0;
    if (!visible) return;
    m.x += (ptr.x - m.x) * 0.06; m.y += (ptr.y - m.y) * 0.06;
    api.update(clock.getElapsedTime(), m);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  canvas.classList.add('on');
  return {
    setVisible(v) { visible = v; if (v && !raf) raf = requestAnimationFrame(frame); }
  };
}

function brandLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.PointLight(TEAL, 60, 40); key.position.set(-4, 3, 6); scene.add(key);
  const rim = new THREE.PointLight(CORAL, 55, 40); rim.position.set(5, -2, 4); scene.add(rim);
  const top = new THREE.DirectionalLight(0xffffff, 0.8); top.position.set(0, 5, 5); scene.add(top);
}

function stars(n, spread) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const a = new THREE.Color(TEAL), b = new THREE.Color(CORAL), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 3.5 + Math.random() * spread, t = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(t) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 7; pos[i * 3 + 2] = Math.sin(t) * r - 3;
    c.copy(a).lerp(b, Math.random() * Math.random());
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
}

function tickMesh(depth = 0.2) {
  const t = new THREE.Shape();
  t.moveTo(-0.85, 0.05); t.lineTo(-0.45, 0.45); t.lineTo(-0.15, 0.15);
  t.lineTo(0.75, 1.05); t.lineTo(1.15, 0.65); t.lineTo(-0.15, -0.65); t.lineTo(-0.85, 0.05);
  const g = new THREE.ExtrudeGeometry(t, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 });
  g.center();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 }));
}

/* Hero: glossy shield with a tick, orbit ring and stars, beside the phone */
function shield(scene, camera) {
  brandLights(scene);
  const s = new THREE.Shape();
  s.moveTo(0, 2.2);
  s.bezierCurveTo(0.9, 1.75, 1.6, 1.7, 1.9, 1.65);
  s.bezierCurveTo(1.95, 0.2, 1.6, -1.3, 0, -2.3);
  s.bezierCurveTo(-1.6, -1.3, -1.95, 0.2, -1.9, 1.65);
  s.bezierCurveTo(-1.6, 1.7, -0.9, 1.75, 0, 2.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 8, curveSegments: 48 });
  g.center();
  const body = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: NAVY, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x0d9488, emissiveIntensity: 0.08 }));
  const tick = tickMesh(); tick.position.set(0.05, 0.05, 0.5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.025, 12, 160), new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.55 }));
  ring.rotation.x = Math.PI / 2.4;
  const grp = new THREE.Group(); grp.add(body, tick, ring); scene.add(grp);
  const dots = stars(420, 5.5); scene.add(dots);
  let wide = false, baseY = 0.4;
  return {
    resize(w) {
      wide = w >= 700;
      const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
      const sc = wide ? Math.min(0.85, halfW / 6) : 0.6;
      grp.scale.setScalar(sc);
      baseY = wide ? 0.4 : 1.2;
      grp.position.set(wide ? -Math.min(halfW - 2.6 * sc, 4.4) : 0, baseY, 0);
    },
    update(t, m) {
      grp.rotation.y = Math.sin(t * 0.5) * 0.35 + m.x * 0.6;
      grp.rotation.x = Math.sin(t * 0.7) * 0.08 + m.y * 0.35;
      grp.position.y = baseY + Math.sin(t * 1.1) * 0.12;
      ring.rotation.z = t * 0.4;
      dots.rotation.y = t * 0.03 + m.x * 0.15; dots.rotation.x = m.y * 0.08;
      tick.material.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15;
    }
  };
}

/* Security section: a padlock that snaps shut as it scrolls into view, with a scanning ring */
function lock(scene, camera, canvas) {
  brandLights(scene);
  camera.position.z = 9;
  const metal = new THREE.MeshPhysicalMaterial({ color: NAVY, metalness: 0.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x0d9488, emissiveIntensity: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d6df, metalness: 0.95, roughness: 0.18 });

  const r = 0.35, w = 2.6, h = 2.1;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6 });
  bg.center();
  const body = new THREE.Mesh(bg, metal);

  // Keyhole glows teal
  const kh = new THREE.Shape();
  kh.absarc(0, 0.15, 0.22, 0, Math.PI * 2, false);
  const keyG = new THREE.ExtrudeGeometry(kh, { depth: 0.06, bevelEnabled: false });
  const keyMat = new THREE.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.9 });
  const key = new THREE.Mesh(keyG, keyMat); key.position.z = 0.53;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.06), keyMat); slot.position.set(0, -0.2, 0.56);

  // Shackle: half torus + two legs, moves up (open) and down (locked)
  const shackle = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.17, 20, 48, Math.PI), steel); arc.position.y = 1.3;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 20), steel); legL.position.set(-0.8, 0.8, 0);
  const legR = legL.clone(); legR.position.x = 0.8;
  shackle.add(arc, legL, legR);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.02, 10, 160), new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.6 }));
  ring.rotation.x = Math.PI / 2;

  const grp = new THREE.Group(); grp.add(body, key, slot, shackle, ring); scene.add(grp);
  const dots = stars(260, 4); scene.add(dots);

  // Lock closes as the section moves up the screen
  function progress() {
    const b = canvas.getBoundingClientRect();
    const p = 1 - (b.top + b.height * 0.5) / window.innerHeight; // 0 when centre at bottom, ~0.5 at middle
    return Math.max(0, Math.min(1, (p - 0.15) / 0.35));
  }
  return {
    update(t, m) {
      const p = progress();
      const e = p * p * (3 - 2 * p);
      shackle.position.y = 0.75 * (1 - e) - 0.05;
      shackle.rotation.y = (1 - e) * 0.9;
      keyMat.emissiveIntensity = 0.3 + e * 0.9 + Math.sin(t * 3) * 0.08 * e;
      grp.rotation.y = Math.sin(t * 0.45) * 0.3 + m.x * 0.5;
      grp.rotation.x = 0.08 + m.y * 0.25;
      grp.position.y = 0.1 + Math.sin(t * 1.2) * 0.08;
      ring.position.y = Math.sin(t * 1.4) * 1.6;
      ring.material.opacity = 0.25 + 0.35 * Math.abs(Math.cos(t * 1.4));
      dots.rotation.y = t * 0.04;
    }
  };
}

/* Contact section: a rolling wave of dots that ripples under the pointer */
function wave(scene, camera) {
  camera.position.set(0, 4.2, 10); camera.lookAt(0, 0, 0);
  const cols = 120, rows = 50, sx = 0.28, sz = 0.28;
  const n = cols * rows, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const a = new THREE.Color(TEAL), b = new THREE.Color(CORAL), c = new THREE.Color();
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = (i * rows + j) * 3;
    pos[k] = (i - cols / 2) * sx; pos[k + 2] = (j - rows / 2) * sz;
    c.copy(a).lerp(b, i / cols);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(pts);
  const attr = g.attributes.position;
  return {
    update(t, m) {
      const mx = m.x * cols * sx * 0.5, mz = m.y * rows * sz * 0.5;
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3], z = pos[i * 3 + 2];
        const d = Math.hypot(x - mx, z - mz);
        pos[i * 3 + 1] = Math.sin(x * 0.45 + t * 1.1) * 0.35 + Math.cos(z * 0.6 + t * 0.8) * 0.25 + Math.exp(-d * d * 0.08) * Math.sin(d * 2 - t * 4) * 0.5;
      }
      attr.needsUpdate = true;
      pts.rotation.y = m.x * 0.08;
    }
  };
}
