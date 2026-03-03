import { useState, useEffect, useCallback } from "react";

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── API Helper ───────────────────────────────────────────────────────────────
function useApi() {
  const token = () => localStorage.getItem("chh_token");
  const headers = () => ({ "Authorization": `Bearer ${token()}`, "Content-Type": "application/json" });

  const get = async (path) => {
    const r = await fetch(`${API_BASE}${path}`, { headers: headers() });
    if (r.status === 401) { localStorage.removeItem("chh_token"); window.location.reload(); }
    return r.json();
  };
  const post = async (path, body) => {
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: headers(), body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { localStorage.removeItem("chh_token"); window.location.reload(); }
    return r.json();
  };
  return { get, post };
}

// ── Styles ───────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0f1a;color:#e8eaf0;font-family:'DM Sans',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
`;

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 58 }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? "#6ee7b7" : score >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="12" fontWeight="700" fontFamily="'DM Mono',monospace"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}%
      </text>
    </svg>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const body = new URLSearchParams({ username: user, password: pass });
      const r = await fetch(`${API_BASE}/auth/login`, { method: "POST", body });
      const data = await r.json();
      if (!r.ok) { setErr(data.detail || "Login failed"); }
      else {
        localStorage.setItem("chh_token", data.access_token);
        onLogin(data.username);
      }
    } catch { setErr("Cannot reach server. Check backend URL."); }
    setLoading(false);
  };

  const input = {
    width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8, padding: "12px 16px", color: "#e8eaf0", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none"
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0f1a", padding: 24 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeIn .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, margin: "0 auto 16px",
            background: "linear-gradient(135deg,#c9a84c,#8b6914)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif" }}>CHH</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>
            Compliance Intelligence Center
          </div>
          <div style={{ fontSize: 12, color: "#5a6475", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
            NAICOM REGULATORY MONITOR
          </div>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input placeholder="Username" value={user} onChange={e => setUser(e.target.value)}
            required autoFocus style={input}/>
          <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)}
            required style={input}/>
          {err && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
            borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#f87171" }}>{err}</div>}
          <button type="submit" disabled={loading} style={{
            background: loading ? "rgba(201,168,76,.2)" : "linear-gradient(135deg,#c9a84c,#8b6914)",
            color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontSize: 14,
            fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "'Syne',sans-serif",
            letterSpacing: "0.02em"
          }}>{loading ? "Signing in…" : "Sign In"}</button>
        </form>
        <p style={{ textAlign: "center", fontSize: 11, color: "#3a4455", marginTop: 24,
          fontFamily: "'DM Mono',monospace" }}>
          Consolidated Hallmark Group · Internal Tool
        </p>
      </div>
    </div>
  );
}

// ── Notification Toast ────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const ok = type === "success";
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: ok ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
      border: `1px solid ${ok ? "#10b981" : "#ef4444"}`,
      borderRadius: 10, padding: "11px 18px",
      backdropFilter: "blur(20px)", animation: "slideDown .25s ease",
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 13, fontFamily: "'DM Mono',monospace", color: ok ? "#6ee7b7" : "#f87171" }}>
      {ok ? "✓" : "!"} {msg}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
const URGENCY = {
  critical: { bg: "rgba(239,68,68,.12)", border: "#ef4444", text: "#ef4444" },
  high:     { bg: "rgba(245,158,11,.12)", border: "#f59e0b", text: "#f59e0b" },
  medium:   { bg: "rgba(99,179,237,.12)", border: "#63b3ed", text: "#63b3ed" },
  low:      { bg: "rgba(110,231,183,.1)", border: "#6ee7b7", text: "#6ee7b7" },
};
const STATUS = {
  action_required: { label: "ACTION REQUIRED", color: "#ef4444" },
  in_review:       { label: "IN REVIEW",       color: "#f59e0b" },
  compliant:       { label: "COMPLIANT",        color: "#6ee7b7" },
};
const CATS = ["All","Capital Adequacy","Market Conduct","AML/CFT","Pricing","Reporting","Consumer Protection"];

function Dashboard({ username, onLogout }) {
  const api = useApi();
  const [tab, setTab]         = useState("updates");
  const [cat, setCat]         = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast]     = useState(null);
  const [scraping, setScraping] = useState(false);
  const [sending, setSending] = useState(false);

  const [stats, setStats]   = useState(null);
  const [items, setItems]   = useState([]);
  const [gaps, setGaps]     = useState([]);
  const [loading, setLoading] = useState(true);

  const notify = (msg, type="success") => setToast({ msg, type });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, i, g] = await Promise.all([
        api.get("/api/stats"),
        api.get("/api/items"),
        api.get("/api/gaps")
      ]);
      setStats(s); setItems(i.items || []); setGaps(g.gaps || []);
    } catch { notify("Failed to load data", "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const r = await api.post("/api/scrape");
      notify(`Scrape complete. ${r.new_items} new items found.`);
      load();
    } catch { notify("Scrape failed", "error"); }
    setScraping(false);
  };

  const handleDigest = async () => {
    setSending(true);
    try {
      await api.post("/api/digest");
      notify("Digest dispatched to all department heads.");
    } catch { notify("Digest failed", "error"); }
    setSending(false);
  };

  const filtered = cat === "All" ? items : items.filter(i => i.compliance_category === cat);
  const depts    = stats?.departments || [];
  const avgScore = stats?.avg_score || 0;

  const btn = (label, onClick, loading_, color="#c9a84c") => (
    <button onClick={onClick} disabled={loading_} style={{
      background: loading_ ? "rgba(255,255,255,.04)" : `${color}18`,
      border: `1px solid ${loading_ ? "rgba(255,255,255,.08)" : `${color}60`}`,
      color: loading_ ? "#5a6475" : color,
      borderRadius: 7, padding: "7px 16px", fontSize: 12,
      cursor: loading_ ? "wait" : "pointer", fontWeight: 600,
      display: "flex", alignItems: "center", gap: 6,
      fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap"
    }}>
      {loading_ ? <span style={{ display:"inline-block", animation:"spin .8s linear infinite" }}>⟳</span> : null}
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a" }}>
      <style>{css}</style>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* Top Bar */}
      <div style={{ background: "rgba(255,255,255,.025)", borderBottom: "1px solid rgba(255,255,255,.06)",
        padding: "13px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 7,
            background: "linear-gradient(135deg,#c9a84c,#8b6914)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff" }}>CHH</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
              Compliance Intelligence Center
            </div>
            <div style={{ fontSize: 10, color: "#7a8394", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>
              CONSOLIDATED HALLMARK GROUP · NAICOM REGULATORY MONITOR
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.04)",
            borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#7a8394",
            fontFamily: "'DM Mono',monospace", border: "1px solid rgba(255,255,255,.06)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#6ee7b7",
              display:"inline-block", animation:"pulse 2s infinite" }}/>
            {stats?.last_scraped ? `Last: ${new Date(stats.last_scraped).toLocaleString()}` : "Not scraped yet"}
          </div>
          {btn(scraping ? "Scraping…" : "⟳ Scrape Now", handleScrape, scraping)}
          {btn(sending ? "Sending…" : "✉ Send Digest", handleDigest, sending, "#6ee7b7")}
          <div style={{ display:"flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,.04)", borderRadius:7, padding:"6px 12px",
            border:"1px solid rgba(255,255,255,.07)", fontSize:12, color:"#7a8394",
            fontFamily:"'DM Mono',monospace", cursor:"pointer" }} onClick={onLogout}>
            👤 {username} · Sign out
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, color:"#5a6475" }}>
          <span style={{ display:"inline-block", animation:"spin 1s linear infinite", marginRight:10 }}>⟳</span>
          Loading compliance data…
        </div>
      ) : (
        <div style={{ padding: "24px 28px" }}>
          {/* KPI Row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            {[
              { label:"Overall Compliance",   value:`${avgScore}%`, sub:"Across all departments",  color: avgScore>=80?"#6ee7b7":"#f59e0b", icon:"◎" },
              { label:"Critical Alerts",       value: stats?.critical_count||0, sub:"Immediate action needed", color:"#ef4444", icon:"⚠" },
              { label:"Compliance Gaps",       value: stats?.gap_count||0, sub:"Flagged this cycle",      color:"#f59e0b", icon:"◈" },
              { label:"Regulatory Items",      value: stats?.total_items||0, sub:"Active in monitoring",    color:"#63b3ed", icon:"⬡" },
            ].map((k,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)",
                borderRadius:12, padding:"18px 20px", position:"relative", overflow:"hidden",
                animation:`fadeIn .3s ease ${i*.07}s both` }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
                  background:`linear-gradient(90deg,transparent,${k.color},transparent)` }}/>
                <div style={{ fontSize:20, marginBottom:4, opacity:.45 }}>{k.icon}</div>
                <div style={{ fontSize:30, fontWeight:800, color:k.color, lineHeight:1, marginBottom:4,
                  fontFamily:"'Syne',sans-serif" }}>{k.value}</div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{k.label}</div>
                <div style={{ fontSize:10, color:"#5a6475", fontFamily:"'DM Mono',monospace" }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:18 }}>
            {/* Left */}
            <div>
              {/* Tabs */}
              <div style={{ display:"flex", gap:2, borderBottom:"1px solid rgba(255,255,255,.07)", marginBottom:16 }}>
                {[["updates","Regulatory Updates"],["gaps",`Compliance Gaps (${gaps.length})`],["digest","Digest Preview"]].map(([id,label]) => (
                  <button key={id} onClick={() => setTab(id)} style={{
                    background:"none", border:"none", cursor:"pointer", padding:"9px 16px",
                    fontSize:13, fontWeight:600, fontFamily:"'Syne',sans-serif",
                    color: tab===id ? "#c9a84c" : "#5a6475",
                    borderBottom: tab===id ? "2px solid #c9a84c" : "2px solid transparent", marginBottom:-1
                  }}>{label}</button>
                ))}
              </div>

              {tab === "updates" && (
                <>
                  <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                    {CATS.map(c => (
                      <button key={c} onClick={() => setCat(c)} style={{
                        background: cat===c ? "rgba(201,168,76,.15)" : "rgba(255,255,255,.04)",
                        border: `1px solid ${cat===c ? "rgba(201,168,76,.5)" : "rgba(255,255,255,.07)"}`,
                        color: cat===c ? "#c9a84c" : "#7a8394", borderRadius:20, padding:"4px 12px",
                        fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace"
                      }}>{c}</button>
                    ))}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {filtered.length === 0 && (
                      <div style={{ color:"#5a6475", fontSize:13, padding:24, textAlign:"center",
                        fontFamily:"'DM Mono',monospace" }}>No items in this category.</div>
                    )}
                    {filtered.map(item => {
                      const u = URGENCY[item.urgency] || URGENCY.low;
                      const s = STATUS[item.status]   || STATUS.in_review;
                      const exp = expanded === item.item_hash;
                      const depts = (() => { try { return JSON.parse(item.affected_depts||"[]"); } catch { return []; }})();
                      return (
                        <div key={item.item_hash}
                          onClick={() => setExpanded(exp ? null : item.item_hash)}
                          style={{ background: exp?"rgba(255,255,255,.05)":"rgba(255,255,255,.025)",
                            border:`1px solid ${exp?u.border:"rgba(255,255,255,.07)"}`,
                            borderLeft:`3px solid ${u.border}`,
                            borderRadius:11, padding:"14px 18px", cursor:"pointer",
                            transition:"all .2s", animation:"fadeIn .3s ease" }}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
                                <span style={{ background:u.bg, border:`1px solid ${u.border}`, color:u.text,
                                  borderRadius:4, padding:"2px 7px", fontSize:9, fontWeight:700,
                                  fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>{item.urgency?.toUpperCase()}</span>
                                <span style={{ color:s.color, fontSize:9, fontFamily:"'DM Mono',monospace",
                                  fontWeight:600 }}>● {s.label}</span>
                                <span style={{ background:"rgba(255,255,255,.04)", borderRadius:4,
                                  padding:"2px 7px", fontSize:9, color:"#5a6475",
                                  fontFamily:"'DM Mono',monospace" }}>{item.compliance_category}</span>
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, marginBottom:3, lineHeight:1.4 }}>{item.title}</div>
                              <div style={{ fontSize:10, color:"#5a6475", fontFamily:"'DM Mono',monospace" }}>
                                {item.date_published}
                                {item.deadline && ` · Deadline: ${item.deadline}`}
                              </div>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, marginLeft:12 }}>
                              {item.gap_detected ? (
                                <span style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)",
                                  color:"#ef4444", borderRadius:4, padding:"2px 7px", fontSize:9,
                                  fontWeight:700, fontFamily:"'DM Mono',monospace" }}>⚑ GAP</span>
                              ) : null}
                              <span style={{ fontSize:14, color:"#5a6475",
                                transform: exp?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>⌄</span>
                            </div>
                          </div>
                          {exp && (
                            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,.07)" }}>
                              <p style={{ fontSize:12, color:"#b0b8c8", lineHeight:1.7, marginBottom:10 }}>{item.summary}</p>
                              {item.gap_detected && (
                                <div style={{ background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.2)",
                                  borderRadius:7, padding:"9px 12px", marginBottom:10 }}>
                                  <div style={{ fontSize:10, fontWeight:700, color:"#ef4444",
                                    fontFamily:"'DM Mono',monospace", marginBottom:3 }}>⚑ GAP DETECTED</div>
                                  <div style={{ fontSize:11, color:"#f0a0a0" }}>{item.gap_note}</div>
                                </div>
                              )}
                              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                <span style={{ fontSize:10, color:"#7a8394", fontFamily:"'DM Mono',monospace" }}>Notified:</span>
                                {depts.map(d => (
                                  <span key={d} style={{ background:"rgba(99,179,237,.08)",
                                    border:"1px solid rgba(99,179,237,.2)", color:"#63b3ed",
                                    borderRadius:4, padding:"2px 7px", fontSize:10,
                                    fontFamily:"'DM Mono',monospace" }}>{d}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {tab === "gaps" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {gaps.length === 0 && (
                    <div style={{ color:"#6ee7b7", fontSize:13, padding:24, textAlign:"center",
                      fontFamily:"'DM Mono',monospace" }}>✓ No open compliance gaps.</div>
                  )}
                  {gaps.map(g => {
                    const u = URGENCY[g.urgency] || URGENCY.low;
                    return (
                      <div key={g.item_hash} style={{ background:"rgba(239,68,68,.04)",
                        border:"1px solid rgba(239,68,68,.2)", borderLeft:`3px solid ${u.border}`,
                        borderRadius:11, padding:18, animation:"fadeIn .3s ease" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                          <span style={{ fontSize:13, fontWeight:700 }}>{g.title}</span>
                          <span style={{ background:u.bg, border:`1px solid ${u.border}`, color:u.text,
                            borderRadius:4, padding:"2px 7px", fontSize:9, fontWeight:700,
                            fontFamily:"'DM Mono',monospace" }}>{g.urgency?.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize:12, color:"#f0a0a0", marginBottom:8 }}>{g.gap_note}</div>
                        <div style={{ fontSize:10, color:"#5a6475", fontFamily:"'DM Mono',monospace" }}>
                          Deadline: {g.deadline||"TBD"} · {g.date_published}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "digest" && (
                <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)",
                  borderRadius:12, padding:24, animation:"fadeIn .3s ease" }}>
                  <div style={{ borderBottom:"2px solid #c9a84c", paddingBottom:14, marginBottom:18 }}>
                    <div style={{ fontSize:10, color:"#c9a84c", fontFamily:"'DM Mono',monospace",
                      marginBottom:4, letterSpacing:"0.1em" }}>WEEKLY REGULATORY DIGEST PREVIEW</div>
                    <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>NAICOM Compliance Brief</div>
                    <div style={{ fontSize:11, color:"#7a8394" }}>
                      Consolidated Hallmark Group · Week ending {new Date().toDateString()}
                    </div>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#c9a84c", marginBottom:6,
                      fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>EXECUTIVE SUMMARY</div>
                    <p style={{ fontSize:12, color:"#b0b8c8", lineHeight:1.8 }}>
                      This week's NAICOM monitoring identified{" "}
                      <strong style={{color:"#ef4444"}}>{stats?.critical_count||0} critical</strong> and{" "}
                      <strong style={{color:"#f59e0b"}}>{stats?.gap_count||0} gap-flagged</strong> regulatory items.
                      Overall compliance posture:{" "}
                      <strong style={{color: avgScore>=80?"#6ee7b7":"#f59e0b"}}>{avgScore}%</strong>.
                    </p>
                  </div>
                  {gaps.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#f59e0b", marginBottom:6,
                        fontFamily:"'DM Mono',monospace" }}>◈ OPEN GAPS</div>
                      {gaps.slice(0,3).map(g => (
                        <div key={g.item_hash} style={{ fontSize:12, padding:"8px 12px",
                          background:"rgba(245,158,11,.05)", borderRadius:7, marginBottom:6,
                          borderLeft:"3px solid #f59e0b", color:"#d4a84b" }}>
                          {g.title} — <span style={{color:"#b0b8c8"}}>{g.gap_note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ background:"rgba(201,168,76,.06)", border:"1px solid rgba(201,168,76,.2)",
                    borderRadius:8, padding:12, fontSize:10, color:"#7a8394",
                    fontFamily:"'DM Mono',monospace" }}>
                    Click "Send Digest" above to dispatch this report to {Object.keys(DEPARTMENT_RECIPIENTS||{}).length || 6} departments via SendGrid.
                  </div>
                </div>
              )}
            </div>

            {/* Right: Dept Scorecards */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#7a8394", letterSpacing:"0.08em",
                fontFamily:"'DM Mono',monospace", marginBottom:12 }}>DEPARTMENT COMPLIANCE SCORES</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {depts.map((d,i) => (
                  <div key={d.dept} style={{ background:"rgba(255,255,255,.03)",
                    border:"1px solid rgba(255,255,255,.07)", borderRadius:10,
                    padding:"12px 14px", display:"flex", alignItems:"center", gap:12,
                    animation:`fadeIn .3s ease ${i*.05}s both` }}>
                    <ScoreRing score={d.score}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, marginBottom:1 }}>{d.dept}</div>
                      <div style={{ fontSize:10, color:"#5a6475", fontFamily:"'DM Mono',monospace" }}>{d.contact}</div>
                      {d.open_items > 0 && (
                        <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:3,
                          background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)",
                          borderRadius:4, padding:"2px 6px", fontSize:9, color:"#f59e0b",
                          fontFamily:"'DM Mono',monospace" }}>
                          {d.open_items} open item{d.open_items>1?"s":""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:18, background:"rgba(255,255,255,.03)",
                border:"1px solid rgba(255,255,255,.07)", borderRadius:10, padding:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#7a8394", fontFamily:"'DM Mono',monospace",
                  letterSpacing:"0.06em", marginBottom:12 }}>AUTOMATION SCHEDULE</div>
                {[["NAICOM Scrape","Daily 06:00 WAT"],["Gap Analysis","Daily 06:05 WAT"],
                  ["Dept. Alerts","On detection"],["Weekly Digest","Mon 08:00 WAT"]].map(([l,f],i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"7px 0", borderBottom:i<3?"1px solid rgba(255,255,255,.05)":"none" }}>
                    <span style={{ fontSize:11, fontWeight:500 }}>{l}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:9, color:"#5a6475", fontFamily:"'DM Mono',monospace" }}>{f}</span>
                      <span style={{ width:5, height:5, borderRadius:"50%", background:"#6ee7b7",
                        display:"inline-block", animation:"pulse 2s infinite" }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("chh_token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem("chh_token"); return null; }
      return payload.sub;
    } catch { return null; }
  });

  const logout = () => { localStorage.removeItem("chh_token"); setUser(null); };

  if (!user) return <LoginScreen onLogin={setUser}/>;
  return <Dashboard username={user} onLogout={logout}/>;
}
