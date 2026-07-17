import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  Plus, Trash2, Check, ChevronLeft, ChevronRight, Flame, Copy, Trophy,
  Repeat, Sun, Moon, Settings, Settings2, X, StickyNote, Pencil, LogIn, LogOut, Cloud, CloudOff,
} from "lucide-react";
import { useCloudData } from "./useCloudData";

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const todayKey = () => keyOf(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FREQ_LABEL = { daily: "every day", weekly: "every week", monthly: "every month" };

/* ---------- palettes ---------- */
const SWATCHES = [
  "#D9663B","#4E9B5D","#8A5FBF","#3E92B8","#D9A63E","#B0507A",
  "#2FA88C","#C2483F","#4667B0","#8FA83E","#C99A2E","#6B6B6B",
];
const DEFAULT_CATS = [
  { id: "gym", name: "Gym", color: "#C2483F" },
  { id: "reading", name: "Reading", color: "#4E9B5D" },
  { id: "journaling", name: "Journaling", color: "#8A5FBF" },
];

/* ---------- greeting ---------- */
function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const label = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" }[part];
  return `${label}, ${name}`;
}

const emptyDay = () => ({ tasks: [], rdone: {}, rskip: {}, rnotes: {} });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* does a recurring rule apply on day k? */
function ruleApplies(rule, k) {
  if (k < rule.start) return false;
  const d = fromKey(k);
  if (rule.freq === "daily") return true;
  const s = fromKey(rule.start);
  if (rule.freq === "weekly") return d.getDay() === s.getDay();
  if (rule.freq === "monthly") {
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const target = Math.min(s.getDate(), dim);
    return d.getDate() === target;
  }
  return false;
}

const INITIAL_DATA = { days: {}, categories: DEFAULT_CATS, recurring: [], theme: "light" };

export default function HabitTracker() {
  const { user, data, setData, ready: loaded, signIn, signOut } = useCloudData(INITIAL_DATA);
  const [selected, setSelected] = useState(todayKey());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [newTask, setNewTask] = useState("");
  const [newCat, setNewCat] = useState(DEFAULT_CATS[0].id);
  const [newFreq, setNewFreq] = useState("once");
  const [addingCat, setAddingCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [openTask, setOpenTask] = useState(null); // id of task expanded for editing
  const [composing, setComposing] = useState(false); // add-task form visibility
  const [menuOpen, setMenuOpen] = useState(false); // settings dropdown
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'cat'|'rule', id }


  const dark = data.theme === "dark";
  const catById = useMemo(() => Object.fromEntries(data.categories.map((c) => [c.id, c])), [data.categories]);

  /* ---------- resolve a day's full task list (one-offs + recurring) ---------- */
  const tasksFor = (k) => {
    const day = data.days[k] || emptyDay();
    const rec = data.recurring
      .filter((r) => ruleApplies(r, k) && !day.rskip[r.id])
      .map((r) => ({ id: "r:" + r.id, text: r.text, cat: r.cat, done: !!day.rdone[r.id], notes: day.rnotes[r.id] || "", recurring: r.freq }));
    return [...rec, ...day.tasks];
  };
  const pctOf = (k) => {
    const ts = tasksFor(k);
    if (!ts.length) return null;
    return ts.filter((t) => t.done).length / ts.length;
  };

  const dayTasks = tasksFor(selected);
  const dayDone = dayTasks.filter((t) => t.done).length;
  const dayPct = dayTasks.length ? dayDone / dayTasks.length : 0;

  /* ---------- streaks & totals ---------- */
  const { streaks, totals } = useMemo(() => {
    const tk = todayKey();
    const isFull = (k) => { const ts = tasksFor(k); return ts.length > 0 && ts.every((t) => t.done); };
    let cur = 0, cursor = new Date();
    if (!isFull(tk)) cursor = addDays(cursor, -1);
    while (isFull(keyOf(cursor))) { cur++; cursor = addDays(cursor, -1); }
    let best = 0, run = 0, done = 0, all = 0, tracked = 0;
    for (let i = 365; i >= 0; i--) {
      const k = keyOf(addDays(new Date(), -i));
      if (k > tk) break;
      const ts = tasksFor(k);
      if (ts.length) { tracked++; all += ts.length; done += ts.filter((t) => t.done).length; }
      if (ts.length && ts.every((t) => t.done)) { run++; best = Math.max(best, run); } else run = 0;
    }
    return { streaks: { cur, best }, totals: { done, all, pct: all ? done / all : 0, tracked } };
  }, [data]);

  /* ---------- chart data ---------- */
  const stacked14 = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const row = { label: `${d.getDate()}/${d.getMonth() + 1}` };
      for (const t of tasksFor(keyOf(d))) if (t.done) row[t.cat] = (row[t.cat] || 0) + 1;
      out.push(row);
    }
    return out;
  }, [data]);

  const catWindow = useMemo(() => {
    const tk = todayKey();
    return data.categories.map((c) => {
      let done = 0, all = 0;
      const strip = [];
      for (let i = 27; i >= 0; i--) {
        const k = keyOf(addDays(new Date(), -i));
        const ts = tasksFor(k).filter((t) => t.cat === c.id);
        const d = ts.filter((t) => t.done).length;
        all += ts.length; done += d;
        strip.push({ k, has: ts.length > 0, ratio: ts.length ? d / ts.length : 0, past: k <= tk });
      }
      return { ...c, done, all, pct: all ? done / all : 0, strip };
    }).filter((c) => c.all > 0);
  }, [data]);

  const radarData = useMemo(
    () => catWindow.map((c) => ({ name: c.name, pct: Math.round(c.pct * 100) })),
    [catWindow]
  );

  /* ---------- mutations ---------- */
  const mutateDay = (k, fn) =>
    setData((d) => ({ ...d, days: { ...d.days, [k]: fn(d.days[k] ? { ...emptyDay(), ...d.days[k] } : emptyDay()) } }));

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    if (newFreq === "once") {
      mutateDay(selected, (day) => ({ ...day, tasks: [...day.tasks, { id: uid(), text, cat: newCat, done: false, notes: "" }] }));
    } else {
      setData((d) => ({ ...d, recurring: [...d.recurring, { id: uid(), text, cat: newCat, freq: newFreq, start: selected }] }));
    }
    setNewTask("");
  };

  const toggleTask = (t) => {
    if (t.id.startsWith("r:")) {
      const rid = t.id.slice(2);
      mutateDay(selected, (day) => ({ ...day, rdone: { ...day.rdone, [rid]: !day.rdone[rid] } }));
    } else {
      mutateDay(selected, (day) => ({ ...day, tasks: day.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }));
    }
  };

  const deleteTask = (t) => {
    if (t.id.startsWith("r:")) {
      const rid = t.id.slice(2);
      mutateDay(selected, (day) => ({ ...day, rskip: { ...day.rskip, [rid]: true } }));
    } else {
      mutateDay(selected, (day) => ({ ...day, tasks: day.tasks.filter((x) => x.id !== t.id) }));
    }
    if (openTask === t.id) setOpenTask(null);
  };

  const editTaskText = (t, text) => {
    if (t.id.startsWith("r:")) {
      const rid = t.id.slice(2);
      setData((d) => ({ ...d, recurring: d.recurring.map((r) => (r.id === rid ? { ...r, text } : r)) }));
    } else {
      mutateDay(selected, (day) => ({ ...day, tasks: day.tasks.map((x) => (x.id === t.id ? { ...x, text } : x)) }));
    }
  };
  const editTaskCat = (t, cat) => {
    if (t.id.startsWith("r:")) {
      const rid = t.id.slice(2);
      setData((d) => ({ ...d, recurring: d.recurring.map((r) => (r.id === rid ? { ...r, cat } : r)) }));
    } else {
      mutateDay(selected, (day) => ({ ...day, tasks: day.tasks.map((x) => (x.id === t.id ? { ...x, cat } : x)) }));
    }
  };
  const editTaskNotes = (t, notes) => {
    if (t.id.startsWith("r:")) {
      const rid = t.id.slice(2);
      mutateDay(selected, (day) => ({ ...day, rnotes: { ...day.rnotes, [rid]: notes } }));
    } else {
      mutateDay(selected, (day) => ({ ...day, tasks: day.tasks.map((x) => (x.id === t.id ? { ...x, notes } : x)) }));
    }
  };

  const deleteRuleNow = (id) => { setData((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== id) })); setConfirmDelete(null); };

  const copyYesterday = () => {
    const yk = keyOf(addDays(fromKey(selected), -1));
    const ys = (data.days[yk] || emptyDay()).tasks;
    if (!ys.length) return;
    mutateDay(selected, (day) => ({ ...day, tasks: ys.map((t) => ({ ...t, id: uid(), done: false })) }));
  };

  const addCategory = () => {
    const name = catName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + uid().slice(-4);
    const color = SWATCHES[data.categories.length % SWATCHES.length];
    setData((d) => ({ ...d, categories: [...d.categories, { id, name, color }] }));
    setNewCat(id); setCatName(""); setAddingCat(false);
  };
  const recolorCategory = (id, color) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, color } : c)) }));
  const renameCategory = (id, name) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) }));
  const deleteCategoryNow = (id) => {
    const remaining = data.categories.filter((c) => c.id !== id);
    setData((d) => ({ ...d, categories: remaining }));
    if (newCat === id) setNewCat(remaining[0]?.id || "");
    setConfirmDelete(null);
  };

  /* ---------- calendar grid ---------- */
  const grid = useMemo(() => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(keyOf(new Date(y, m, d)));
    return cells;
  }, [viewDate]);

  const tk = todayKey();
  const selDate = fromKey(selected);
  const isToday = selected === tk;
  const yesterdayHad = (data.days[keyOf(addDays(selDate, -1))] || emptyDay()).tasks.length > 0;

  const statusOf = (k) => {
    const p = pctOf(k);
    if (p === null) return "none"; // no tasks scheduled at all
    if (k > tk) return "planned";
    if (p === 1) return "full";
    if (p > 0) return "part";
    return "zero"; // tasks exist, none done — including today
  };

  if (!loaded) return <div className="ht-root"><style>{CSS}</style><div className="ht-loading">Opening your ledger…</div></div>;

  return (
    <div className={"ht-root" + (dark ? " dark" : "")}>
      <style>{CSS}</style>

      <header className="ht-head">
        <div className="ht-head-titles">
          <h1>{greeting("Veronika")}</h1>
          <span className="ht-eyebrow">Daily Ledger</span>
        </div>
        <div className="ht-head-stats">
          <span className="ht-chip"><Flame size={14} /> {streaks.cur} day streak</span>
          <span className="ht-chip ht-chip-soft"><Trophy size={14} /> best {streaks.best}</span>
          <button className="ht-iconbtn" onClick={() => setData((d) => ({ ...d, theme: dark ? "light" : "dark" }))} aria-label="Toggle dark mode">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="ht-settings-wrap">
            <button className="ht-iconbtn" onClick={() => { setMenuOpen(!menuOpen); setConfirmSignOut(false); }} aria-label="Settings">
              <Settings size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="ht-menu-backdrop" onClick={() => { setMenuOpen(false); setConfirmSignOut(false); }} />
                <div className="ht-menu">
                  {user ? (
                    <>
                      <div className="ht-menu-user">
                        {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                        <div>
                          <strong>{user.displayName || "Signed in"}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                      <div className="ht-menu-sync"><Cloud size={13} /> Synced across devices</div>
                      {!confirmSignOut ? (
                        <button className="ht-menu-btn" onClick={() => setConfirmSignOut(true)}>
                          <LogOut size={14} /> Sign out
                        </button>
                      ) : (
                        <div className="ht-menu-confirm">
                          <span>Sign out?</span>
                          <button className="ht-confirm-yes" onClick={() => { signOut(); setMenuOpen(false); setConfirmSignOut(false); }}>Sign out</button>
                          <button className="ht-confirm-no" onClick={() => setConfirmSignOut(false)}>Cancel</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="ht-menu-sync"><CloudOff size={13} /> Not synced — data stays on this device</div>
                      <button className="ht-menu-btn" onClick={() => { signIn(); setMenuOpen(false); }}>
                        <LogIn size={14} /> Sign in with Google
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="ht-main">
        {/* ---------- calendar ---------- */}
        <section className="ht-card ht-cal">
          <div className="ht-cal-nav">
            <button className="ht-iconbtn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="ht-cal-title">{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button className="ht-iconbtn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="ht-grid ht-grid-head">
            {DOW.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="ht-grid">
            {grid.map((k, i) => {
              if (!k) return <span key={i} />;
              const st = statusOf(k);
              const cls = ["ht-day", "st-" + st];
              if (k === selected) cls.push("sel");
              if (k === tk) cls.push("today");
              return (
                <button key={k} className={cls.join(" ")} onClick={() => setSelected(k)}>
                  <span className="ht-day-num">{Number(k.slice(-2))}</span>
                  {st === "full" && <span className="ht-day-check"><Check size={9} strokeWidth={3.5} /></span>}
                </button>
              );
            })}
          </div>
          <div className="ht-legend">
            <span><i className="lg lg-full" /> all done</span>
            <span><i className="lg lg-part" /> partly done</span>
            <span><i className="lg lg-zero" /> nothing done</span>
            <span><i className="lg lg-planned" /> planned</span>
          </div>
        </section>

        {/* ---------- day panel ---------- */}
        <section className="ht-card ht-daypanel">
          <div className="ht-day-head">
            <h2>{isToday ? "Today" : `${selDate.getDate()} ${MONTHS[selDate.getMonth()]}`}</h2>
            <span className="ht-day-count">{dayTasks.length ? `${dayDone} / ${dayTasks.length} done` : "no tasks yet"}</span>
          </div>

          {dayTasks.length > 0 && (
            <div className="ht-bar"><div className="ht-bar-fill" style={{ width: `${dayPct * 100}%` }} /></div>
          )}

          <ul className="ht-tasks">
            {dayTasks.map((t) => {
              const c = catById[t.cat];
              const open = openTask === t.id;
              return (
                <li key={t.id} className={(t.done ? "done " : "") + (open ? "open" : "")}>
                  <div className="ht-task-row">
                    <button className="ht-check" style={{ borderColor: c?.color || "#999", background: t.done ? (c?.color || "#999") : "transparent" }} onClick={() => toggleTask(t)} aria-label={t.done ? "Mark as not done" : "Mark as done"}>
                      {t.done && <Check size={12} strokeWidth={3.5} color="var(--card)" />}
                    </button>
                    <button className="ht-task-text" onClick={() => setOpenTask(open ? null : t.id)}>
                      <span>{t.text}</span>
                      {t.recurring && <Repeat size={11} className="ht-rep" title={FREQ_LABEL[t.recurring]} />}
                      {t.notes && <StickyNote size={11} className="ht-rep" />}
                    </button>
                    <span className="ht-cat-tag" style={{ color: c?.color || "#888" }}>{c?.name || "—"}</span>
                    <button className="ht-del" onClick={() => setOpenTask(open ? null : t.id)} aria-label="Edit task"><Pencil size={13} /></button>
                    <button className="ht-del" onClick={() => deleteTask(t)} aria-label={t.recurring ? "Remove from this day" : "Delete task"} title={t.recurring ? "Removes it from this day only" : "Delete"}><Trash2 size={13} /></button>
                  </div>

                  {open && (
                    <div className="ht-task-edit">
                      <input
                        value={t.text}
                        onChange={(e) => editTaskText(t, e.target.value)}
                        placeholder="Task name"
                      />
                      <div className="ht-edit-cats">
                        {data.categories.map((cc) => (
                          <button key={cc.id} className={"ht-catpick" + (t.cat === cc.id ? " on" : "")}
                            style={t.cat === cc.id ? { background: cc.color, borderColor: cc.color, color: "var(--card)" } : { borderColor: cc.color, color: cc.color }}
                            onClick={() => editTaskCat(t, cc.id)}>
                            {cc.name}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={t.notes}
                        onChange={(e) => editTaskNotes(t, e.target.value)}
                        placeholder="Notes — how did it go, details, reminders…"
                        rows={3}
                      />
                      <button className="ht-donebtn" onClick={() => setOpenTask(null)}>Done editing</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {dayTasks.length === 0 && (
            <p className="ht-empty ht-noTasks">Nothing on the list for this day{isToday ? " yet" : ""}.</p>
          )}

          {dayTasks.length === 0 && yesterdayHad && (
            <button className="ht-ghostbtn" onClick={copyYesterday}><Copy size={13} /> Copy yesterday's tasks</button>
          )}

          {!composing ? (
            <button className="ht-composeopen" onClick={() => setComposing(true)}>
              <Plus size={15} /> Add a task
            </button>
          ) : (
          <div className="ht-add">
            <div className="ht-add-head">
              <span>New task</span>
              <button className="ht-del" style={{ opacity: 1 }} onClick={() => setComposing(false)} aria-label="Close"><X size={14} /></button>
            </div>
            <div className="ht-add-row">
              <input
                autoFocus
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); if (e.key === "Escape") setComposing(false); }}
                placeholder="What needs doing?"
              />
              <button className="ht-addbtn" onClick={addTask} aria-label="Add task"><Plus size={16} /></button>
            </div>

            <div className="ht-freqs">
              {["once", "daily", "weekly", "monthly"].map((f) => (
                <button key={f} className={"ht-freq" + (newFreq === f ? " on" : "")} onClick={() => setNewFreq(f)}>
                  {f !== "once" && <Repeat size={11} />} {f}
                </button>
              ))}
              {newFreq === "weekly" && <span className="ht-freq-hint">every {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][selDate.getDay()]}</span>}
              {newFreq === "monthly" && <span className="ht-freq-hint">every {selDate.getDate()}. of the month</span>}
            </div>

            <div className="ht-cats">
              {data.categories.map((c) => (
                <button key={c.id} className={"ht-catpick" + (newCat === c.id ? " on" : "")}
                  style={newCat === c.id ? { background: c.color, borderColor: c.color, color: "var(--card)" } : { borderColor: c.color, color: c.color }}
                  onClick={() => setNewCat(c.id)}>
                  {c.name}
                </button>
              ))}
              {addingCat ? (
                <span className="ht-newcat">
                  <input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setAddingCat(false); }}
                    placeholder="Category name" />
                  <button className="ht-addbtn sm" onClick={addCategory}><Check size={13} /></button>
                </span>
              ) : (
                <button className="ht-catpick dashed" onClick={() => setAddingCat(true)}><Plus size={12} /> new</button>
              )}
            </div>
          </div>
          )}

          <div className="ht-panels">
            <button className="ht-rulestoggle" onClick={() => { setShowRules(!showRules); setShowCats(false); }}>
              <Settings2 size={13} /> Repeating tasks ({data.recurring.length})
            </button>
            <button className="ht-rulestoggle" onClick={() => { setShowCats(!showCats); setShowRules(false); }}>
              <Settings2 size={13} /> Categories ({data.categories.length})
            </button>
          </div>

          {showRules && (
            <ul className="ht-rules">
              {data.recurring.length === 0 && <li className="ht-empty">Nothing repeats yet — pick daily, weekly or monthly when adding a task.</li>}
              {data.recurring.map((r) => {
                const confirming = confirmDelete?.kind === "rule" && confirmDelete.id === r.id;
                return (
                  <li key={r.id}>
                    {confirming ? (
                      <span className="ht-confirm">
                        <span>Stop "{r.text}"?</span>
                        <button className="ht-confirm-yes" onClick={() => deleteRuleNow(r.id)}>Delete</button>
                        <button className="ht-confirm-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </span>
                    ) : (
                      <>
                        <span className="ht-dot" style={{ background: catById[r.cat]?.color || "#888" }} />
                        <span className="ht-rule-text">{r.text}</span>
                        <span className="ht-rule-freq">{FREQ_LABEL[r.freq]}</span>
                        <button className="ht-del" onClick={() => setConfirmDelete({ kind: "rule", id: r.id })} aria-label="Stop repeating" title="Stops it from all future days"><X size={13} /></button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {showCats && (
            <div className="ht-catmanage-scroll">
              <ul className="ht-rules ht-catmanage">
                {data.categories.map((c) => {
                  const confirming = confirmDelete?.kind === "cat" && confirmDelete.id === c.id;
                  return (
                    <li key={c.id}>
                      {confirming ? (
                        <span className="ht-confirm">
                          <span>Delete "{c.name}"?</span>
                          <button className="ht-confirm-yes" onClick={() => deleteCategoryNow(c.id)}>Delete</button>
                          <button className="ht-confirm-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </span>
                      ) : (
                        <>
                          <input className="ht-catname" value={c.name} onChange={(e) => renameCategory(c.id, e.target.value)} />
                          <span className="ht-swatches">
                            {SWATCHES.map((sw) => (
                              <button key={sw} className={"ht-swatch" + (c.color === sw ? " on" : "")} style={{ background: sw }} onClick={() => recolorCategory(c.id, sw)} aria-label={`Set ${c.name} to ${sw}`} />
                            ))}
                          </span>
                          <button className="ht-del" onClick={() => setConfirmDelete({ kind: "cat", id: c.id })} aria-label={`Delete ${c.name}`} title="Delete category"><Trash2 size={13} /></button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* ---------- progress ---------- */}
        <section className="ht-card ht-stats">
          <h2>Progress</h2>

          <div className="ht-totals">
            <div><strong>{totals.done}</strong><span>tasks completed</span></div>
            <div><strong>{Math.round(totals.pct * 100)}%</strong><span>overall completion</span></div>
            <div><strong>{totals.tracked}</strong><span>days tracked</span></div>
          </div>

          <div className="ht-charts">
            <div className="ht-chartbox">
              <h3>Completed tasks · last 14 days</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={stacked14} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--sub)" }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--sub)" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "rgba(128,128,128,0.08)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
                    formatter={(v, name) => [v, catById[name]?.name || name]} />
                  {data.categories.map((c) => (
                    <Bar key={c.id} dataKey={c.id} stackId="a" fill={c.color} radius={[0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ht-chartbox">
              <h3>Category balance · last 28 days</h3>
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={190}>
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="var(--line)" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--sub)" }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="pct" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.32} />
                    <Tooltip formatter={(v) => [`${v}%`, "completed"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="ht-empty" style={{ marginTop: 20 }}>The balance wheel appears once at least three categories have tasks.</p>
              )}
            </div>
          </div>

          <h3>Consistency by category · last 28 days</h3>
          {catWindow.length === 0 && <p className="ht-empty">Complete a few tasks and your categories will show up here.</p>}
          <ul className="ht-catstats">
            {catWindow.map((c) => (
              <li key={c.id}>
                <span className="ht-catstat-name"><span className="ht-dot" style={{ background: c.color }} />{c.name}</span>
                <span className="ht-strip">
                  {c.strip.map((cell) => (
                    <i key={cell.k}
                      className={cell.k === tk ? "td" : ""}
                      style={{
                        background: cell.has ? c.color : "transparent",
                        opacity: cell.has ? (cell.past ? 0.18 + cell.ratio * 0.82 : 0.15) : 1,
                      }}
                      title={`${cell.k}${cell.has ? ` · ${Math.round(cell.ratio * 100)}%` : ""}`}
                    />
                  ))}
                </span>
                <span className="ht-catstat-num">{Math.round(c.pct * 100)}% · {c.done}/{c.all}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.ht-root{
  --paper:#EDECE6; --card:#F9F8F4; --cell:#FFFFFF; --ink:#26241F; --sub:#847F70;
  --line:#DBD7C9; --accent:#37352C; --accent-ink:#F9F8F4;
  --ok:#5FB558; --ok-ink:#FFFFFF; --warn:#F0A020; --warn-ink:#402400; --bad:#E4523F; --bad-ink:#FFFFFF;
  --plan:#E3E1D3;
  min-height:100vh; background:var(--paper); color:var(--ink);
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding:20px 16px 40px; transition:background .25s, color .25s;
}
.ht-root.dark{
  --paper:#121212; --card:#1B1B1A; --cell:#212120; --ink:#E9E7E0; --sub:#8F8B81;
  --line:#333230; --accent:#D8D5CB; --accent-ink:#161615;
  --ok:#4CAF45; --ok-ink:#0B1E08; --warn:#E0941C; --warn-ink:#2A1800; --bad:#D6543F; --bad-ink:#280C06;
  --plan:#3B3B37;
}
.ht-root *{box-sizing:border-box; margin:0}
.ht-loading{padding:60px; text-align:center; color:var(--sub); font-style:italic}
.ht-head{max-width:1060px; margin:0 auto 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px}
.ht-head-titles{display:flex; flex-direction:column; gap:2px}
.ht-head h1{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; font-size:26px; font-weight:600; letter-spacing:.2px}
.ht-eyebrow{font-size:11px; text-transform:uppercase; letter-spacing:1.6px; color:var(--sub)}
.ht-head-stats{display:flex; gap:8px; align-items:center}
.ht-chip{display:inline-flex; align-items:center; gap:5px; font-size:12.5px; font-weight:600; background:var(--accent); color:var(--accent-ink); padding:5px 11px; border-radius:999px}
.ht-chip-soft{background:transparent; color:var(--accent); border:1px solid var(--accent)}
.ht-settings-wrap{position:relative}
.ht-menu-backdrop{position:fixed; inset:0; z-index:40}
.ht-menu{position:absolute; right:0; top:34px; z-index:41; min-width:230px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px; box-shadow:0 8px 28px rgba(0,0,0,.14); display:flex; flex-direction:column; gap:8px}
.ht-menu-user{display:flex; align-items:center; gap:9px}
.ht-menu-user img{width:32px; height:32px; border-radius:50%}
.ht-menu-user div{display:flex; flex-direction:column; min-width:0}
.ht-menu-user strong{font-size:13px}
.ht-menu-user span{font-size:11.5px; color:var(--sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.ht-menu-sync{display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--sub); border-top:1px solid var(--line); padding-top:8px}
.ht-menu > .ht-menu-sync:first-child{border-top:none; padding-top:0}
.ht-menu-btn{display:flex; align-items:center; gap:7px; border:1px solid var(--line); background:transparent; color:var(--ink); font-size:13px; font-weight:600; padding:8px 11px; border-radius:9px; cursor:pointer; font-family:inherit}
.ht-menu-btn:hover{background:var(--paper)}
.ht-menu-confirm{display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600}
.ht-menu-confirm span{flex:1}
.ht-main{max-width:1060px; margin:0 auto; display:grid; grid-template-columns:minmax(300px,380px) 1fr; gap:14px; align-items:start}
.ht-card{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; transition:background .25s, border-color .25s}
.ht-stats{grid-column:1 / -1}
@media (max-width:760px){ .ht-main{grid-template-columns:1fr} .ht-stats{grid-column:auto} }

/* calendar */
.ht-cal-nav{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px}
.ht-cal-title{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; font-size:16px; font-weight:600}
.ht-iconbtn{border:1px solid var(--line); background:transparent; color:var(--ink); border-radius:8px; width:28px; height:28px; padding:0; line-height:0; display:grid; place-items:center; cursor:pointer}
.ht-iconbtn svg{display:block}
.ht-iconbtn:hover{background:var(--paper)}
.ht-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:5px}
.ht-grid-head{margin-bottom:5px}
.ht-grid-head span{font-size:10px; text-transform:uppercase; letter-spacing:.8px; color:var(--sub); text-align:center}
.ht-day{position:relative; aspect-ratio:1; border:1px solid var(--line); border-radius:9px; background:var(--cell); cursor:pointer; padding:0; transition:background .2s}
.ht-day-num{position:relative; font-size:12px; font-weight:600; color:var(--ink)}
.ht-day.st-full{background:var(--ok); border-color:transparent}
.ht-day.st-full .ht-day-num{color:var(--ok-ink)}
.ht-day.st-part{background:var(--warn); border-color:transparent}
.ht-day.st-part .ht-day-num{color:var(--warn-ink)}
.ht-day.st-zero{background:var(--bad); border-color:transparent}
.ht-day.st-zero .ht-day-num{color:var(--bad-ink)}
.ht-day.st-planned{background:var(--plan)}
.ht-day.today{box-shadow:inset 0 0 0 1.5px var(--accent)}
.ht-day.sel{outline:2px solid var(--accent); outline-offset:1px}
.ht-day-check{position:absolute; top:2px; right:3px; color:var(--ok-ink)}
.ht-day:focus-visible{outline:2px solid var(--ink)}
.ht-legend{display:flex; flex-wrap:wrap; gap:12px; font-size:11px; color:var(--sub); margin-top:12px}
.ht-legend span{display:inline-flex; align-items:center; gap:5px}
.lg{width:11px; height:11px; border-radius:3px; display:inline-block}
.lg-full{background:var(--ok)} .lg-part{background:var(--warn)} .lg-zero{background:var(--bad)} .lg-planned{background:var(--plan); border:1px solid var(--line)}

/* day panel */
.ht-day-head{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px}
.ht-daypanel h2,.ht-stats h2{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; font-size:19px; font-weight:600}
.ht-day-count{font-size:12.5px; color:var(--sub)}
.ht-bar{height:6px; background:var(--paper); border-radius:99px; overflow:hidden; margin-bottom:12px}
.ht-bar-fill{height:100%; background:var(--accent); border-radius:99px; transition:width .3s ease}
.ht-tasks{list-style:none; padding:0; display:flex; flex-direction:column; gap:2px}
.ht-tasks li{border-radius:9px}
.ht-tasks li:hover, .ht-tasks li.open{background:var(--paper)}
.ht-task-row{display:flex; align-items:center; gap:10px; padding:8px 6px}
.ht-tasks li.done .ht-task-text span:first-child{text-decoration:line-through; color:var(--sub)}
.ht-check{width:20px; height:20px; min-width:20px; padding:0; line-height:0; border-radius:6px; border:2px solid; cursor:pointer; display:grid; place-items:center; transition:background .15s}
.ht-check svg{display:block}
.ht-task-text{flex:1; font-size:14.5px; display:flex; align-items:center; gap:6px; background:none; border:none; padding:0; text-align:left; cursor:pointer; color:var(--ink); font-family:inherit; min-width:0}
.ht-task-text span:first-child{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.ht-rep{color:var(--sub); flex:none}
.ht-cat-tag{font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; flex:none}
.ht-del{border:none; background:none; color:var(--sub); cursor:pointer; opacity:.35; padding:3px; flex:none}
.ht-tasks li:hover .ht-del, .ht-tasks li.open .ht-del, .ht-rules li:hover .ht-del{opacity:1}
.ht-task-edit{padding:2px 6px 12px 36px; display:flex; flex-direction:column; gap:8px}
.ht-task-edit input, .ht-task-edit textarea{border:1px solid var(--line); background:var(--cell); border-radius:9px; padding:8px 10px; font-size:13.5px; color:var(--ink); outline:none; font-family:inherit; resize:vertical}
.ht-task-edit input:focus, .ht-task-edit textarea:focus{border-color:var(--accent)}
.ht-edit-cats{display:flex; flex-wrap:wrap; gap:6px}
.ht-donebtn{align-self:flex-end; border:none; background:var(--accent); color:var(--accent-ink); font-size:12px; font-weight:600; padding:6px 13px; border-radius:8px; cursor:pointer}
.ht-ghostbtn{display:inline-flex; align-items:center; gap:6px; margin-top:6px; border:1px dashed var(--line); background:transparent; color:var(--sub); font-size:12.5px; padding:7px 12px; border-radius:9px; cursor:pointer}
.ht-ghostbtn:hover{color:var(--ink); border-color:var(--sub)}
.ht-noTasks{margin:6px 0 2px}
.ht-composeopen{display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:14px; border:1px dashed var(--line); background:transparent; color:var(--sub); font-size:13px; font-weight:600; padding:10px; border-radius:10px; cursor:pointer; font-family:inherit}
.ht-composeopen:hover{color:var(--ink); border-color:var(--sub); background:var(--paper)}
.ht-add{margin-top:14px; background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:12px}
.ht-add-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:9px}
.ht-add-head span{font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--sub); font-weight:700}
.ht-add-row{display:flex; gap:8px}
.ht-add input, .ht-newcat input{flex:1; border:1px solid var(--line); background:var(--cell); border-radius:9px; padding:9px 12px; font-size:14px; color:var(--ink); outline:none; min-width:0; font-family:inherit}
.ht-add input:focus, .ht-newcat input:focus{border-color:var(--accent)}
.ht-addbtn{border:none; background:var(--accent); color:var(--accent-ink); width:38px; border-radius:9px; cursor:pointer; display:grid; place-items:center}
.ht-addbtn:hover{filter:brightness(1.1)}
.ht-addbtn.sm{width:30px; height:30px}
.ht-freqs{display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; align-items:center}
.ht-freq{display:inline-flex; align-items:center; gap:4px; border:1px solid var(--line); background:transparent; color:var(--sub); font-size:12px; font-weight:600; padding:4px 11px; border-radius:999px; cursor:pointer}
.ht-freq.on{background:var(--accent); border-color:var(--accent); color:var(--accent-ink)}
.ht-freq-hint{font-size:11.5px; color:var(--sub); font-style:italic}
.ht-cats{display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; align-items:center}
.ht-catpick{border:1.5px solid; background:transparent; font-size:12px; font-weight:600; padding:4px 11px; border-radius:999px; cursor:pointer}
.ht-catpick.dashed{border-style:dashed; border-color:var(--line); color:var(--sub); display:inline-flex; align-items:center; gap:3px}
.ht-newcat{display:inline-flex; gap:8px; align-items:center; flex-wrap:wrap}
.ht-newcat input{padding:5px 10px; font-size:12.5px; width:130px}
.ht-swatches{display:inline-flex; gap:4px; flex-wrap:wrap; max-width:170px}
.ht-swatch{width:16px; height:16px; border-radius:50%; border:2px solid transparent; cursor:pointer; padding:0}
.ht-swatch.on{border-color:var(--ink)}
.ht-panels{display:flex; gap:16px; margin-top:14px}
.ht-rulestoggle{display:inline-flex; align-items:center; gap:6px; border:none; background:none; color:var(--sub); font-size:12.5px; font-weight:600; cursor:pointer; padding:0}
.ht-rulestoggle:hover{color:var(--ink)}
.ht-rules{list-style:none; padding:8px 0 0; display:flex; flex-direction:column; gap:4px}
.ht-rules li{display:flex; align-items:center; gap:9px; font-size:13.5px; padding:5px 4px; border-radius:8px}
.ht-rules li:hover{background:var(--paper)}
.ht-rule-text{flex:1}
.ht-rule-freq{font-size:11px; color:var(--sub); font-style:italic}
.ht-catmanage-scroll{max-height:220px; overflow-y:auto; margin-top:2px}
.ht-catmanage li{gap:10px}
.ht-confirm{display:flex; align-items:center; gap:8px; width:100%; font-size:12.5px; color:var(--ink)}
.ht-confirm span:first-child{flex:1; font-weight:600}
.ht-confirm-yes{border:none; background:var(--bad); color:var(--bad-ink); font-size:11.5px; font-weight:700; padding:4px 10px; border-radius:7px; cursor:pointer}
.ht-confirm-no{border:1px solid var(--line); background:transparent; color:var(--sub); font-size:11.5px; font-weight:600; padding:4px 10px; border-radius:7px; cursor:pointer}
.ht-catname{flex:1; border:1px solid transparent; background:transparent; font-size:13.5px; color:var(--ink); padding:4px 6px; border-radius:6px; font-family:inherit}
.ht-catname:focus{border-color:var(--line); background:var(--cell); outline:none}

/* stats */
.ht-stats h3{font-size:11.5px; text-transform:uppercase; letter-spacing:1px; color:var(--sub); margin:16px 0 8px}
.ht-totals{display:flex; gap:26px; flex-wrap:wrap; margin-top:10px}
.ht-totals div{display:flex; flex-direction:column}
.ht-totals strong{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; font-size:26px; font-weight:600; color:var(--accent)}
.ht-totals span{font-size:12px; color:var(--sub)}
.ht-charts{display:grid; grid-template-columns:1fr 1fr; gap:18px}
@media (max-width:760px){ .ht-charts{grid-template-columns:1fr} }
.ht-empty{font-size:13px; color:var(--sub); font-style:italic}
.ht-catstats{list-style:none; padding:0; display:flex; flex-direction:column; gap:10px}
.ht-catstats li{display:grid; grid-template-columns:110px 1fr 90px; align-items:center; gap:12px}
@media (max-width:560px){ .ht-catstats li{grid-template-columns:90px 1fr 74px; gap:8px} }
.ht-catstat-name{display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600}
.ht-dot{width:9px; height:9px; min-width:9px; border-radius:50%}
.ht-strip{display:grid; grid-template-columns:repeat(28,1fr); gap:2px}
.ht-strip i{height:16px; border-radius:3px; border:1px solid var(--line); display:block}
.ht-strip i.td{box-shadow:inset 0 0 0 1.5px var(--accent)}
.ht-catstat-num{font-size:12px; color:var(--sub); text-align:right; white-space:nowrap}
@media (prefers-reduced-motion:reduce){ .ht-root *{transition:none !important} }
`;
