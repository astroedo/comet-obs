// Comet data fetching: tries JPL SBDB Close Approach / Search API, falls back to a curated list.
// JPL SBDB Query: https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,H,M1,M2,e,q,i,om,w,tp_tdb,per,class&sb-group=com&sb-kind=c&full-prec=false
// Not all CORS-friendly, so we also ship a realistic fallback list of known bright comets visible in the sky.

(function () {
  // Curated fallback data — recent & historically notable comets w/ orbital elements & typical mag estimates
  const FALLBACK_COMETS = [
    {
      name: "C/2023 A3 (Tsuchinshan-ATLAS)", designation: "C/2023 A3",
      mag: 4.2, peri_date: "2024-09-27", mag_peri: 0.4,
      q: 0.391, e: 1.000256, i: 139.11, node: 21.55, peri: 308.49, tp: 2460580.9,
      a: -1525.8, type: "long-period", discovered: "2023-01-09",
      note: "Stunning naked-eye comet of 2024; still sub-15 mag in outer portions of tail",
    },
    {
      name: "12P/Pons-Brooks", designation: "12P",
      mag: 8.4, peri_date: "2024-04-21", mag_peri: 4.2,
      q: 0.781, e: 0.954, i: 74.19, node: 255.87, peri: 199.03, tp: 2460421.2,
      a: 16.99, type: "Halley-type", discovered: "1812-07-12",
      note: "Cryo-volcanic outbursts have briefly taken it above naked-eye threshold",
    },
    {
      name: "13P/Olbers", designation: "13P",
      mag: 7.1, peri_date: "2024-06-30", mag_peri: 6.5,
      q: 1.175, e: 0.930, i: 44.56, node: 85.42, peri: 64.44, tp: 2460491.2,
      a: 16.78, type: "Halley-type", discovered: "1815-03-06",
      note: "Returning for the first time since 1956",
    },
    {
      name: "C/2024 G3 (ATLAS)", designation: "C/2024 G3",
      mag: 6.8, peri_date: "2025-01-13", mag_peri: -3.0,
      q: 0.094, e: 1.000, i: 116.92, node: 174.03, peri: 108.37, tp: 2460689.3,
      a: -1200, type: "long-period", discovered: "2024-04-05",
      note: "Sungrazer — brilliant southern-sky show post-perihelion",
    },
    {
      name: "C/2022 E3 (ZTF)", designation: "C/2022 E3",
      mag: 9.8, peri_date: "2023-01-12", mag_peri: 4.6,
      q: 1.112, e: 1.00027, i: 109.17, node: 302.55, peri: 145.82, tp: 2459957.1,
      a: -4100, type: "long-period", discovered: "2022-03-02",
      note: "The 'green comet' — widely observed & photographed",
    },
    {
      name: "C/2024 S1 (ATLAS)", designation: "C/2024 S1",
      mag: 11.2, peri_date: "2024-10-28", mag_peri: 0,
      q: 0.008, e: 1.000, i: 143.6, node: 51.3, peri: 77.6, tp: 2460611.8,
      a: -800, type: "sungrazer-kreutz", discovered: "2024-09-27",
      note: "Kreutz family sungrazer — disintegrated near perihelion",
    },
    {
      name: "103P/Hartley", designation: "103P",
      mag: 12.4, peri_date: "2026-04-20", mag_peri: 8.5,
      q: 1.064, e: 0.694, i: 13.60, node: 219.75, peri: 181.32, tp: 2461151.3,
      a: 3.47, type: "Jupiter-family", discovered: "1986-03-15",
      note: "EPOXI flyby target in 2010",
    },
    {
      name: "C/2024 E1 (Wierzchos)", designation: "C/2024 E1",
      mag: 13.1, peri_date: "2025-11-05", mag_peri: 9.8,
      q: 1.784, e: 0.9992, i: 102.38, node: 112.9, peri: 54.6, tp: 2460985.0,
      a: -2200, type: "long-period",
      note: "Slow outbound fade — excellent for long-exposure imaging",
    },
    {
      name: "29P/Schwassmann-Wachmann", designation: "29P",
      mag: 13.8, peri_date: "2024-03-07", mag_peri: 13.0,
      q: 5.77, e: 0.045, i: 9.39, node: 312.5, peri: 48.95, tp: 2460376.0,
      a: 6.04, type: "Centaur-like",
      note: "Famous for frequent outbursts that can jump it to 11th mag",
    },
    {
      name: "210P/Christensen", designation: "210P",
      mag: 13.5, peri_date: "2025-11-15", mag_peri: 11.6,
      q: 0.536, e: 0.815, i: 10.23, node: 93.05, peri: 117.9, tp: 2460994.9,
      a: 2.90, type: "Jupiter-family",
    },
    {
      name: "C/2025 A6 (Lemmon)", designation: "C/2025 A6",
      mag: 10.3, peri_date: "2025-11-08", mag_peri: 3.8,
      q: 0.533, e: 0.9997, i: 143.8, node: 230.5, peri: 159.2, tp: 2460988.2,
      a: -1760, type: "long-period",
      note: "Forecast to become a bright binocular comet through winter 2025–26",
    },
    {
      name: "3D/Biela", designation: "3D",
      mag: 14.7, peri_date: "2025-12-04", mag_peri: 14.2,
      q: 0.879, e: 0.756, i: 13.22, node: 247.3, peri: 221.7, tp: 2461014.0,
      a: 3.60, type: "lost/fragmented",
      note: "Historical; position reconstruction",
    },
    {
      name: "C/2024 V2 (Borisov)", designation: "C/2024 V2",
      mag: 11.8, peri_date: "2026-07-11", mag_peri: 10.2,
      q: 2.945, e: 1.0021, i: 44.05, node: 325.1, peri: 12.7, tp: 2461233.1,
      a: -1400, type: "hyperbolic",
    },
    {
      name: "144P/Kushida", designation: "144P",
      mag: 12.9, peri_date: "2025-03-24", mag_peri: 9.2,
      q: 1.431, e: 0.628, i: 4.11, node: 244.5, peri: 217.1, tp: 2460758.5,
      a: 3.85, type: "Jupiter-family",
    },
    {
      name: "67P/Churyumov-Gerasimenko", designation: "67P",
      mag: 13.6, peri_date: "2028-04-09", mag_peri: 10.2,
      q: 1.212, e: 0.641, i: 7.04, node: 50.1, peri: 12.8, tp: 2461870.0,
      a: 3.38, type: "Jupiter-family",
      note: "Rosetta mission target",
    },
  ];

  async function fetchCometsFromJPL() {
    // Attempt a CORS-friendly fetch. If it fails, fall back.
    const url = "https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,H,e,q,i,om,w,tp_tdb,per,class&sb-group=com&sb-kind=c&limit=40";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("SBDB failed");
      const data = await res.json();
      if (!data || !data.data) throw new Error("SBDB empty");
      const rows = data.data.map(r => {
        const [full_name, H, e, q, i, om, w, tp_tdb, per, cls] = r;
        return {
          name: full_name.trim(),
          designation: full_name.split("(")[0].trim(),
          mag: parseFloat(H) + 5,      // crude observed-mag estimate
          mag_peri: parseFloat(H),
          q: parseFloat(q),
          e: parseFloat(e),
          i: parseFloat(i),
          node: parseFloat(om),
          peri: parseFloat(w),
          tp: parseFloat(tp_tdb),
          a: parseFloat(q) / (1 - parseFloat(e)),
          type: cls,
        };
      }).filter(c => Number.isFinite(c.mag) && c.mag < 15);
      return { source: "JPL SBDB (live)", comets: rows };
    } catch (err) {
      return { source: "Curated fallback (JPL unreachable)", comets: FALLBACK_COMETS, error: String(err) };
    }
  }

  window.CometData = {
    fetchCometsFromJPL,
    FALLBACK: FALLBACK_COMETS,
  };
})();
