// 3D solar system map using Three.js. Exposes <SolarMap comets selected options/>.

const SOLAR_THREE_SRC = "https://unpkg.com/three@0.160.0/build/three.min.js";

function useThree() {
  const [ready, setReady] = React.useState(!!window.THREE);
  React.useEffect(() => {
    if (window.THREE) return;
    const s = document.createElement("script");
    s.src = SOLAR_THREE_SRC;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

// Map AU → scene units (fixed scale, zoom via camera distance only)
function auToScene(au) {
  return au * 2.8;
}

function SolarMap({ comets = [], selectedCometIds = [], options = {}, onPlanetHover }) {
  const ready = useThree();
  const hostRef = React.useRef(null);
  const stateRef = React.useRef({});
  const { useState, useEffect, useRef } = React;

  const {
    showLabels = true,
    showOrbits = true,
    timeOffsetDays = 0,
  } = options;

  const [hovered, setHovered] = useState(null);
  // "visible" = sprite-based (always visible fixed pixel dots)
  // "real"    = mesh-based spheres (proportional sizes, shrink when zoomed out)
  const [planetMode, setPlanetMode] = useState("visible");

  // Init scene once
  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const THREE = window.THREE;
    const host = hostRef.current;
    const rect = () => host.getBoundingClientRect();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, rect().width / rect().height, 0.01, 20000);
    camera.position.set(0, 40, 90);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(rect().width, rect().height);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sunLight = new THREE.PointLight(0xffddaa, 2.0, 0, 0);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Sun — radius 0.35 so Mercury (1.08 scene-units) orbits outside it
    const sunGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd089 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(THREE),
      color: 0xffb566,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sunGlow.scale.set(5, 5, 1);
    scene.add(sunGlow);

    // Galaxy background sphere
    const stars = makeGalaxyBackground(THREE);
    scene.add(stars);

    // Groups
    const orbitsGroup = new THREE.Group();
    const planetsGroup = new THREE.Group();
    const cometsGroup = new THREE.Group();
    const labelsGroup = new THREE.Group();
    scene.add(orbitsGroup, planetsGroup, cometsGroup, labelsGroup);

    // Camera orbit control
    const control = {
      target: new THREE.Vector3(0, 0, 0),
      az: Math.PI * 0.3,
      el: 0.5,
      dist: 90,
      minDist: 2,
      maxDist: 600,
    };
    function updateCamera() {
      const x = control.dist * Math.cos(control.el) * Math.sin(control.az);
      const y = control.dist * Math.sin(control.el);
      const z = control.dist * Math.cos(control.el) * Math.cos(control.az);
      camera.position.set(x, y, z);
      camera.lookAt(control.target);
    }
    updateCamera();

    // Drag
    let dragging = false, lx = 0, ly = 0;
    const onDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = e => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      control.az -= dx * 0.005;
      control.el = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, control.el + dy * 0.005));
      updateCamera();
    };
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    // Scroll to zoom
    const onWheel = e => {
      e.preventDefault();
      control.dist = Math.max(control.minDist, Math.min(control.maxDist, control.dist * (1 + e.deltaY * 0.001)));
      updateCamera();
    };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    stateRef.current = {
      THREE, scene, camera, renderer, sun, sunGlow, stars,
      orbitsGroup, planetsGroup, cometsGroup, labelsGroup,
      control, updateCamera, host,
      planetObjs: {}, cometObjs: new Map(),
      onDown, onUp, onMove, onWheel,
    };

    // Resize
    const ro = new ResizeObserver(() => {
      const r = rect();
      renderer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    // Animate
    let raf;
    const tick = () => {
      sunGlow.material.opacity = 0.8 + 0.1 * Math.sin(performance.now() * 0.002);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      host.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [ready]);

  // Build planets + orbits
  useEffect(() => {
    if (!ready || !stateRef.current.scene) return;
    const { THREE, orbitsGroup, planetsGroup, labelsGroup } = stateRef.current;
    dispose(orbitsGroup); dispose(planetsGroup); dispose(labelsGroup);
    stateRef.current.planetObjs = {};

    const jd = window.Astro.julianDate(new Date(Date.now() + timeOffsetDays * 86400000));

    Object.entries(window.Astro.PLANETS).forEach(([key, pl]) => {
      // Orbit path
      if (showOrbits) {
        const pts = window.Astro.orbitPath(pl, jd, 200);
        const positions = new Float32Array(pts.length * 3);
        pts.forEach((p, i) => {
          positions[i*3]   = auToScene(p.x);
          positions[i*3+1] = auToScene(p.z);
          positions[i*3+2] = auToScene(p.y);
        });
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(pl.color),
          transparent: true,
          opacity: 0.35,
        });
        orbitsGroup.add(new THREE.Line(geom, mat));
      }

      // Planet position
      const pos = window.Astro.heliocentric(pl, jd);
      const sx = auToScene(pos.x);
      const sy = auToScene(pos.z);
      const sz = auToScene(pos.y);

      let mesh;
      if (planetMode === "visible") {
        // Sprite with sizeAttenuation: false → always visible fixed-pixel dot
        const pixSize = Math.round(4 + 14 * pl.size / 2.2); // 6–18px range
        const sprite = makePlanetSprite(THREE, pl.color, pixSize);
        sprite.position.set(sx, sy, sz);
        sprite.userData = { key, name: cap(key), type: "planet" };
        planetsGroup.add(sprite);
        mesh = sprite;
      } else {
        // Mesh spheres — proportional real-ish sizes (small but correct relative scale)
        const size = 0.04 + 0.07 * pl.size;
        const pgeo = new THREE.SphereGeometry(size, 24, 24);
        const pmat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(pl.color),
          emissive: new THREE.Color(pl.color).multiplyScalar(0.2),
          roughness: 0.6, metalness: 0.1,
        });
        mesh = new THREE.Mesh(pgeo, pmat);
        mesh.position.set(sx, sy, sz);
        mesh.userData = { key, name: cap(key), type: "planet" };
        planetsGroup.add(mesh);
      }
      stateRef.current.planetObjs[key] = mesh;

      // Saturn ring (only in real mode — too large to look good on sprites)
      if (key === "saturn" && planetMode === "real") {
        const size = 0.04 + 0.07 * pl.size;
        const ringGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe8d49a, side: THREE.DoubleSide, transparent: true, opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        mesh.add(ring);
      }

      // Saturn ring for visible mode — attached to sprite position via separate mesh
      if (key === "saturn" && planetMode === "visible") {
        const ringGeo = new THREE.RingGeometry(0.4, 0.65, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe8d49a, side: THREE.DoubleSide, transparent: true, opacity: 0.45,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        ring.position.set(sx, sy, sz);
        planetsGroup.add(ring);
      }

      // Label
      if (showLabels) {
        const label = makeLabelSprite(THREE, cap(key).toUpperCase(), pl.color);
        const offset = planetMode === "visible" ? 0.8 : (0.15 + 0.06 * pl.size + 0.4);
        label.position.set(sx, sy + offset, sz);
        labelsGroup.add(label);
      }
    });
  }, [ready, showLabels, showOrbits, planetMode, timeOffsetDays]);

  // Update comets
  useEffect(() => {
    if (!ready || !stateRef.current.scene) return;
    const { THREE, cometsGroup, labelsGroup } = stateRef.current;
    dispose(cometsGroup);
    const keep = [];
    labelsGroup.children.forEach(c => {
      if (c.userData.kind === "comet-label") c.material.dispose?.();
      else keep.push(c);
    });
    labelsGroup.children = keep;

    const jd = window.Astro.julianDate(new Date(Date.now() + timeOffsetDays * 86400000));
    const selected = new Set(selectedCometIds);

    comets.forEach(c => {
      if (!selected.has(c.designation)) return;
      const pts = window.Astro.cometOrbitPath(c, jd, 240);
      const positions = [];
      for (const p of pts) {
        positions.push(auToScene(p.x), auToScene(p.z), auToScene(p.y));
      }
      const ogeo = new THREE.BufferGeometry();
      ogeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      cometsGroup.add(new THREE.Line(ogeo, new THREE.LineBasicMaterial({ color: 0xff8c5a, transparent: true, opacity: 0.7 })));

      const pos = window.Astro.cometHeliocentric(c, jd);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffe0b0 })
      );
      head.position.set(auToScene(pos.x), auToScene(pos.z), auToScene(pos.y));
      cometsGroup.add(head);

      const g = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(THREE),
        color: 0xff9055,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      g.scale.set(1.6, 1.6, 1);
      g.position.copy(head.position);
      cometsGroup.add(g);

      const dir = head.position.clone().normalize();
      const tailEnd = head.position.clone().add(dir.multiplyScalar(2.5));
      const tgeo = new THREE.BufferGeometry().setFromPoints([head.position, tailEnd]);
      cometsGroup.add(new THREE.Line(tgeo, new THREE.LineBasicMaterial({ color: 0xffb07a, transparent: true, opacity: 0.8 })));

      if (showLabels) {
        const lbl = makeLabelSprite(THREE, c.designation, "#ffb07a");
        lbl.userData.kind = "comet-label";
        lbl.position.copy(head.position).add(new THREE.Vector3(0, 0.45, 0));
        labelsGroup.add(lbl);
      }
    });
  }, [ready, comets, selectedCometIds, planetMode, showLabels, timeOffsetDays]);

  const { onTimeOffsetChange, onToggleLabels, onToggleOrbits } = options;

  // Zoom buttons control camera distance
  const zoom = (factor) => {
    const s = stateRef.current;
    if (!s.control) return;
    s.control.dist = Math.max(s.control.minDist, Math.min(s.control.maxDist, s.control.dist * factor));
    s.updateCamera();
  };
  const resetView = () => {
    const s = stateRef.current;
    if (!s.control) return;
    s.control.az = Math.PI * 0.3;
    s.control.el = 0.5;
    s.control.dist = 90;
    s.updateCamera();
  };

  const daysLabel = timeOffsetDays === 0 ? "now"
    : (timeOffsetDays > 0 ? "+" : "") + timeOffsetDays + " d";

  return (
    <div className="solar-host" ref={hostRef}>
      {!ready && (
        <div className="solar-loading">
          <span className="loader" />
          <span className="mono dim" style={{ marginLeft: 12, letterSpacing: "0.1em" }}>INITIALIZING EPHEMERIS…</span>
        </div>
      )}
      <div className="solar-controls">
        <button onClick={() => zoom(0.75)} aria-label="Zoom in" title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="6" /><path d="M20 20 L15.5 15.5" /><path d="M11 8 V14 M8 11 H14" />
          </svg>
        </button>
        <button onClick={() => zoom(1.33)} aria-label="Zoom out" title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="6" /><path d="M20 20 L15.5 15.5" /><path d="M8 11 H14" />
          </svg>
        </button>
        <button onClick={resetView} aria-label="Reset view" title="Reset view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3 V8 H8" />
          </svg>
        </button>
        <div className="solar-controls__sep" />
        <button onClick={() => onToggleOrbits?.(!showOrbits)} title={showOrbits ? "Hide orbits" : "Show orbits"}
          className={showOrbits ? "is-on" : ""}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <ellipse cx="12" cy="12" rx="9" ry="4" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button onClick={() => onToggleLabels?.(!showLabels)} title={showLabels ? "Hide labels" : "Show labels"}
          className={showLabels ? "is-on" : ""}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 7h16M4 12h10M4 17h14" />
          </svg>
        </button>
        <div className="solar-controls__sep" />
        {/* Planet size mode toggle */}
        <button
          onClick={() => setPlanetMode(m => m === "visible" ? "real" : "visible")}
          title={planetMode === "visible" ? "Switch to real proportional sizes" : "Switch to always-visible dots"}
          className={planetMode === "real" ? "is-on" : ""}
          style={{ fontSize: 8, letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}
        >
          {planetMode === "visible" ? "VIS" : "REAL"}
        </button>
      </div>
      <div className="solar-legend mono">
        <span style={{ color: "var(--ember)" }}>● comet</span>
        <span style={{ color: "var(--ink-dim)", marginLeft: 16 }}>DRAG rotate · WHEEL zoom</span>
      </div>
      <div className="solar-timebar">
        <div className="solar-timebar__head">
          <span className="solar-timebar__label">TIME OFFSET</span>
          <span className="solar-timebar__value">{daysLabel}</span>
          <button className="solar-timebar__now" onClick={() => onTimeOffsetChange?.(0)}>NOW</button>
        </div>
        <input type="range" min="-730" max="730" step="1" value={timeOffsetDays}
          onChange={e => onTimeOffsetChange?.(Number(e.target.value))} />
        <div className="solar-timebar__ticks mono">
          <span>−2y</span><span>−1y</span><span>now</span><span>+1y</span><span>+2y</span>
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function dispose(group) {
  while (group.children.length) {
    const c = group.children.pop();
    c.geometry?.dispose?.();
    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
    else c.material?.dispose?.();
  }
}

// Planet sprite: colored glow dot with sizeAttenuation:false (always visible)
function makePlanetSprite(THREE, color, pixelSize = 10) {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext("2d");
  const c = new THREE.Color(color);
  const hex = "#" + c.getHexString();
  // Outer glow
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2 - 2);
  g.addColorStop(0, hex + "ff");
  g.addColorStop(0.35, hex + "cc");
  g.addColorStop(0.7, hex + "44");
  g.addColorStop(1, hex + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // Bright core
  ctx.fillStyle = "#ffffffff";
  ctx.beginPath();
  ctx.arc(s/2, s/2, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    sizeAttenuation: false,  // fixed pixel size regardless of distance
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  // With sizeAttenuation:false, scale is in normalized screen units
  // Empirically: scale 0.01 ≈ ~7px on a typical 1200px wide canvas
  const sc = (pixelSize / 700);
  sprite.scale.set(sc, sc, 1);
  return sprite;
}

function makeGlowTexture(THREE) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,200,140,0.6)");
  g.addColorStop(0.55, "rgba(255,150,80,0.2)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makeGalaxyBackground(THREE) {
  // Real Milky Way photo texture on a BackSide sphere + crisp THREE.Points stars.
  // Primary:  2MASS All-Sky infrared survey (equirectangular, Wikimedia Commons)
  // Fallback: ESO Milky Way panorama (also equirectangular)
  // Both are served with CORS headers from Wikimedia CDN.
  const group = new THREE.Group();

  // ── 1. Background photo sphere ─────────────────────────────────────────
  const bgMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    color: 0x000008,          // deep-space blue-black until texture loads
  });
  const bgSphere = new THREE.Mesh(new THREE.SphereGeometry(899, 64, 32), bgMat);
  group.add(bgSphere);

  const GALAXY_URLS = [
    // 2MASS infrared all-sky survey — galactic centre prominent, equirectangular
    "https://upload.wikimedia.org/wikipedia/commons/0/08/2MASS_All_Sky_Image.jpg",
    // ESO optical Milky Way panorama — fallback
    "https://upload.wikimedia.org/wikipedia/commons/5/54/Milky_Way_2005.jpg",
  ];

  const loader = new THREE.TextureLoader();
  const tryLoad = (urls, idx) => {
    if (idx >= urls.length) return;
    loader.load(urls[idx], (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      // The 2MASS image has the galactic centre (RA~266°) at its horizontal
      // midpoint, matching Three.js equirectangular UV convention closely
      // enough for a background.  A small Y-rotation aligns it nicely.
      bgSphere.rotation.y = Math.PI;   // flip so galactic centre faces forward
      bgMat.map = tex;
      bgMat.color.set(0xffffff);       // full brightness once texture is ready
      bgMat.needsUpdate = true;
    }, undefined, () => tryLoad(urls, idx + 1));
  };
  tryLoad(GALAXY_URLS, 0);

  // ── 2. THREE.Points star cloud ─────────────────────────────────────────
  // Crisp 1-pixel dots layered over the photo to add bright foreground stars.
  // IAU galactic constants — used to bias band stars toward the galactic plane.
  const NGP_ra  = 192.859 * Math.PI / 180;
  const NGP_dec =  27.128 * Math.PI / 180;
  const lasc    = 122.932 * Math.PI / 180;

  let rngS = 0xdeadbeef;
  const rng = () => {
    rngS = (Math.imul(rngS ^ (rngS >>> 16), 0x45d9f3b) ^ 0x3d4e5f6a) >>> 0;
    return rngS / 0x100000000;
  };

  const BAND = 1200, ISO = 650, N = BAND + ISO;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const R = 850;
  let idx = 0;

  // Band stars — concentrated near galactic plane
  for (let i = 0; i < BAND; i++) {
    const l    = rng() * 2 * Math.PI;
    const bRaw = (rng() - 0.5) * 1.3;
    const b    = bRaw * Math.pow(rng(), 0.5); // bias toward plane
    const sinDec = Math.cos(b)*Math.cos(NGP_dec)*Math.sin(l-lasc) + Math.sin(b)*Math.sin(NGP_dec);
    const dec    = Math.asin(Math.max(-1, Math.min(1, sinDec)));
    const yg2    = Math.cos(b)*Math.sin(NGP_dec)*Math.sin(l-lasc) - Math.sin(b)*Math.cos(NGP_dec);
    const xg2    = Math.cos(b)*Math.cos(l-lasc);
    const ra     = Math.atan2(yg2, xg2) + NGP_ra;
    const cosD   = Math.cos(dec);
    pos[idx*3]   = R * cosD * Math.cos(ra);
    pos[idx*3+1] = R * Math.sin(dec);
    pos[idx*3+2] = R * cosD * Math.sin(ra);
    const bright = Math.pow(rng(), 2.0);
    const blue   = rng() < 0.38;
    const sh     = 0.30 + bright * 0.65;
    col[idx*3]   = blue ? sh*0.68 : sh;
    col[idx*3+1] = blue ? sh*0.80 : sh*0.93;
    col[idx*3+2] = sh;
    idx++;
  }

  // Isotropic background
  for (let i = 0; i < ISO; i++) {
    const u    = rng() * 2 - 1;
    const t    = rng() * Math.PI * 2;
    const cosA = Math.sqrt(1 - u*u);
    pos[idx*3]   = R * cosA * Math.cos(t);
    pos[idx*3+1] = R * u;
    pos[idx*3+2] = R * cosA * Math.sin(t);
    const bright = Math.pow(rng(), 2.8);
    const warm   = rng() < 0.12;
    const sh     = 0.18 + bright * 0.55;
    col[idx*3]   = warm ? sh*1.20 : sh*0.85;
    col[idx*3+1] = warm ? sh*0.88 : sh*0.92;
    col[idx*3+2] = warm ? sh*0.60 : sh;
    idx++;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color",    new THREE.BufferAttribute(col, 3));
  group.add(new THREE.Points(geom, new THREE.PointsMaterial({
    size: 1.3, vertexColors: true, sizeAttenuation: false,
    transparent: true, opacity: 0.90, depthWrite: false,
  })));

  return group;
}

function makeLabelSprite(THREE, text, color = "#aab4c8") {
  const canvas = document.createElement("canvas");
  const pad = 16;
  const fontSize = 36;
  const ctx0 = canvas.getContext("2d");
  ctx0.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
  const tw = ctx0.measureText(text).width;
  canvas.width = Math.ceil(tw + pad * 2);
  canvas.height = fontSize + pad;
  const ctx = canvas.getContext("2d");
  ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(canvas.width / 64, canvas.height / 64, 1);
  return sp;
}

window.SolarMap = SolarMap;
