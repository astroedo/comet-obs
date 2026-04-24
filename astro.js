// Astronomical utilities: planet positions (VSOP87-lite), Kepler, moon phase, sun alt, etc.
// Good enough for a UI prototype. Values are in AU / degrees / days where noted.

(function () {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  // ---------- Julian date helpers ----------
  function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }
  // Centuries since J2000
  function T2000(jd) { return (jd - 2451545.0) / 36525; }
  // Days since J2000
  function D2000(jd) { return jd - 2451545.0; }

  // ---------- Kepler ----------
  function solveKepler(M, e, tol = 1e-8) {
    M = ((M + Math.PI) % (2 * Math.PI)) - Math.PI;
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 50; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < tol) break;
    }
    return E;
  }

  // ---------- Planet orbital elements (mean) ----------
  // Source: simplified J2000 + linear per-century rates (Standish-ish).
  // a (AU), e, i (deg), L (deg mean longitude), lp (deg longitude of perihelion), node (deg)
  const PLANETS = {
    mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, lp: 77.45779628, node: 48.33076593,
      rates: { a: 0.00000037, e: 0.00001906, i: -0.00594749, L: 149472.67411175, lp: 0.16047689, node: -0.12534081 },
      color: "#b9b0a4", size: 0.38, moons: [] },
    venus:   { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, lp: 131.60246718, node: 76.67984255,
      rates: { a: 0.00000390, e: -0.00004107, i: -0.00078890, L: 58517.81538729, lp: 0.00268329, node: -0.27769418 },
      color: "#e8d7a8", size: 0.95, moons: [] },
    earth:   { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, lp: 102.93768193, node: 0,
      rates: { a: 0.00000562, e: -0.00004392, i: -0.01294668, L: 35999.37244981, lp: 0.32327364, node: 0 },
      color: "#6fb1ff", size: 1.0,
      moons: [{ name: "Moon", color: "#d9d4c5" }] },
    mars:    { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, lp: -23.94362959, node: 49.55953891,
      rates: { a: 0.00001847, e: 0.00007882, i: -0.00813131, L: 19140.30268499, lp: 0.44441088, node: -0.29257343 },
      color: "#d46a4e", size: 0.53,
      moons: [{ name: "Phobos", color: "#8a7d70" }, { name: "Deimos", color: "#a8998a" }] },
    jupiter: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, lp: 14.72847983, node: 100.47390909,
      rates: { a: -0.00011607, e: -0.00013253, i: -0.00183714, L: 3034.74612775, lp: 0.21252668, node: 0.20469106 },
      color: "#d3a87a", size: 2.2,
      moons: [{ name: "Io", color: "#e8c66b" }, { name: "Europa", color: "#e0d7b8" },
              { name: "Ganymede", color: "#a89276" }, { name: "Callisto", color: "#6b5e4c" }] },
    saturn:  { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, lp: 92.59887831, node: 113.66242448,
      rates: { a: -0.00125060, e: -0.00050991, i: 0.00193609, L: 1222.49362201, lp: -0.41897216, node: -0.28867794 },
      color: "#e3c07a", size: 1.9,
      moons: [{ name: "Titan", color: "#c4a05a" }] },
    uranus:  { a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, lp: 170.95427630, node: 74.01692503,
      rates: { a: -0.00196176, e: -0.00004397, i: -0.00242939, L: 428.48202785, lp: 0.40805281, node: 0.04240589 },
      color: "#a6d7df", size: 1.4, moons: [] },
    neptune: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, lp: 44.96476227, node: 131.78422574,
      rates: { a: 0.00026291, e: 0.00005105, i: 0.00035372, L: 218.45945325, lp: -0.32241464, node: -0.00508664 },
      color: "#6a8bd1", size: 1.35, moons: [] },
  };

  // ---------- Position of a body given elements at a JD ----------
  function elementsAt(pl, jd) {
    const T = T2000(jd);
    return {
      a: pl.a + pl.rates.a * T,
      e: pl.e + pl.rates.e * T,
      i: (pl.i + pl.rates.i * T) * RAD,
      L: ((pl.L + pl.rates.L * T) % 360) * RAD,
      lp: ((pl.lp + pl.rates.lp * T) % 360) * RAD,
      node: ((pl.node + pl.rates.node * T) % 360) * RAD,
    };
  }

  // Returns heliocentric ecliptic position {x,y,z} in AU
  function heliocentric(pl, jd) {
    const el = elementsAt(pl, jd);
    const { a, e, i, L, lp, node } = el;
    const w = lp - node;             // argument of perihelion
    const M = L - lp;                // mean anomaly
    const E = solveKepler(M, e);
    // true anomaly
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    // ecliptic heliocentric
    const cosN = Math.cos(node), sinN = Math.sin(node);
    const cosW = Math.cos(v + w), sinW = Math.sin(v + w);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const x = r * (cosN * cosW - sinN * sinW * cosI);
    const y = r * (sinN * cosW + cosN * sinW * cosI);
    const z = r * (sinW * sinI);
    return { x, y, z, r };
  }

  // Orbit path as array of {x,y,z}, sampled around the full ellipse
  function orbitPath(pl, jd, steps = 180) {
    const el = elementsAt(pl, jd);
    const { a, e, i, lp, node } = el;
    const w = lp - node;
    const pts = [];
    const cosN = Math.cos(node), sinN = Math.sin(node);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    for (let k = 0; k <= steps; k++) {
      const E = (k / steps) * 2 * Math.PI;
      const xv = a * (Math.cos(E) - e);
      const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const vv = Math.atan2(yv, xv);
      const r = Math.sqrt(xv * xv + yv * yv);
      const cosW = Math.cos(vv + w), sinW = Math.sin(vv + w);
      pts.push({
        x: r * (cosN * cosW - sinN * sinW * cosI),
        y: r * (sinN * cosW + cosN * sinW * cosI),
        z: r * (sinW * sinI),
      });
    }
    return pts;
  }

  // Heliocentric position of a comet given its elements {a|q, e, i, node, peri, M0 or tp, epoch}
  function cometHeliocentric(c, jd) {
    const a = c.a ?? (c.q / (1 - c.e));
    const e = c.e;
    const i = c.i * RAD;
    const node = c.node * RAD;
    const w = c.peri * RAD;
    // mean motion in rad/day
    const n = Math.sqrt(1 / Math.max(a, 1e-6) ** 3) * 0.01720209895; // gaussian
    let M;
    if (c.tp != null) {
      M = n * (jd - c.tp);
    } else {
      M = (c.M0 || 0) * RAD + n * (jd - (c.epoch || jd));
    }
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
    const vv = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const cosN = Math.cos(node), sinN = Math.sin(node);
    const cosW = Math.cos(vv + w), sinW = Math.sin(vv + w);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    return {
      x: r * (cosN * cosW - sinN * sinW * cosI),
      y: r * (sinN * cosW + cosN * sinW * cosI),
      z: r * (sinW * sinI),
      r,
    };
  }

  function cometOrbitPath(c, jd, steps = 200) {
    // For highly eccentric / parabolic orbits, sample across an arc of true anomaly
    const e = c.e, a = c.a ?? (c.q / (1 - c.e));
    const i = c.i * RAD, node = c.node * RAD, w = c.peri * RAD;
    const pts = [];
    const cosN = Math.cos(node), sinN = Math.sin(node);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    if (e < 0.98 && a > 0) {
      for (let k = 0; k <= steps; k++) {
        const E = (k / steps) * 2 * Math.PI;
        const xv = a * (Math.cos(E) - e);
        const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
        const vv = Math.atan2(yv, xv);
        const r = Math.sqrt(xv * xv + yv * yv);
        const cosW = Math.cos(vv + w), sinW = Math.sin(vv + w);
        pts.push({
          x: r * (cosN * cosW - sinN * sinW * cosI),
          y: r * (sinN * cosW + cosN * sinW * cosI),
          z: r * (sinW * sinI),
        });
      }
    } else {
      // near-parabolic: sample by true anomaly
      const q = c.q ?? a * (1 - e);
      const vmax = 130 * RAD;
      for (let k = 0; k <= steps; k++) {
        const v = -vmax + (k / steps) * 2 * vmax;
        const r = q * (1 + e) / (1 + e * Math.cos(v));
        const cosW = Math.cos(v + w), sinW = Math.sin(v + w);
        pts.push({
          x: r * (cosN * cosW - sinN * sinW * cosI),
          y: r * (sinN * cosW + cosN * sinW * cosI),
          z: r * (sinW * sinI),
        });
      }
    }
    return pts;
  }

  // ---------- Sun, moon, phase ----------
  function sunPosition(jd) {
    // Low-precision formula — returns apparent RA/Dec and ecliptic longitude
    const n = D2000(jd);
    const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
    const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * RAD;
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const eps = (23.439 - 0.0000004 * n) * RAD;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    return { ra, dec, lambda };
  }

  function moonPosition(jd) {
    // Low-precision (Meeus simplified)
    const T = T2000(jd);
    const L = (218.316 + 13.176396 * D2000(jd)) * RAD;
    const M = (134.963 + 13.064993 * D2000(jd)) * RAD;
    const F = (93.272 + 13.229350 * D2000(jd)) * RAD;
    const lambda = L + 6.289 * RAD * Math.sin(M);
    const beta = 5.128 * RAD * Math.sin(F);
    const dist = 385001 - 20905 * Math.cos(M);
    const eps = 23.439 * RAD;
    const ra = Math.atan2(
      Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
      Math.cos(lambda)
    );
    const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda));
    return { ra, dec, lambda, beta, dist };
  }

  // Returns phase [0..1] and illumination fraction
  function moonPhase(jd) {
    const s = sunPosition(jd);
    const m = moonPosition(jd);
    // phase angle
    const cosPsi = Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra);
    const psi = Math.acos(Math.min(1, Math.max(-1, cosPsi)));
    const illum = (1 - Math.cos(psi)) / 2;
    // elongation sign to disambiguate waxing vs waning
    const age = ((m.lambda - s.lambda) * DEG + 360) % 360; // 0..360
    const phase = age / 360;
    let name = "";
    if (age < 22.5) name = "New Moon";
    else if (age < 67.5) name = "Waxing Crescent";
    else if (age < 112.5) name = "First Quarter";
    else if (age < 157.5) name = "Waxing Gibbous";
    else if (age < 202.5) name = "Full Moon";
    else if (age < 247.5) name = "Waning Gibbous";
    else if (age < 292.5) name = "Last Quarter";
    else if (age < 337.5) name = "Waning Crescent";
    else name = "New Moon";
    return { phase, illum, age, name, waxing: age < 180 };
  }

  // ---------- RA/Dec → Alt/Az ----------
  // lst: local sidereal time in radians; lat: radians
  function localSiderealTime(jd, lonDeg) {
    const T = T2000(jd);
    let gmst = 280.46061837 + 360.98564736629 * D2000(jd) + T * T * (0.000387933 - T / 38710000);
    gmst = ((gmst % 360) + 360) % 360;
    return ((gmst + lonDeg) % 360) * RAD;
  }
  function raDecToAltAz(ra, dec, lst, latRad) {
    const H = lst - ra;
    const sinAlt = Math.sin(dec) * Math.sin(latRad) + Math.cos(dec) * Math.cos(latRad) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosA = (Math.sin(dec) - Math.sin(alt) * Math.sin(latRad)) / (Math.cos(alt) * Math.cos(latRad));
    let az = Math.acos(Math.max(-1, Math.min(1, cosA)));
    if (Math.sin(H) > 0) az = 2 * Math.PI - az;
    return { alt, az };
  }

  // Geocentric equatorial of a planet: helio planet - helio earth, then rotate by obliquity
  function planetRaDec(pl, jd) {
    const earth = heliocentric(PLANETS.earth, jd);
    const p = heliocentric(pl, jd);
    const x = p.x - earth.x, y = p.y - earth.y, z = p.z - earth.z;
    const eps = 23.4392911 * RAD;
    // rotate ecliptic to equatorial
    const xe = x;
    const ye = y * Math.cos(eps) - z * Math.sin(eps);
    const ze = y * Math.sin(eps) + z * Math.cos(eps);
    const r = Math.sqrt(xe * xe + ye * ye + ze * ze);
    const ra = Math.atan2(ye, xe);
    const dec = Math.asin(ze / r);
    return { ra, dec, dist: r };
  }

  // Sun rise/set and twilight times (very simple)
  function sunriseSunset(jd, latDeg, lonDeg) {
    // Not a full implementation — just returns approximate hour angles for alt = -0.833°
    // used only for display hints.
    const s = sunPosition(jd);
    const lat = latDeg * RAD;
    const h0 = -0.833 * RAD;
    const cosH = (Math.sin(h0) - Math.sin(lat) * Math.sin(s.dec)) / (Math.cos(lat) * Math.cos(s.dec));
    if (cosH > 1) return { always: "night" };
    if (cosH < -1) return { always: "day" };
    const H = Math.acos(cosH) * DEG; // degrees
    return { hourAngleDeg: H };
  }

  window.Astro = {
    RAD, DEG, julianDate, T2000, D2000,
    PLANETS, solveKepler,
    heliocentric, orbitPath, elementsAt,
    cometHeliocentric, cometOrbitPath,
    sunPosition, moonPosition, moonPhase,
    localSiderealTime, raDecToAltAz, planetRaDec,
    sunriseSunset,
  };
})();
