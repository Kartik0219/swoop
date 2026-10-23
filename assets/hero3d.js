/* Swoop Sites hero: 3D security shield + particle field behind the phone.
   Loaded lazily after the page has rendered, so it never slows the first paint. */
import * as THREE from './three.module.min.js';

const stage = document.querySelector('.hero .stage');
const canvas = document.getElementById('hero3d');
if (stage && canvas) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // Lights: teal key + coral rim, matching the brand gradient
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.PointLight(0x2dd4bf, 60, 40); key.position.set(-4, 3, 6); scene.add(key);
  const rim = new THREE.PointLight(0xff7a59, 55, 40); rim.position.set(5, -2, 4); scene.add(rim);
  const top = new THREE.DirectionalLight(0xffffff, 0.8); top.position.set(0, 5, 5); scene.add(top);

  // Shield outline
  const s = new THREE.Shape();
  s.moveTo(0, 2.2);
  s.bezierCurveTo(0.9, 1.75, 1.6, 1.7, 1.9, 1.65);
  s.bezierCurveTo(1.95, 0.2, 1.6, -1.3, 0, -2.3);
  s.bezierCurveTo(-1.6, -1.3, -1.95, 0.2, -1.9, 1.65);
  s.bezierCurveTo(-1.6, 1.7, -0.9, 1.75, 0, 2.2);

  const shieldGeo = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 8, curveSegments: 48 });
  shieldGeo.center();
  const shieldMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2a3d, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x0d9488, emissiveIntensity: 0.08 });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);

  // Tick mark on the face
  const tick = new THREE.Shape();
  tick.moveTo(-0.85, 0.05); tick.lineTo(-0.45, 0.45); tick.lineTo(-0.15, 0.15);
  tick.lineTo(0.75, 1.05); tick.lineTo(1.15, 0.65); tick.lineTo(-0.15, -0.65); tick.lineTo(-0.85, 0.05);
  const tickGeo = new THREE.ExtrudeGeometry(tick, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 });
  tickGeo.center();
  const tickMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 });
  const tickMesh = new THREE.Mesh(tickGeo, tickMat);
  tickMesh.position.set(0.05, 0.05, 0.5);

  // Thin orbit ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.025, 12, 160),
    new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2.4;

  const group = new THREE.Group();
  group.add(shield, tickMesh, ring);
  scene.add(group);

  // Particle field
  const N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cA = new THREE.Color(0x2dd4bf), cB = new THREE.Color(0xff7a59), tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = 3.5 + Math.random() * 5.5, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 7;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r - 3;
    tmp.copy(cA).lerp(cB, Math.random() * Math.random());
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dots = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(dots);

  // Layout: shield sits beside the phone on desktop, above it on mobile
  let wide = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    wide = w >= 700;
    // Keep the whole shield on screen: half the visible width at z=0, minus the shield's half-width
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    const sc = wide ? Math.min(0.85, halfW / 6) : 0.6;
    group.scale.setScalar(sc);
    group.position.set(wide ? -Math.min(halfW - 2.6 * sc, 4.4) : 0, wide ? 0.4 : 1.2, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Pointer follow (eased)
  let tx = 0, ty = 0, mx = 0, my = 0;
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Only animate while the hero is on screen
  let visible = true, raf = 0;
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick_);
  }).observe(stage);

  const clock = new THREE.Clock();
  function tick_() {
    raf = 0;
    if (!visible) return;
    const t = clock.getElapsedTime();
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    group.rotation.y = Math.sin(t * 0.5) * 0.35 + mx * 0.6;
    group.rotation.x = Math.sin(t * 0.7) * 0.08 + my * 0.35;
    group.position.y = (wide ? 0.4 : 1.2) + Math.sin(t * 1.1) * 0.12;
    ring.rotation.z = t * 0.4;
    dots.rotation.y = t * 0.03 + mx * 0.15;
    dots.rotation.x = my * 0.08;
    tickMat.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick_);
  }
  canvas.classList.add('on');
  raf = requestAnimationFrame(tick_);
}
