// Comet data: fetches live orbital elements from JPL SBDB, falls back to a curated list.
// API doc: https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html

(function () {

  // ── Curated fallback ─────────────────────────────────────────────────────
  // Bright/notable comets with verified orbital elements (epoch ~2025-2026).
  // Fields: q (perihelion AU), e (eccentricity), i (inclination °),
  //         node (Ω °), peri (ω °), tp (perihelion JD TDB),
  //         a (semi-major axis AU — null for hyperbolic/parabolic)
  const FALLBACK_COMETS = [
    {
      name: "C/2023 A3 (Tsuchinshan-ATLAS)", designation: "C/2023 A3",
      mag: 6.5, peri_date: "2024-09-27", mag_peri: 0.4,
      q: 0.391084, e: 1.000256, i: 139.1139, node: 21.5464, peri: 308.4865, tp: 2460580.908,
      a: null, type: "long-period",
      note: "Naked-eye comet of 2024 — one of the brightest in decades",
    },
    {
      name: "C/2025 A6 (Lemmon-ATLAS)", designation: "C/2025 A6",
      mag: 9.5, peri_date: "2025-11-08", mag_peri: 3.8,
      q: 0.5328, e: 0.99972, i: 143.76, node: 230.52, peri: 159.18, tp: 2460988.2,
      a: null, type: "long-period",
      note: "Forecast to brighten to binocular visibility in late 2025",
    },
    {
      name: "C/2024 G3 (ATLAS)", designation: "C/2024 G3",
      mag: 8.2, peri_date: "2025-01-13", mag_peri: -3.0,
      q: 0.09392, e: 1.00003, i: 116.924, node: 174.032, peri: 108.370, tp: 2460689.302,
      a: null, type: "long-period",
      note: "Brilliant sungrazer — peak at −3 mag in January 2025",
    },
    {
      name: "103P/Hartley 2", designation: "103P",
      mag: 11.8, peri_date: "2026-04-20", mag_peri: 8.5,
      q: 1.0638, e: 0.6940, i: 13.603, node: 219.752, peri: 181.323, tp: 2461151.3,
      a: 3.474, type: "Jupiter-family",
      note: "Deep Impact EPOXI flyby target (2010) — approaching perihelion Apr 2026",
    },
    {
      name: "C/2024 V2 (ATLAS)", designation: "C/2024 V2",
      mag: 11.5, peri_date: "2026-07-11", mag_peri: 10.2,
      q: 2.9453, e: 1.00211, i: 44.05, node: 325.12, peri: 12.72, tp: 2461233.1,
      a: null, type: "hyperbolic",
      note: "Inbound long-period comet with slight hyperbolic excess",
    },
    {
      name: "C/2024 N1 (ATLAS)", designation: "C/2024 N1",
      mag: 11.0, peri_date: "2025-07-22", mag_peri: 9.1,
      q: 1.4512, e: 1.00008, i: 128.44, node: 144.32, peri: 200.98, tp: 2460877.5,
      a: null, type: "long-period",
      note: "Summer 2025 binocular candidate for southern observers",
    },
    {
      name: "C/2025 B3 (ATLAS)", designation: "C/2025 B3",
      mag: 12.0, peri_date: "2025-09-15", mag_peri: 10.5,
      q: 1.8820, e: 0.99981, i: 102.1, node: 289.5, peri: 87.3, tp: 2460940.2,
      a: null, type: "long-period",
    },
    {
      name: "29P/Schwassmann-Wachmann 1", designation: "29P",
      mag: 12.5, peri_date: "2030-03-07", mag_peri: 12.0,
      q: 5.7715, e: 0.04435, i: 9.385, node: 312.462, peri: 48.946, tp: 2462465.0,
      a: 6.039, type: "Centaur/JFC",
      note: "Famous for frequent outbursts — can brighten 2–3 mag without warning",
    },
    {
      name: "12P/Pons-Brooks", designation: "12P",
      mag: 12.0, peri_date: "2024-04-21", mag_peri: 4.2,
      q: 0.78074, e: 0.95449, i: 74.19, node: 255.87, peri: 199.03, tp: 2460421.19,
      a: 17.12, type: "Halley-type",
      note: "Cryo-volcanic eruptions made it famous in 2023-24; next return ~2095",
    },
    {
      name: "67P/Churyumov-Gerasimenko", designation: "67P",
      mag: 14.0, peri_date: "2028-11-02", mag_peri: 10.5,
      q: 1.2121, e: 0.6401, i: 7.040, node: 50.148, peri: 12.775, tp: 2462530.5,
      a: 3.367, type: "Jupiter-family",
      note: "ESA Rosetta mission target — extensively studied nucleus",
    },
    {
      name: "81P/Wild 2", designation: "81P",
      mag: 13.2, peri_date: "2028-07-14", mag_peri: 11.8,
      q: 1.5984, e: 0.5384, i: 3.242, node: 136.10, peri: 308.35, tp: 2462419.0,
      a: 3.463, type: "Jupiter-family",
      note: "NASA Stardust sample-return mission target",
    },
    {
      name: "C/2024 E1 (Wierzchos)", designation: "C/2024 E1",
      mag: 13.5, peri_date: "2025-11-05", mag_peri: 9.8,
      q: 1.7839, e: 0.99920, i: 102.38, node: 112.92, peri: 54.58, tp: 2460984.8,
      a: null, type: "long-period",
      note: "Excellent long-exposure imaging target through 2025",
    },
    {
      name: "13P/Olbers", designation: "13P",
      mag: 14.0, peri_date: "2024-06-30", mag_peri: 6.5,
      q: 1.1748, e: 0.93044, i: 44.563, node: 85.416, peri: 64.443, tp: 2460491.23,
      a: 16.89, type: "Halley-type",
      note: "First return since 1956 — Halley-family comet",
    },
    {
      name: "210P/Christensen", designation: "210P",
      mag: 13.5, peri_date: "2025-11-15", mag_peri: 11.6,
      q: 0.5358, e: 0.8147, i: 10.231, node: 93.051, peri: 117.903, tp: 2460994.9,
      a: 2.895, type: "Jupiter-family",
    },
    {
      name: "144P/Kushida", designation: "144P",
      mag: 14.2, peri_date: "2025-03-24", mag_peri: 9.2,
      q: 1.4306, e: 0.6279, i: 4.109, node: 244.455, peri: 217.059, tp: 2460758.5,
      a: 3.843, type: "Jupiter-family",
    },
  ];

  // ── JPL SBDB live fetch ──────────────────────────────────────────────────
  // Fields: full_name, M1 (total magnitude), K1 (slope), e, q, i, om, w, tp_tdb, class
  // M1/K1 give the standard comet total-magnitude formula:  m = M1 + 5·log₁₀(Δ) + 2.5·K1·log₁₀(r)
  // We use M1 directly as the near-perihelion magnitude estimate.
  // Limit 500 to capture all recently discovered comets (new designations can push past 120).
  // We filter client-side after parsing so we don't risk a server-side filter error.
  const JPL_URL = "https://ssd-api.jpl.nasa.gov/sbdb_query.api" +
    "?fields=full_name,M1,K1,e,q,i,om,w,tp_tdb,per,class" +
    "&sb-group=com&sb-kind=c&full-prec=false&limit=500";

  async function fetchCometsFromJPL() {
    try {
      const res = await fetch(JPL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.data)) throw new Error("Unexpected SBDB response shape");

      const now = Date.now();
      const rows = data.data.map(r => {
        const [full_name, M1, K1, e, q, i, om, w, tp_tdb, per, cls] = r;
        const eVal = parseFloat(e);
        const qVal = parseFloat(q);
        const m1   = parseFloat(M1);
        // Semi-major axis: undefined for parabolic/hyperbolic (e≥1)
        const aVal = eVal < 0.9999 ? qVal / (1 - eVal) : null;
        // Comet total magnitude estimate at current date using:
        //   m ≈ M1 + 5·log₁₀(Δ) + 2.5·K1·log₁₀(r)
        // Without computing actual r and Δ here, use M1+1 as rough "current" estimate
        // (we don't have loc in this module; the detail panel refines this)
        const magEst = Number.isFinite(m1) ? m1 + 1.0 : 99;

        // Approximate perihelion date from tp_tdb (Julian date)
        let peri_date = null;
        const tpVal = parseFloat(tp_tdb);
        if (Number.isFinite(tpVal)) {
          const msFromJ2000 = (tpVal - 2451545.0) * 86400000;
          const d = new Date(946728000000 + msFromJ2000); // J2000 = 2000-01-01 12:00 UTC
          peri_date = d.toISOString().slice(0, 10);
        }

        // Parse designation from full_name
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
      }).filter(c => Number.isFinite(c.mag) && c.mag <= 18   // 18 = include newly discovered faint comets
                  && Number.isFinite(c.q) && Number.isFinite(c.e)
                  && Number.isFinite(c.i) && Number.isFinite(c.tp));

      if (rows.length === 0) throw new Error("No usable rows returned");
      return { source: "JPL SBDB live", comets: rows };
    } catch (err) {
      console.warn("[CometData] JPL fetch failed:", err.message, "— using curated fallback");
      return { source: "Curated fallback", comets: FALLBACK_COMETS };
    }
  }

  window.CometData = { fetchCometsFromJPL, FALLBACK: FALLBACK_COMETS };
})();
