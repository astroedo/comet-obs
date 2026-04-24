// Shared shell: topbar nav with location/time/theme, app layout.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const Icon = ({ d, size = 16, stroke = 1.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const IconOrbit = () => (
  <Icon d={<g>
    <ellipse cx="12" cy="12" rx="9" ry="4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="20" cy="11" r="1" fill="currentColor" stroke="none" />
  </g>} />
);
const IconComet = () => (
  <Icon d={<g>
    <circle cx="17" cy="7" r="2.5" />
    <path d="M15 9 L5 19" />
    <path d="M13 8 L4 16" opacity="0.6" />
    <path d="M16 11 L8 19" opacity="0.6" />
  </g>} />
);
const IconPlanets = () => (
  <Icon d={<g>
    <circle cx="12" cy="12" r="4" />
    <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-20 12 12)" />
  </g>} />
);
const IconMoon = () => (
  <Icon d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
);

function useLocation() {
  const [loc, setLoc] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("co_loc") || "null");
      if (s && typeof s.lat === "number") return s;
    } catch {}
    return { name: "New York, NY", lat: 40.7128, lon: -74.0060 };
  });
  useEffect(() => { localStorage.setItem("co_loc", JSON.stringify(loc)); }, [loc]);
  return [loc, setLoc];
}

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem("co_theme") || "dark");
  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem("co_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  return [theme, setTheme];
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "dark");
}
(function bootTheme() {
  try { applyTheme(localStorage.getItem("co_theme") || "dark"); }
  catch { applyTheme("dark"); }
})();

// ---------- Location picker with geocoding ----------
function LocationPicker({ loc, setLoc }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | searching | done
  const [latInp, setLatInp] = useState("");
  const [lonInp, setLonInp] = useState("");
  const [coordMode, setCoordMode] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const handleQuery = (q) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setStatus("idle"); return; }
    setStatus("searching");
    timer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=en`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.map(r => ({
          name: r.display_name.split(",").slice(0, 3).join(", ").trim(),
          short: r.display_name.split(",")[0].trim(),
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        })));
        setStatus("done");
      } catch {
        setResults([]);
        setStatus("done");
      }
    }, 500);
  };

  const pick = (r) => {
    setLoc({ name: r.short, lat: r.lat, lon: r.lon });
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("idle");
  };

  const applyCoords = () => {
    const la = parseFloat(latInp), lo = parseFloat(lonInp);
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      setLoc({ name: `${la.toFixed(2)}°, ${lo.toFixed(2)}°`, lat: la, lon: lo });
      setOpen(false);
      setLatInp(""); setLonInp("");
    }
  };

  const geolocate = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "My location" });
      setOpen(false);
    });
  };

  return (
    <div className="locpicker" ref={ref}>
      <button className="locpicker__trigger" onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span>{loc.name}</span>
        <span className="locpicker__coords mono">{loc.lat.toFixed(2)}°, {loc.lon.toFixed(2)}°</span>
      </button>
      {open && (
        <div className="locpicker__pop panel">
          <div className="locpicker__tabs">
            <button className={!coordMode ? "active" : ""} onClick={() => setCoordMode(false)}>Search place</button>
            <button className={coordMode ? "active" : ""} onClick={() => setCoordMode(true)}>Coordinates</button>
          </div>
          {!coordMode && (
            <div>
              <div className="search-bar" style={{ margin: "0 10px 6px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="6" /><path d="M20 20 L15.5 15.5" />
                </svg>
                <input autoFocus placeholder="City, observatory, mountain…"
                  value={query} onChange={e => handleQuery(e.target.value)} />
              </div>
              {status === "searching" && (
                <div className="locpicker__empty mono">Searching…</div>
              )}
              {results.length > 0 && (
                <div className="locpicker__list">
                  {results.map((r, i) => (
                    <div key={i} className="locpicker__item" onClick={() => pick(r)}>
                      <div className="locpicker__item-name">{r.short}</div>
                      <div className="locpicker__item-co mono">{r.lat.toFixed(3)}°, {r.lon.toFixed(3)}°</div>
                    </div>
                  ))}
                </div>
              )}
              {status === "done" && results.length === 0 && query.trim() && (
                <div className="locpicker__empty mono">No results · try Coordinates tab</div>
              )}
              {status === "idle" && !query && (
                <div className="locpicker__empty mono" style={{ opacity: 0.5 }}>Type to search any place worldwide</div>
              )}
              <button className="locpicker__geo" onClick={geolocate}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
                Use my location
              </button>
            </div>
          )}
          {coordMode && (
            <div style={{ padding: "0 10px 10px" }}>
              <div className="locpicker__label">Latitude °</div>
              <input className="locpicker__inp" value={latInp} onChange={e => setLatInp(e.target.value)}
                placeholder={String(loc.lat.toFixed(4))} inputMode="decimal" />
              <div className="locpicker__label">Longitude °</div>
              <input className="locpicker__inp" value={lonInp} onChange={e => setLonInp(e.target.value)}
                placeholder={String(loc.lon.toFixed(4))} inputMode="decimal" />
              <button className="locpicker__apply" onClick={applyCoords}>Set location</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Theme toggle ----------
function ThemeToggle({ theme, setTheme }) {
  const themes = [
    { v: "dark",  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>, title: "Dark" },
    { v: "light", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>, title: "Light" },
    { v: "sepia", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6h16v14H4z M4 6l8 5 8-5" /></svg>, title: "Sepia" },
  ];
  return (
    <div className="theme-toggle">
      {themes.map(t => (
        <button key={t.v} className={theme === t.v ? "active" : ""} title={t.title}
          onClick={() => setTheme(t.v)}>{t.icon}</button>
      ))}
    </div>
  );
}

// ---------- Topbar with nav ----------
function Topbar({ current, loc, setLoc, extra, theme, setTheme }) {
  const now = useClock();
  const utc = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const jd = (now.getTime() / 86400000 + 2440587.5).toFixed(4);

  const navItems = [
    { id: "index.html", label: "Solar Map", icon: <IconOrbit /> },
    { id: "comets.html", label: "Comets", icon: <IconComet /> },
    { id: "planets.html", label: "Planets", icon: <IconPlanets /> },
    { id: "moon.html", label: "Moon", icon: <IconMoon /> },
  ];

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <span className="topbar__brand-icon" />
        <span className="topbar__brand-name">Comet Obs.</span>
        <span className="topbar__brand-ver mono">v0.3</span>
      </div>
      <div className="topbar__divider" />
      <nav className="topbar__nav">
        {navItems.map(it => (
          <a key={it.id} href={it.id}
            className={"topbar__nav-item" + (current === it.id ? " active" : "")}>
            {it.icon}
            <span>{it.label}</span>
          </a>
        ))}
      </nav>
      <div className="topbar__divider" />
      <div className="topbar__stat">
        <span className="topbar__stat-label">UTC</span>
        <span className="topbar__stat-value">{utc}</span>
      </div>
      <div className="topbar__stat">
        <span className="topbar__stat-label">JD</span>
        <span className="topbar__stat-value">{jd}</span>
      </div>
      <div className="topbar__spacer" />
      {extra}
      <LocationPicker loc={loc} setLoc={setLoc} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}

function Shell({ current, extra, children }) {
  const [loc, setLoc] = useLocation();
  const [theme, setTheme] = useTheme();
  return (
    <div className="app">
      <Topbar current={current} loc={loc} setLoc={setLoc} extra={extra} theme={theme} setTheme={setTheme} />
      <div className="content">
        {typeof children === "function" ? children({ loc, theme, setTheme }) : children}
      </div>
    </div>
  );
}

function Check({ checked, onChange, children }) {
  return (
    <div className={"check" + (checked ? " check--on" : "")} onClick={() => onChange(!checked)}>
      <span className="check__box" />
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

Object.assign(window, {
  Shell, Topbar, LocationPicker, ThemeToggle,
  Check, Icon, IconOrbit, IconComet, IconPlanets, IconMoon,
  useLocation, useClock, useTheme, applyTheme,
});
