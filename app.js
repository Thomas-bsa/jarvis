import { understand, plan, findTask, dayKey, fromKey, addDays, toHHMM, sayDay, sayTime, sayDur, DEFAULT_WINDOWS, parseWindows, SUBJECTS, fold } from "./brain.js";

const $ = (id) => document.getElementById(id);
const KEY = "jarvis-planning-v1";
const COLORS = { Maths: "#5CE1FF", Physique: "#9D8CFF", SI: "#4BE3A6", Anglais: "#FFB547", "Français": "#FF9ECF", Info: "#7FB2FF", TIPE: "#FF7A7A", LV2: "#F3E37C", Sport: "#4BE3A6" };
const color = (s) => COLORS[s] || "#8A97A8";
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- état ---------- */
const fresh = () => ({ v: 1, tasks: [], busy: [], settings: { windows: { ...DEFAULT_WINDOWS }, maxBlock: 90, pause: 10, voice: true, convo: false, geminiKey: "", geminiModel: "gemini-2.5-flash" } });
let mem = null;
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tasks) { const f = fresh(); s.settings = { ...f.settings, ...s.settings, windows: { ...f.settings.windows, ...(s.settings || {}).windows } }; s.busy ||= []; return s; } } catch {}
  return mem || fresh();
}
let st = load();
let undoStack = [];
function save() { mem = st; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
function snapshot() { undoStack.push(JSON.stringify(st)); if (undoStack.length > 20) undoStack.shift(); }
const today = () => dayKey(new Date());

/* ---------- exécution des actions ---------- */
function blocksOf(id, P) { return P.blocks.filter((b) => b.taskId === id); }
function whereSaid(t, P) {
  const bs = blocksOf(t.id, P);
  const late = P.late.find((l) => l.taskId === t.id);
  let s = "";
  if (bs.length) {
    const byDay = [];
    for (const b of bs) { const g = byDay.find((x) => x.day === b.day); g ? g.t.push(sayTime(b.from)) : byDay.push({ day: b.day, t: [sayTime(b.from)] }); }
    const parts = byDay.slice(0, 3).map((g) => `${sayDay(g.day, today())} à ${g.t.length > 1 ? g.t.slice(0, -1).join(", ") + " et " + g.t.at(-1) : g.t[0]}`);
    s = bs.length === 1 ? ` Je l'ai mis ${parts[0]}.` : ` Je l'ai réparti en ${bs.length} séances : ${parts.join(", ")}${byDay.length > 3 ? "…" : "."}`;
  }
  if (late) s += ` Attention, il manque ${sayDur(late.missing)} : ${late.reason === "due" ? "pas assez de créneaux libres avant l'échéance" : late.reason === "day" ? "ce jour-là est déjà plein" : "pas de place dans les 2 semaines"}.`;
  return s;
}
function describeDay(k, P) {
  const bs = P.blocks.filter((b) => b.day === k);
  const busy = st.busy.filter((b) => b.day === k);
  if (!bs.length) return `Rien de prévu ${sayDay(k, today())}${busy.length ? " (tu as bloqué ce créneau)" : ""}.`;
  const items = bs.map((b) => { const t = st.tasks.find((x) => x.id === b.taskId); return `${sayTime(b.from)}, ${t.title}${b.fixed ? "" : ` pendant ${sayDur(b.to - b.from)}`}`; });
  const d = sayDay(k, today());
  return `${d[0].toUpperCase() + d.slice(1)} : ${items.join(" ; ")}.`;
}

function run(actions) {
  const out = [];
  let changed = false, canUndo = false;
  const T = today();
  const added = [];
  for (const a of actions) {
    switch (a.op) {
      case "add": {
        if (!canUndo) { snapshot(); canUndo = true; }
        const t = { id: uid(), title: a.title, subject: a.subject || null, kind: a.kind || null, minutes: Math.max(5, Math.round(a.minutes || 60)), due: a.due || null, day: a.day || null, time: a.time ?? null, part: a.part || null, doneMin: 0, done: false, created: Date.now() };
        st.tasks.push(t); added.push([t, a]); changed = true; break;
      }
      case "busy": {
        if (!canUndo) { snapshot(); canUndo = true; }
        st.busy.push({ id: uid(), day: a.day, from: a.from, to: a.to, label: a.label || "Indisponible" });
        const all = a.from === 0 && a.to >= 1440;
        out.push(`OK, je ne mets rien ${sayDay(a.day, T)}${all ? "" : ` entre ${sayTime(a.from)} et ${sayTime(a.to % 1440 || 1440)}`}.`);
        changed = true; break;
      }
      case "done": case "progress": case "delete": case "move": {
        const t = findTask(st.tasks.filter((x) => a.op === "delete" || !x.done), a.match || "");
        if (!t) { out.push(`Je n'ai pas trouvé de tâche qui corresponde à « ${a.match} ».`); break; }
        if (!canUndo) { snapshot(); canUndo = true; }
        if (a.op === "done") { t.done = true; t.doneAt = Date.now(); out.push(`Bravo, « ${t.title} » est terminé.`); }
        if (a.op === "progress") { t.doneMin = Math.min(t.minutes, (t.doneMin || 0) + a.minutes); if (t.doneMin >= t.minutes) t.done = true; out.push(t.done ? `« ${t.title} » est terminé, bien joué.` : `Noté, ${sayDur(a.minutes)} de faites sur « ${t.title} ». Il reste ${sayDur(t.minutes - t.doneMin)}.`); }
        if (a.op === "delete") { st.tasks = st.tasks.filter((x) => x !== t); out.push(`J'ai supprimé « ${t.title} ».`); }
        if (a.op === "move") { t.day = a.day; t.time = a.time ?? null; t.due = t.due && t.due < a.day ? null : t.due; added.push([t, { moved: true }]); }
        changed = true; break;
      }
      case "query": { out.push(describeDay(a.day, plan(st))); break; }
      case "week": {
        const P = plan(st), lines = [];
        for (let i = 0; i < 7; i++) { const k = addDays(T, i), bs = P.blocks.filter((b) => b.day === k); if (bs.length) lines.push(`${sayDay(k, T)} : ${sayDur(bs.reduce((s, b) => s + b.to - b.from, 0))} (${[...new Set(bs.map((b) => st.tasks.find((t) => t.id === b.taskId).title))].join(", ")})`); }
        out.push(lines.length ? `Ta semaine : ${lines.join(" ; ")}.` : "Ta semaine est vide pour l'instant. Dis-moi ce que tu as à faire."); break;
      }
      case "list": {
        const open = st.tasks.filter((t) => !t.done);
        out.push(open.length ? `Il te reste ${open.length} tâche${open.length > 1 ? "s" : ""} : ${open.map((t) => t.title).join(", ")}.` : "Tu n'as plus rien à faire. Profite !"); break;
      }
      case "undo": {
        if (undoStack.length) { st = JSON.parse(undoStack.pop()); save(); out.push("C'est annulé."); render(); } else out.push("Il n'y a rien à annuler.");
        break;
      }
      case "clearAsk": out.push("Pour tout effacer, utilise le bouton « Tout effacer » dans les réglages (la roue en haut à droite)."); break;
      case "help": out.push("Dis-moi ce que tu as à faire, avec une date et une durée si tu veux. Par exemple : « j'ai un DM de physique pour jeudi, 3 heures », « dentiste mardi à 17 h », « je ne suis pas dispo samedi matin », « qu'est-ce que je fais demain ? », « j'ai fini le DM ». Je range tout dans tes créneaux libres."); break;
      default: out.push("Je n'ai pas bien compris. Essaie par exemple : « j'ai un DM de maths pour vendredi, 2 heures » ou « qu'est-ce que je fais demain ? »");
    }
  }
  if (changed) save();
  if (added.length) {
    const P = plan(st);
    for (const [t, a] of added) {
      if (a.moved) { out.push(`J'ai déplacé « ${t.title} » à ${sayDay(t.day, T)}.${whereSaid(t, P)}`); continue; }
      let s = `C'est noté : ${t.title}`;
      if (t.time != null && t.day) s += `, ${sayDay(t.day, T)} à ${sayTime(t.time)}.`;
      else {
        s += ` (${sayDur(t.minutes)}${a.defaulted ? " estimées" : ""})`;
        if (t.due) s += `, à finir avant ${sayDay(t.due, T)}`;
        else if (t.day) s += `, ${sayDay(t.day, T)}`;
        s += "." + whereSaid(t, P);
      }
      out.push(s);
    }
  }
  if (changed) render();
  return { text: out.join("\n"), canUndo };
}

/* ---------- cerveau Gemini (facultatif) ---------- */
async function gemini(text) {
  const key = st.settings.geminiKey.trim();
  if (!key) return null;
  const T = today();
  const tasks = st.tasks.filter((t) => !t.done).map((t) => ({ titre: t.title, matiere: t.subject, minutes: t.minutes, avant: t.due, jour: t.day }));
  const prompt = `Tu es Jarvis, l'assistant de planning de Thomas, étudiant en prépa PTSI. Aujourd'hui : ${JOURS[new Date().getDay()]} ${T}.
Tâches en cours : ${JSON.stringify(tasks)}
Traduis sa phrase en actions JSON. Réponds UNIQUEMENT avec {"actions":[...]} où chaque action est l'une de :
{"op":"add","title":"intitulé court sans date ni durée","subject":"Maths|Physique|SI|Anglais|Français|Info|TIPE|LV2|Sport|null","minutes":nombre (estime si non dit : DM 180, révision DS 120, colle 60, exercices 60, cours 45),"due":"AAAA-MM-JJ ou null (à finir AVANT ce jour)","day":"AAAA-MM-JJ ou null (à faire CE jour)","time":"HH:MM ou null (heure fixe, rendez-vous)"}
{"op":"busy","day":"AAAA-MM-JJ","from":"HH:MM","to":"HH:MM","label":"..."}  (indisponibilité)
{"op":"done","match":"mots de la tâche"} | {"op":"progress","match":"...","minutes":n} | {"op":"delete","match":"..."} | {"op":"move","match":"...","day":"AAAA-MM-JJ","time":"HH:MM ou null"}
{"op":"query","day":"AAAA-MM-JJ"} | {"op":"week"} | {"op":"list"} | {"op":"help"} | {"op":"undo"}
Phrase de Thomas : ${JSON.stringify(text)}`;
  const call = async (model) => {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return JSON.parse(j.candidates[0].content.parts.map((p) => p.text).join(""));
    } finally { clearTimeout(timer); }
  };
  let res;
  try { res = await call(st.settings.geminiModel || "gemini-2.5-flash"); } catch { try { res = await call("gemini-flash-latest"); } catch { return null; } }
  const hm = (s) => (typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s) ? +s.split(":")[0] * 60 + +s.split(":")[1] : null);
  const okDay = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const acts = (res.actions || []).map((a) => {
    if (a.op === "add" && a.title) return { op: "add", title: String(a.title).slice(0, 120), subject: SUBJECTS.some(([n]) => n === a.subject) ? a.subject : null, minutes: +a.minutes || 60, due: okDay(a.due), day: okDay(a.day), time: hm(a.time) };
    if (a.op === "busy" && okDay(a.day)) return { op: "busy", day: a.day, from: hm(a.from) ?? 0, to: hm(a.to) ?? 1440, label: a.label };
    if (["done", "delete", "progress"].includes(a.op)) return { op: a.op, match: String(a.match || ""), minutes: +a.minutes || 0 };
    if (a.op === "move" && okDay(a.day)) return { op: "move", match: String(a.match || ""), day: a.day, time: hm(a.time) };
    if (a.op === "query") return { op: "query", day: okDay(a.day) || T };
    if (["week", "list", "help", "undo"].includes(a.op)) return { op: a.op };
    return null;
  }).filter(Boolean);
  return acts.length ? acts : null;
}

/* ---------- traitement d'une phrase ---------- */
async function handle(text) {
  text = text.trim();
  if (!text) return;
  $("heard").textContent = `« ${text} »`;
  setOrb("thinking", "Je réfléchis…");
  let actions = null;
  if (/^(annule|annuler|retour en arrière|reviens en arrière|undo)[ .!]*$/i.test(text)) actions = [{ op: "undo" }];
  if (!actions && st.settings.geminiKey) actions = await gemini(text);
  if (!actions) actions = understand(text, st, today());
  const { text: reply, canUndo } = run(actions);
  showReply(reply, canUndo);
  speak(reply);
}

function showReply(text, canUndo) {
  $("replyTxt").textContent = text;
  const row = $("replyRow"); row.innerHTML = "";
  if (canUndo) { const b = document.createElement("button"); b.className = "chip"; b.textContent = "↶ Annuler"; b.onclick = () => { const r = run([{ op: "undo" }]); showReply(r.text, false); }; row.append(b); }
  $("reply").classList.add("on");
}

/* ---------- voix : écoute ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, finalText = "";
function setOrb(s, label) { $("orb").dataset.s = s; if (label != null) $("status").textContent = label; }
const SR_ERR = {
  "not-allowed": "Micro refusé. Autorise le micro pour ce site (Safari : Réglages du site › Micro › Autoriser), puis réessaie.",
  "service-not-allowed": "La reconnaissance vocale est désactivée sur cet appareil. Sur Mac : Réglages Système › Clavier › Dictée › Activer. Sur iPhone : Réglages › Général › Clavier › Activer la dictée.",
  "audio-capture": "Aucun micro détecté.",
  network: "La reconnaissance vocale n'a pas accès à Internet. Utilise le champ texte (ou la dictée du clavier) en attendant.",
  "language-not-supported": "Le français n'est pas disponible pour la reconnaissance vocale sur ce navigateur.",
};
function listen() {
  if (!SR) { $("askInput").focus(); toast("Ce navigateur n'a pas la reconnaissance vocale : utilise le micro du clavier dans le champ texte."); return; }
  if (listening) { rec && rec.stop(); return; }
  try { speechSynthesis.cancel(); } catch {}
  rec = new SR();
  rec.lang = "fr-FR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  finalText = "";
  rec.onstart = () => { listening = true; setOrb("listening", "Je t'écoute…"); $("heard").textContent = ""; };
  rec.onresult = (e) => {
    let interim = ""; finalText = "";
    for (const r of e.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
    $("heard").textContent = finalText || interim;
    if (!finalText) finalText = interim; // Safari ne marque pas toujours le résultat comme final
  };
  rec.onerror = (e) => {
    listening = false;
    if (e.error === "no-speech" || e.error === "aborted") { setOrb("idle", "Je n'ai rien entendu. Touche l'orbe pour réessayer."); return; }
    setOrb("idle", "Micro indisponible");
    showReply(SR_ERR[e.error] || `Erreur de reconnaissance (${e.error}). Utilise le champ texte en attendant.`, false);
  };
  rec.onend = () => {
    const was = listening; listening = false;
    if ($("orb").dataset.s === "listening") setOrb("idle", "Touche l'orbe et parle");
    if (was && finalText.trim()) handle(finalText);
  };
  try { rec.start(); } catch (err) { listening = false; showReply("Impossible de démarrer le micro : " + err.message, false); }
}

/* ---------- voix : parole ---------- */
let voice = null;
function pickVoice() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const fr = vs.filter((v) => /^fr/i.test(v.lang));
  voice = fr.find((v) => /thomas/i.test(v.name)) || fr.find((v) => /fr-FR/i.test(v.lang) && /premium|enhanced|amélioré/i.test(v.name)) || fr.find((v) => /fr-FR/i.test(v.lang)) || fr[0] || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  const done = () => { setOrb("idle", "Touche l'orbe et parle"); if (st.settings.convo && SR) setTimeout(listen, 300); };
  if (!st.settings.voice || !window.speechSynthesis) return done();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»"]/g, "").replace(/\n/g, ". "));
    u.lang = "fr-FR"; if (voice) u.voice = voice; u.rate = 1.05;
    u.onstart = () => setOrb("speaking", "Jarvis parle…");
    u.onend = done; u.onerror = () => setOrb("idle", "Touche l'orbe et parle");
    speechSynthesis.speak(u);
    setTimeout(() => { if (!speechSynthesis.speaking && $("orb").dataset.s !== "listening") setOrb("idle", "Touche l'orbe et parle"); }, 1500);
  } catch { done(); }
}
let primed = false;
function primeSpeech() { if (primed || !window.speechSynthesis) return; primed = true; try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {} }

/* ---------- affichage ---------- */
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function blockHtml(b, P, nowMin, isToday) {
  if (b.busy) return `<div class="blk busy"><div class="t">${toHHMM(b.from)}<br>${toHHMM(Math.min(b.to, 1439))}</div><div><div class="n">${esc(b.label)}</div><div class="m">Indisponible</div></div><button class="x" data-unbusy="${b.id}" aria-label="Retirer">${ICON_X}</button></div>`;
  const t = st.tasks.find((x) => x.id === b.taskId);
  const now = isToday && b.from <= nowMin && nowMin < b.to;
  const meta = [t.subject, b.fixed ? "heure fixe" : sayDur(b.to - b.from), t.due ? `avant ${sayDay(t.due, today())}` : ""].filter(Boolean).join(" · ");
  return `<div class="blk${now ? " now" : ""}" style="--c:${color(t.subject)}"><div class="t">${toHHMM(b.from)}<br>${toHHMM(b.to)}</div><div class="body" data-edit="${t.id}" style="cursor:pointer"><div class="n">${esc(t.title)}</div><div class="m">${esc(meta)}</div></div><button class="check" data-block="${t.id}|${b.to - b.from}|${b.fixed ? 1 : 0}" aria-label="Fait">${ICON_CHECK}</button></div>`;
}
function render() {
  const T = today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const d = fromKey(T);
  $("today").textContent = `${JOURS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const P = plan(st, now);
  const withBusy = (k) => [...P.blocks.filter((b) => b.day === k), ...st.busy.filter((b) => b.day === k).map((b) => ({ ...b, busy: true }))].sort((a, b) => a.from - b.from);
  const tb = withBusy(T);
  const work = P.blocks.filter((b) => b.day === T && !b.fixed).reduce((s, b) => s + b.to - b.from, 0);
  $("todaySum").textContent = work ? `${sayDur(work)} de travail` : "";
  $("todayBlocks").innerHTML = tb.length ? tb.map((b) => blockHtml(b, P, nowMin, true)).join("") : `<div class="empty">Rien de prévu pour le reste de la journée.</div>`;
  $("alerts").innerHTML = P.late.map((l) => { const t = st.tasks.find((x) => x.id === l.taskId); return `<div class="alert">⚠ « ${esc(t.title)} » : il manque ${sayDur(l.missing)} ${l.reason === "due" ? `avant ${sayDay(t.due, T)}` : l.reason === "day" ? `ce jour-là` : "dans les 2 semaines"}. Libère du temps ou élargis tes créneaux dans les réglages.</div>`; }).join("");
  let days = "";
  for (let i = 1; i < 8; i++) {
    const k = addDays(T, i), bs = withBusy(k);
    if (!bs.length) continue;
    const dd = fromKey(k);
    days += `<div class="day"><h3>${sayDay(k, T)[0].toUpperCase() + sayDay(k, T).slice(1)} <span class="label" style="margin-left:6px">${dd.getDate()}/${String(dd.getMonth() + 1).padStart(2, "0")}</span></h3><div class="blocks">${bs.map((b) => blockHtml(b, P, nowMin, false)).join("")}</div></div>`;
  }
  $("days").innerHTML = days || `<div class="empty">Rien de prévu cette semaine. Touche l'orbe et dis ce que tu as à faire.</div>`;
  const open = st.tasks.filter((t) => !t.done).sort((a, b) => (a.due || a.day || "9999").localeCompare(b.due || b.day || "9999"));
  const done = st.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 5);
  $("taskSum").textContent = open.length ? `${open.length} en cours` : "";
  $("tasks").innerHTML = [...open, ...done].map((t) => {
    const when = t.time != null && t.day ? `${sayDay(t.day, T)} à ${sayTime(t.time)}` : t.due ? `avant ${sayDay(t.due, T)}` : t.day ? sayDay(t.day, T) : "dès que possible";
    const pct = Math.round(100 * (t.doneMin || 0) / t.minutes);
    return `<div class="task${t.done ? " done" : ""}" style="--c:${color(t.subject)}"><button class="check" data-toggle="${t.id}" aria-label="Terminé" style="${t.done ? "color:var(--mint);border-color:var(--mint)" : ""}">${ICON_CHECK}</button><div class="body" data-edit="${t.id}"><div class="n">${t.subject ? `<span class="tag">${esc(t.subject)}</span>` : ""}${esc(t.title)}</div><div class="m">${esc(when)} · ${sayDur(t.minutes)}${t.doneMin ? ` · ${sayDur(t.doneMin)} faites` : ""}</div>${t.doneMin && !t.done ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}</div><button class="x" data-del="${t.id}" aria-label="Supprimer">${ICON_X}</button></div>`;
  }).join("") || `<div class="empty">Aucune tâche. Exemple : « j'ai un DM de physique pour jeudi, 3 heures ».</div>`;
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-block],[data-toggle],[data-del],[data-edit],[data-unbusy]");
  if (!el) return;
  if (el.dataset.block) {
    const [id, mins, fixed] = el.dataset.block.split("|"); const t = st.tasks.find((x) => x.id === id); if (!t) return;
    snapshot();
    if (fixed === "1") t.done = true; else { t.doneMin = Math.min(t.minutes, (t.doneMin || 0) + +mins); if (t.doneMin >= t.minutes) t.done = true; }
    if (t.done) t.doneAt = Date.now();
    save(); render(); toast(t.done ? `« ${t.title} » terminé ✓` : `${sayDur(+mins)} faites sur « ${t.title} »`, true);
  } else if (el.dataset.toggle) {
    const t = st.tasks.find((x) => x.id === el.dataset.toggle); snapshot(); t.done = !t.done; t.doneAt = Date.now(); save(); render();
  } else if (el.dataset.del) {
    const t = st.tasks.find((x) => x.id === el.dataset.del); snapshot(); st.tasks = st.tasks.filter((x) => x !== t); save(); render(); toast(`« ${t.title} » supprimé`, true);
  } else if (el.dataset.unbusy) {
    snapshot(); st.busy = st.busy.filter((b) => b.id !== el.dataset.unbusy); save(); render();
  } else if (el.dataset.edit) openEdit(el.dataset.edit);
});

let toastTimer;
function toast(msg, undo) {
  const el = $("toast"); el.textContent = msg + (undo ? " — touche l'orbe et dis « annule » pour revenir en arrière" : ""); el.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 3500);
}

/* ---------- édition d'une tâche ---------- */
let editing = null;
$("eSubject").innerHTML = `<option value="">—</option>` + SUBJECTS.map(([n]) => `<option>${n}</option>`).join("");
function openEdit(id) {
  editing = st.tasks.find((t) => t.id === id); if (!editing) return;
  $("eTitle").value = editing.title; $("eSubject").value = editing.subject || ""; $("eMin").value = editing.minutes;
  $("eDue").value = editing.due || ""; $("eDay").value = editing.day || ""; $("eTime").value = editing.time != null ? toHHMM(editing.time) : "";
  $("edit").showModal();
}
$("edit").addEventListener("close", () => {
  const v = $("edit").returnValue; const t = editing; editing = null; if (!t) return;
  if (v === "delete") { snapshot(); st.tasks = st.tasks.filter((x) => x !== t); }
  else if (v === "ok") {
    snapshot();
    t.title = $("eTitle").value.trim() || t.title; t.subject = $("eSubject").value || null; t.minutes = Math.max(5, +$("eMin").value || t.minutes);
    t.due = $("eDue").value || null; t.day = $("eDay").value || null;
    const tm = $("eTime").value; t.time = tm && t.day ? +tm.slice(0, 2) * 60 + +tm.slice(3, 5) : null;
  } else return;
  save(); render();
});

/* ---------- réglages ---------- */
const ORDER = [1, 2, 3, 4, 5, 6, 0];
function openSettings() {
  $("winRows").innerHTML = ORDER.map((d) => `<label class="win"><span>${JOURS[d]}</span><input class="field-in" data-win="${d}" value="${esc(st.settings.windows[d] || "")}" placeholder="aucun" style="background:var(--panel2);border:1px solid var(--edge);border-radius:10px;padding:8px 10px;font-size:16px;min-width:0"></label>`).join("");
  $("maxBlock").value = st.settings.maxBlock; $("pause").value = st.settings.pause;
  $("voiceOn").checked = st.settings.voice; $("convo").checked = st.settings.convo; $("gemKey").value = st.settings.geminiKey;
  $("settings").showModal();
}
$("openSettings").onclick = openSettings;
$("settings").addEventListener("close", () => {
  if ($("settings").returnValue !== "ok") return;
  snapshot();
  for (const inp of document.querySelectorAll("[data-win]")) { const v = inp.value.trim(); st.settings.windows[inp.dataset.win] = v && parseWindows(v).length ? v : v ? st.settings.windows[inp.dataset.win] : ""; }
  st.settings.maxBlock = Math.max(20, +$("maxBlock").value || 90); st.settings.pause = Math.max(0, +$("pause").value || 0);
  st.settings.voice = $("voiceOn").checked; st.settings.convo = $("convo").checked; st.settings.geminiKey = $("gemKey").value.trim();
  save(); render(); toast("Réglages enregistrés");
});
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$("exportBtn").onclick = () => { const s = { ...st, settings: { ...st.settings, geminiKey: "" } }; download(`jarvis-sauvegarde-${today()}.json`, JSON.stringify(s, null, 1), "application/json"); };
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const s = JSON.parse(await f.text()); if (!Array.isArray(s.tasks)) throw 0; snapshot(); const key = st.settings.geminiKey; st = { ...fresh(), ...s, settings: { ...fresh().settings, ...s.settings, geminiKey: key || s.settings?.geminiKey || "" } }; save(); render(); toast("Données restaurées"); $("settings").close(); }
  catch { toast("Ce fichier n'est pas une sauvegarde Jarvis"); }
  e.target.value = "";
};
$("wipeBtn").onclick = () => { if (confirm("Effacer toutes les tâches et indisponibilités ?")) { snapshot(); st.tasks = []; st.busy = []; save(); render(); $("settings").close(); toast("Tout est effacé", true); } };

/* ---------- export Calendrier (.ics) ---------- */
$("icsBtn").onclick = () => {
  const P = plan(st); const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const dt = (k, m) => `${k.replace(/-/g, "")}T${toHHMM(m).replace(":", "")}00`;
  const ev = P.blocks.map((b, i) => { const t = st.tasks.find((x) => x.id === b.taskId); return ["BEGIN:VEVENT", `UID:jarvis-${b.taskId}-${b.day}-${b.from}@thomas-bsa.github.io`, `DTSTAMP:${stamp}`, `DTSTART:${dt(b.day, b.from)}`, `DTEND:${dt(b.day, b.to)}`, `SUMMARY:${(t.subject ? t.subject + " · " : "") + t.title.replace(/[,;\\]/g, " ")}`, "END:VEVENT"].join("\r\n"); });
  if (!ev.length) { toast("Le planning est vide"); return; }
  download("planning-jarvis.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jarvis//FR", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n"), "text/calendar");
};

/* ---------- démarrage ---------- */
const EX = ["J'ai un DM de physique pour jeudi, 3 heures", "Révise les maths demain pendant 2 h", "Dentiste mardi à 17 h 30", "Je ne suis pas dispo samedi matin", "Qu'est-ce que je fais demain ?", "J'ai fini le DM de physique", "Aide"];
$("examples").innerHTML = EX.map((x) => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join("");
$("examples").addEventListener("click", (e) => { const b = e.target.closest("[data-ex]"); if (b) { primeSpeech(); handle(b.dataset.ex); } });
$("orb").addEventListener("click", () => { primeSpeech(); listen(); });
$("ask").addEventListener("submit", (e) => { e.preventDefault(); primeSpeech(); const v = $("askInput").value; $("askInput").value = ""; $("askInput").blur(); handle(v); });
if (!SR) $("status").textContent = "Écris ou utilise la dictée du clavier";
render();
setInterval(render, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__jarvis = { handle, get state() { return st; }, plan: () => plan(st) };
