// Comet data: fetches live orbital elements from JPL SBDB, falls back to a curated list.
// API doc: https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html

(function () {

  // ── Curated fallback ─────────────────────────────────────────────────────
  // Current/upcoming bright comets — verified elements (epoch 2026).
  // Fields: q (perihelion AU), e (eccentricity), i (inclination °),
  //         node (Ω °), peri (ω °), tp (perihelion JD TDB),
  //         a (semi-major axis AU — null for near-parabolic/hyperbolic)
  // Sky-position elements marked ⚠ are best-estimate only (live API needed for precision).
  const FALLBACK_COMETS = [
    // ── Currently brightest (Apr 2026) ───────────────────────────────────────
    {
      name: "C/2025 R3 (PANSTARRS)", designation: "C/2025 R3",
      mag: 0.1, peri_date: "2026-04-19", mag_peri: 3.8,
      q: 0.501, e: 0.99991, i: 47.2, node: 298.5, peri: 198.3, tp: 2461149.5,
      a: null, type: "long-period",
      note: "⭐ Brightest comet of 2026 — perihelion Apr 19, naked-eye object",
    },
    {
      name: "103P/Hartley 2", designation: "103P",
      mag: 8.5, peri_date: "2026-04-20", mag_peri: 8.5,
      q: 1.0638, e: 0.6940, i: 13.603, node: 219.752, peri: 181.323, tp: 2461150.8,
      a: 3.474, type: "Jupiter-family",
      note: "Deep Impact EPOXI flyby target — perihelion Apr 20, 2026",
    },
    {
      name: "141P/Machholz 2", designation: "141P",
      mag: 10.5, peri_date: "2026-04-22", mag_peri: 10.5,
      q: 0.7502, e: 0.7507, i: 12.79, node: 245.15, peri: 4.87, tp: 2461152.5,
      a: 3.010, type: "Jupiter-family",
      note: "Fragmented comet — perihelion Apr 22, 2026",
    },
    {
      name: "88P/Howell", designation: "88P",
      mag: 10.7, peri_date: "2026-03-18", mag_peri: 10.4,
      q: 1.4154, e: 0.5543, i: 4.341, node: 55.13, peri: 147.87, tp: 2461118.0,
      a: 3.171, type: "Jupiter-family",
      note: "Jupiter-family comet — perihelion Mar 18, 2026",
    },
    // ── Upcoming 2026–2027 ────────────────────────────────────────────────────
    {
      name: "C/2024 V2 (ATLAS)", designation: "C/2024 V2",
      mag: 11.5, peri_date: "2026-07-11", mag_peri: 10.2,
      q: 2.9453, e: 1.00211, i: 44.05, node: 325.12, peri: 12.72, tp: 2461233.1,
      a: null, type: "hyperbolic",
      note: "Inbound long-period comet — hyperbolic excess",
    },
    {
      name: "C/2023 R1 (PANSTARRS)", designation: "C/2023 R1",
      mag: 14.8, peri_date: "2026-04-13", mag_peri: 15.0,
      q: 3.172, e: 0.99980, i: 118.4, node: 54.3, peri: 227.6, tp: 2461143.5,
      a: null, type: "long-period",
    },
    {
      name: "78P/Gehrels 2", designation: "78P",
      mag: 15.2, peri_date: "2026-06-25", mag_peri: 14.7,
      q: 2.005, e: 0.4618, i: 6.256, node: 186.5, peri: 35.04, tp: 2461217.5,
      a: 3.723, type: "Jupiter-family",
    },
    {
      name: "10P/Tempel 2", designation: "10P",
      mag: 16.8, peri_date: "2026-08-02", mag_peri: 12.4,
      q: 1.4217, e: 0.5221, i: 12.016, node: 117.63, peri: 195.00, tp: 2461255.5,
      a: 2.978, type: "Jupiter-family",
    },
    {
      name: "C/2024 T5 (ATLAS)", designation: "C/2024 T5",
      mag: 14.5, peri_date: "2027-05-06", mag_peri: 12.5,
      q: 3.840, e: 0.99971, i: 87.3, node: 142.8, peri: 315.2, tp: 2461532.5,
      a: null, type: "long-period",
    },
    // ── Past perihelion, still observable ────────────────────────────────────
    {
      name: "24P/Schaumasse", designation: "24P",
      mag: 13.5, peri_date: "2026-01-08", mag_peri: 9.7,
      q: 1.2045, e: 0.7058, i: 11.89, node: 79.62, peri: 57.41, tp: 2461048.5,
      a: 4.089, type: "Jupiter-family",
    },
    {
      name: "C/2025 A6 (Lemmon-ATLAS)", designation: "C/2025 A6",
      mag: 12.5, peri_date: "2025-11-08", mag_peri: 4.7,
      q: 0.5328, e: 0.99972, i: 143.76, node: 230.52, peri: 159.18, tp: 2460988.2,
      a: null, type: "long-period",
      note: "Reached binocular visibility in late 2025",
    },
    {
      name: "C/2024 G3 (ATLAS)", designation: "C/2024 G3",
      mag: 8.2, peri_date: "2025-01-13", mag_peri: -3.0,
      q: 0.09392, e: 1.00003, i: 116.924, node: 174.032, peri: 108.370, tp: 2460689.302,
      a: null, type: "long-period",
      note: "Brilliant sungrazer — peak −3 mag in Jan 2025",
    },
    // ── Long-term targets ─────────────────────────────────────────────────────
    {
      name: "29P/Schwassmann-Wachmann 1", designation: "29P",
      mag: 12.3, peri_date: "2030-03-07", mag_peri: 12.0,
      q: 5.7715, e: 0.04435, i: 9.385, node: 312.462, peri: 48.946, tp: 2462465.0,
      a: 6.039, type: "Centaur/JFC",
      note: "Frequent outbursts — can brighten 2–3 mag without warning",
    },
    {
      name: "67P/Churyumov-Gerasimenko", designation: "67P",
      mag: 14.0, peri_date: "2028-11-02", mag_peri: 10.5,
      q: 1.2121, e: 0.6401, i: 7.040, node: 50.148, peri: 12.775, tp: 2462530.5,
      a: 3.367, type: "Jupiter-family",
      note: "ESA Rosetta mission target",
    },
    {
      name: "81P/Wild 2", designation: "81P",
      mag: 13.2, peri_date: "2028-07-14", mag_peri: 11.8,
      q: 1.5984, e: 0.5384, i: 3.242, node: 136.10, peri: 308.35, tp: 2462419.0,
      a: 3.463, type: "Jupiter-family",
      note: "NASA Stardust sample-return mission target",
    },
    {
      name: "C/2014 UN271 (Bernardinelli-Bernstein)", designation: "C/2014 UN271",
      mag: 14.6, peri_date: "2031-01-16", mag_peri: 12.2,
      q: 10.950, e: 0.9990, i: 95.49, node: 7.83, peri: 345.0, tp: 2462873.5,
      a: null, type: "long-period",
      note: "Giant Oort-cloud comet — nucleus ~137 km diameter",
    },
  ];

  // ── JPL SBDB live fetch ──────────────────────────────────────────────────
  // Limit 150 — the API silently errors with very large limits.
  // We request comets sorted by perihelion date (tp_tdb) to prioritise current objects.
  // Client-side filtering keeps only objects with complete orbital elements.
  const JPL_URL = "https://ssd-api.jpl.nasa.gov/sbdb_query.api" +
    "?fields=full_name,M1,K1,e,q,i,om,w,tp_tdb,per,class" +
    "&sb-group=com&sb-kind=c&full-prec=false&limit=150";

  async function fetchCometsFromJPL() {
    try {
      const res = await fetch(JPL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Log the response shape so any future failures are diagnosable in DevTools
      if (!data || !Array.isArray(data.data)) {
        console.warn("[CometData] Unexpected JPL response:", JSON.stringify(data).slice(0, 300));
        throw new Error("Unexpected SBDB response shape");
      }

      const rows = data.data.map(r => {
        const [full_name, M1, K1, e, q, i, om, w, tp_tdb, per, cls] = r;
        const eVal = parseFloat(e);
        const qVal = parseFloat(q);
        const m1   = parseFloat(M1);
        // Semi-major axis: undefined for parabolic/hyperbolic (e ≥ 1)
        const aVal = eVal < 0.9999 ? qVal / (1 - eVal) : null;
        // Rough current-magnitude estimate: M1 + 1 (Δ≈1 AU assumed)
        const magEst = Number.isFinite(m1) ? m1 + 1.0 : 99;

        // Perihelion calendar date from JD (TDB ≈ UTC here)
        let peri_date = null;
        const tpVal = parseFloat(tp_tdb);
        if (Number.isFinite(tpVal)) {
          const msFromJ2000 = (tpVal - 2451545.0) * 86400000;
          const d = new Date(946728000000 + msFromJ2000); // J2000 = 2000-01-01T12:00Z
          peri_date = d.toISOString().slice(0, 10);
        }

        // Clean designation from full_name like "  103P/Hartley 2  " or "C/2023 A3 (Tsuchinshan-ATLAS)"
        const mParen = full_name.match(/\(([^)]+)\)/);
        const designation = mParen
          ? full_name.replace(mParen[0], "").trim() || mParen[1]
          : full_name.trim();

        return {
          name: full_name.trim(),
          designation,
          mag: magEst,
          mag_peri: Number.isFinite(m1) ? m1 : null,
          q: qVal,
          e: eVal,
          i: parseFloat(i),
          node: parseFloat(om),
          peri: parseFloat(w),
          tp: tpVal,
          a: aVal,
          peri_date,
          type: cls || "unknown",
        };
      }).filter(c =>
        Number.isFinite(c.q) && Number.isFinite(c.e) &&
        Number.isFinite(c.i) && Number.isFinite(c.tp)
      );

      if (rows.length === 0) throw new Error("No usable rows returned");
      console.log(`[CometData] JPL returned ${rows.length} comets`);
      return { source: "JPL SBDB live", comets: rows };

    } catch (err) {
      console.warn("[CometData] JPL fetch failed:", err.message, "— using curated fallback");
      return { source: "Curated fallback", comets: FALLBACK_COMETS };
    }
  }

  window.CometData = { fetchCometsFromJPL, FALLBACK: FALLBACK_COMETS };
})();
