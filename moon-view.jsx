// Moon page: rotatable 3D sphere with labeled lunar features overlay.
// Uses Three.js and a high-resolution procedural moon texture.

const { useState, useEffect, useRef, useMemo } = React;

const FEATURES = [
  { name: "Mare Tranquillitatis", lat: 8.5,  lon: 31.4,  type: "mare",    size: 28 },
  { name: "Mare Serenitatis",     lat: 28,   lon: 17,    type: "mare",    size: 26 },
  { name: "Mare Imbrium",         lat: 33,   lon: -18,   type: "mare",    size: 36 },
  { name: "Mare Crisium",         lat: 17,   lon: 59,    type: "mare",    size: 22 },
  { name: "Oceanus Procellarum",  lat: 19,   lon: -57,   type: "mare",    size: 40 },
  { name: "Mare Nubium",          lat: -21,  lon: -17,   type: "mare",    size: 24 },
  { name: "Mare Nectaris",        lat: -16,  lon: 35,    type: "mare",    size: 18 },
  { name: "Mare Fecunditatis",    lat: -7,   lon: 51,    type: "mare",    size: 20 },
  { name: "Mare Humorum",         lat: -24,  lon: -38,   type: "mare",    size: 15 },
  { name: "Mare Frigoris",        lat: 56,   lon: 1,     type: "mare",    size: 24 },
  { name: "Tycho",                lat: -43,  lon: -11,   type: "crater",  size: 8  },
  { name: "Copernicus",           lat: 9.6,  lon: -20,   type: "crater",  size: 9  },
  { name: "Kepler",               lat: 8.1,  lon: -38,   type: "crater",  size: 6  },
  { name: "Plato",                lat: 51.6, lon: -9.4,  type: "crater",  size: 8  },
  { name: "Aristarchus",          lat: 23.7, lon: -47.5, type: "crater",  size: 5  },
  { name: "Clavius",              lat: -58,  lon: -14,   type: "crater",  size: 11 },
  { name: "Grimaldi",             lat: -5,   lon: -68,   type: "crater",  size: 9  },
  { name: "Langrenus",            lat: -8.9, lon: 61,    type: "crater",  size: 7  },
  { name: "Montes Apenninus",     lat: 19,   lon: -3,    type: "range",   size: 12 },
  { name: "Apollo 11 site",       lat: 0.67, lon: 23.47, type: "landing", size: 3  },
];

// Seeded pseudo-random for reproducible textures
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeMoonTexture(THREE) {
  const W = 4096, H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rng = seededRng(42);

  // ── Base highlands — mid-gray like the real Moon ──
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0,   "#d4cfc4");
  base.addColorStop(0.3, "#e8e2d5");
  base.addColorStop(0.6, "#ddd7c8");
  base.addColorStop(1,   "#c8c2b4");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // ── Multi-octave surface noise ──
  function addNoise(scale, amount, alpha) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (rng() > alpha) continue;
        const n = (rng() - 0.5) * amount;
        const idx = (y * W + x) * 4;
        d[idx]   = Math.max(0, Math.min(255, d[idx]   + n));
        d[idx+1] = Math.max(0, Math.min(255, d[idx+1] + n));
        d[idx+2] = Math.max(0, Math.min(255, d[idx+2] + n * 0.85));
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  addNoise(1, 30, 0.8);  // coarse variation
  addNoise(1, 14, 0.5);  // fine grain

  // ── Helper: lat/lon → canvas px ──
  function ll(lat, lon) {
    return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  }

  // ── Mare (dark basaltic plains) ──
  FEATURES.filter(f => f.type === "mare").forEach(f => {
    const [u, v] = ll(f.lat, f.lon);
    const rx = (f.size / 360) * W * 1.15;
    const ry = (f.size / 180) * H * 0.9;
    const rMax = Math.max(rx, ry);
    const g = ctx.createRadialGradient(u, v, 0, u, v, rMax);
    g.addColorStop(0,    "rgba(45, 42, 35, 0.97)");
    g.addColorStop(0.45, "rgba(58, 53, 44, 0.82)");
    g.addColorStop(0.75, "rgba(70, 64, 54, 0.50)");
    g.addColorStop(1,    "rgba(70, 64, 54, 0.00)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(u, v, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Inner texture variation
    for (let i = 0; i < 6; i++) {
      const ox = (rng() - 0.5) * rx * 0.6;
      const oy = (rng() - 0.5) * ry * 0.6;
      const g2 = ctx.createRadialGradient(u+ox, v+oy, 0, u+ox, v+oy, rMax * 0.35);
      const dk = (rng() * 12).toFixed(0);
      g2.addColorStop(0, `rgba(${35+dk},${32+dk},${26+dk}, 0.30)`);
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(u+ox, v+oy, rx*0.5, ry*0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // ── Named craters ──
  FEATURES.filter(f => f.type === "crater").forEach(f => {
    const [u, v] = ll(f.lat, f.lon);
    const r = (f.size / 180) * H * 0.85;
    // Dark bowl
    const g1 = ctx.createRadialGradient(u, v, 0, u, v, r);
    g1.addColorStop(0,    "rgba(55, 50, 42, 0.70)");
    g1.addColorStop(0.55, "rgba(80, 74, 63, 0.35)");
    g1.addColorStop(1,    "rgba(80, 74, 63, 0.00)");
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    // Bright rim
    const g2 = ctx.createRadialGradient(u, v, r * 0.7, u, v, r * 1.25);
    g2.addColorStop(0,    "rgba(230, 222, 205, 0.00)");
    g2.addColorStop(0.4,  "rgba(240, 232, 215, 0.85)");
    g2.addColorStop(0.75, "rgba(220, 212, 195, 0.40)");
    g2.addColorStop(1,    "rgba(200, 195, 180, 0.00)");
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(u, v, r * 1.25, 0, Math.PI * 2); ctx.fill();
    // Central peak for larger craters
    if (f.size >= 8) {
      ctx.fillStyle = "rgba(210, 202, 185, 0.55)";
      ctx.beginPath(); ctx.arc(u, v, r * 0.10, 0, Math.PI * 2); ctx.fill();
    }
    // Ray systems for young craters
    if (f.name === "Tycho" || f.name === "Copernicus" || f.name === "Aristarchus") {
      const nRays = f.name === "Tycho" ? 18 : 12;
      for (let i = 0; i < nRays; i++) {
        const a = rng() * Math.PI * 2;
        const len = r * (4 + rng() * 5);
        const w   = r * (0.3 + rng() * 0.3);
        const grad = ctx.createLinearGradient(u, v, u + Math.cos(a)*len, v + Math.sin(a)*len);
        grad.addColorStop(0,   "rgba(255,252,240,0.30)");
        grad.addColorStop(0.5, "rgba(255,252,240,0.15)");
        grad.addColorStop(1,   "rgba(255,252,240,0.00)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(u, v);
        ctx.lineTo(u + Math.cos(a)*len, v + Math.sin(a)*len);
        ctx.stroke();
      }
    }
  });

  // ── Mountain ranges ──
  FEATURES.filter(f => f.type === "range").forEach(f => {
    const [u, v] = ll(f.lat, f.lon);
    const hw = (f.size / 360) * W * 0.7;
    const hh = (f.size / 180) * H * 0.12;
    const g = ctx.createRadialGradient(u, v, 0, u, v, hw);
    g.addColorStop(0,   "rgba(210,202,185,0.70)");
    g.addColorStop(0.5, "rgba(195,188,172,0.35)");
    g.addColorStop(1,   "rgba(180,174,160,0.00)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(u, v, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ── Scattered small craters (400 for high-res detail) ──
  for (let i = 0; i < 400; i++) {
    const u = rng() * W;
    const v = rng() * H * 0.96 + H * 0.02;
    const r = 1.5 + rng() * 6;
    const a = 0.08 + rng() * 0.28;
    // Dark interior
    ctx.fillStyle = `rgba(60,55,46,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    // Bright rim
    ctx.fillStyle = `rgba(225,216,198,${(a * 0.55).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(u - r*0.3, v - r*0.3, r * 0.75, 0, Math.PI * 2); ctx.fill();
  }

  // ── Apollo 11 landing marker ──
  {
    const f = FEATURES.find(f => f.name === "Apollo 11 site");
    if (f) {
      const [u, v] = ll(f.lat, f.lon);
      ctx.fillStyle = "rgba(255,200,100,0.90)";
      ctx.beginPath(); ctx.arc(u, v, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.beginPath(); ctx.arc(u, v, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Real moon texture — served from GitHub raw (CORS allowed on GitHub Pages)
const REAL_MOON_URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg";

function MoonView({ phase, onSelectFeature, activeFeature, filterType = "all" }) {
  const hostRef = useRef(null);
  const stateRef = useRef({});
  const [ready, setReady] = useState(!!window.THREE);
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    if (window.THREE) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/three@0.160.0/build/three.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const THREE = window.THREE;
    const host = hostRef.current;
    const size = Math.min(host.clientWidth, host.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(size, size);
    host.appendChild(renderer.domElement);

    // Use procedural texture immediately, upgrade to real photo if it loads
    const proceduralTex = makeMoonTexture(THREE);
    const mat = new THREE.MeshStandardMaterial({
      map: proceduralTex,
      roughness: 0.90,
      metalness: 0.0,
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 128, 128), mat);
    scene.add(moon);

    // Try loading the real NASA photo texture
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(REAL_MOON_URL, (realTex) => {
      realTex.anisotropy = 8;
      mat.map = realTex;
      mat.needsUpdate = true;
      proceduralTex.dispose();
    }, undefined, () => {
      // Fallback already set — keep procedural
    });

    // Strong directional sun light for the phase
    const sun = new THREE.DirectionalLight(0xfff8f0, 2.8);
    scene.add(sun);
    // Earthshine — faint blue-white ambient so the dark side isn't pure black
    scene.add(new THREE.AmbientLight(0x3a5577, 0.55));

    const rot = { y: 0, x: 0 };
    let dragging = false, lx = 0, ly = 0;
    const onDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = e => {
      if (!dragging) return;
      rot.y += (e.clientX - lx) * 0.008;
      rot.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, rot.x + (e.clientY - ly) * 0.008));
      lx = e.clientX; ly = e.clientY;
    };
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

    const ro = new ResizeObserver(() => {
      const s = Math.min(host.clientWidth, host.clientHeight);
      renderer.setSize(s, s);
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    stateRef.current = { THREE, scene, camera, renderer, moon, sun, rot, host, mat, onDown, onUp, onMove, ro };

    let raf;
    const tick = () => {
      const { phase: ph, filterType: ft } = stateRef.current;
      moon.rotation.y = rot.y - Math.PI / 2;  // -90° offset aligns lon=0 to face camera
      moon.rotation.x = rot.x;
      // Sun angle from lunar phase
      // pa = elongation angle (0=new, π=full, 2π=new again).
      // Sun direction from Moon: (sin(ε), 0, −cos(ε))
      //   ε=0  → (0,0,−1) behind Moon → dark visible face ✓ (new moon)
      //   ε=π  → (0,0,+1) in front    → lit visible face  ✓ (full moon)
      //   ε=π/2 → (1,0, 0) to right   → right half lit    ✓ (first quarter)
      const pa = (ph ?? 0.5) * Math.PI * 2;
      sun.position.set(Math.sin(pa) * 8, 0, -Math.cos(pa) * 8);

      // Project feature labels — filtered by filterType
      const activeFilter = ft ?? "all";
      const visibleFeatures = activeFilter === "all"
        ? FEATURES
        : FEATURES.filter(f => f.type === activeFilter);

      const rect = renderer.domElement.getBoundingClientRect();
      const proj = visibleFeatures.map(f => {
        const latR = f.lat * Math.PI / 180;
        const lonR = f.lon * Math.PI / 180;
        // 3D unit normal matching Three.js SphereGeometry UV → lon=0 at (1,0,0),
        // same -PI/2 offset used by the mesh brings lon=0 to face the camera.
        const v = new THREE.Vector3(
          Math.cos(latR) * Math.cos(lonR),
          Math.sin(latR),
         -Math.cos(latR) * Math.sin(lonR)
        );
        v.applyEuler(new THREE.Euler(rot.x, rot.y - Math.PI / 2, 0, "XYZ"));
        const pos3 = v.clone().multiplyScalar(1.52);
        const p = pos3.clone().project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width;
        const sy = (-p.y * 0.5 + 0.5) * rect.height;
        return { name: f.name, sx, sy, visible: v.z > 0.05, type: f.type };
      });
      setLabels(proj);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      host.removeChild(renderer.domElement);
      renderer.dispose();
      mat.map?.dispose();
    };
  }, [ready]);

  useEffect(() => {
    if (stateRef.current) stateRef.current.phase = phase;
  }, [phase]);

  useEffect(() => {
    if (stateRef.current) stateRef.current.filterType = filterType;
  }, [filterType]);

  // Rotate to active feature
  useEffect(() => {
    if (!activeFeature || !stateRef.current.rot) return;
    const f = FEATURES.find(f => f.name === activeFeature);
    if (!f) return;
    const { rot } = stateRef.current;
    rot.y = -(f.lon * Math.PI / 180);
    rot.x = f.lat * Math.PI / 180;
  }, [activeFeature]);

  return (
    <div ref={hostRef} style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
      {!ready && <span className="loader" />}
      {labels.filter(l => l.visible).map(l => (
        <div
          key={l.name}
          className="moon-overlay-label"
          style={{
            left: l.sx,
            top: l.sy,
            color: l.name === activeFeature ? "var(--ember)" : "var(--cyan)",
            opacity: l.name === activeFeature ? 1 : (l.type === "landing" ? 1 : 0.82),
            fontWeight: l.name === activeFeature ? 500 : 400,
          }}
        >
          {l.name}
        </div>
      ))}
    </div>
  );
}

window.MoonView = MoonView;
window.MOON_FEATURES = FEATURES;
