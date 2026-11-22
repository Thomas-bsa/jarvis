// Jarvis — cerveau local (sans IA externe) + planificateur.
// Dates en français grâce à chrono-node (https://github.com/wanasit/chrono, licence MIT).
import * as chrono from "./vendor/chrono.js";

/* ---------- dates ---------- */
export const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const toHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function sayDay(k, today) {
  if (k === today) return "aujourd'hui";
  if (k === addDays(today, 1)) return "demain";
  if (k === addDays(today, 2)) return "après-demain";
  const d = fromKey(k), diff = (d - fromKey(today)) / 864e5;
  return diff > 0 && diff < 7 ? JOURS[d.getDay()] : `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
export const sayTime = (m) => (m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`);
export const sayDur = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`);

/* ---------- texte ---------- */
export const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, "quarante-cinq": 45, "quarante cinq": 45, cinquante: 50 };
const num = (s) => (s == null ? 0 : /^\d/.test(s) ? parseFloat(s.replace(",", ".")) : NUMW[s] ?? 0);
const N = "(\\d+(?:[.,]\\d+)?|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante(?:[- ]cinq)?|cinquante)";

export const SUBJECTS = [
  ["Maths", /\b(maths?|mathematiques?|analyse|algebre|suites?|integrales?)\b/],
  ["Physique", /\b(physique|chimie|physique-chimie|optique|electrocinetique|meca(nique)?)\b/],
  ["SI", /\b(sciences? de l'ingenieur|s2i|ingenieur|(en|de|d'|le|du|la) si)\b|\bS\.?I\b/],
  ["Anglais", /\b(anglais|english|vocab(ulaire)? d'anglais)\b/],
  ["Français", /\b(francais|philo(sophie)?|lettres|dissert(ation)?)\b/],
  ["Info", /\b(info(rmatique)?|python|algo(rithmique)?)\b/],
  ["TIPE", /\btipe\b/],
  ["LV2", /\b(espagnol|allemand|italien|lv2)\b/],
  ["Sport", /\b(sport|muscu(lation)?|salle|footing|course a pied|running)\b/],
];
const KINDS = [
  ["DM", /\b(dm|devoir maison|devoirs? a la maison)\b/, 180, true],
  ["DS", /\b(ds|devoir surveille|controle|interro(gation)?|examen|partiel|concours blanc)\b/, 120, true],
  ["Colle", /\b(colles?|khol?les?)\b/, 60, true],
  ["Exercices", /\b(exos?|exercices?|td)\b/, 60, false],
  ["Cours", /\b(cours|chapitre|fiches?|lecon|apprendre|relire)\b/, 45, false],
  ["TIPE", /\btipe\b/, 90, false],
];
export function detect(text) {
  const f = fold(text);
  const subject = (SUBJECTS.find(([, re]) => re.test(f) || re.test(text)) || [null])[0];
  const kind = KINDS.find(([, re]) => re.test(f));
  return { subject, kind: kind ? kind[0] : null, defMin: kind ? kind[2] : 60, isDeadline: kind ? kind[3] : false };
}

/** Extrait horaires, durée et date d'une phrase. Renvoie aussi le texte restant. */
export function extract(raw, today) {
  let t = " " + raw.replace(/[’`]/g, "'").replace(/\s+/g, " ") + " ";
  const out = { time: null, minutes: null, day: null, dueWord: false, part: null };
  const cut = (m) => { t = t.replace(m, " "); };
  const H = "(\\d{1,2})\\s*(?:h|heures?)\\s*(\\d{2})?";
  // 1) plage « de 14 h à 16 h » / « entre 14h et 16h »
  let m = t.match(new RegExp(`\\b(?:de|entre)\\s+${H}\\s*(?:à|a|et|jusqu'à)\\s+${H}`, "i"));
  if (m) { const a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0); if (b > a) { out.time = a; out.minutes = b - a; } cut(m[0]); }
  // 2) heure précise « à 17 h 30 »
  if (out.time == null) {
    m = t.match(new RegExp(`\\b(?:à|a|vers|dès|des|pour)\\s+${H}`, "i"));
    if (m && +m[1] < 24) { out.time = +m[1] * 60 + +(m[2] || 0); cut(m[0]); }
  }
  // 3) durée
  const durRes = [
    [new RegExp(`\\b(\\d{1,2})\\s*h\\s*(\\d{2})\\b`, "i"), (m) => +m[1] * 60 + +m[2], (m) => +m[1]],
    [new RegExp(`\\b${N}\\s*(?:h|heures?)\\s*(?:et\\s*)?(demie?|quart|\\d{2})?\\b`, "i"), (m) => num(m[1]) * 60 + (m[2] ? (/demi/.test(m[2]) ? 30 : m[2] === "quart" ? 15 : +m[2]) : 0), (m) => num(m[1])],
    [/\b(?:une\s+)?demi[- ]heure\b/i, () => 30, () => 0],
    [/\btrois quarts? d'heure\b/i, () => 45, () => 0],
    [/\b(?:un\s+)?quart d'heure\b/i, () => 15, () => 0],
    [new RegExp(`\\b${N}\\s*(?:min|minutes?|mn)\\b`, "i"), (m) => num(m[1]), () => 0],
  ];
  for (const [re, val, hours] of durRes) {
    m = t.match(re);
    if (!m) continue;
    const before = t.slice(0, m.index).toLowerCase();
    const durCue = /(pendant|durant|prendre|prend|prends|environ|à peu près|bosser|travailler|réviser|faire|de)\s*$/.test(before) || /^\s*(de|d')/.test(t.slice(m.index + m[0].length));
    // « mardi 17 h » sans « à » : c'est une heure, pas une durée
    if (hours(m) >= 7 && !durCue && out.time == null) { out.time = val(m); cut(m[0]); continue; }
    if (out.minutes == null) { out.minutes = Math.round(val(m)); cut(m[0]); }
    break;
  }
  // 4) moment de la journée (repéré avant la date, retiré après)
  const pm = t.match(/(?:^|\s)(ce |cet |le |l')?(matin|après[- ]midi|aprem|soir|soirée|midi)(?=\s|$|[,.?!])/i);
  if (pm) { const w = fold(pm[2]); out.part = w.startsWith("matin") ? "matin" : /apr/.test(w) ? "aprem" : w === "midi" ? "midi" : "soir"; if (/^(ce |cet )/i.test(pm[1] || "")) out.day = today; }
  // 5) date
  const pre = [
    [/\baprès[- ]demain\b/i, () => addDays(today, 2)],
    [/\bce (?:week[- ]?end|weekend)\b/i, () => nextDow(today, 6, true)],
    [/\bla semaine prochaine\b/i, () => nextDow(today, 1, false)],
    [/\bfin de (?:la )?semaine\b/i, () => nextDow(today, 5, true)],
  ];
  for (const [re, f] of pre) { m = t.match(re); if (m) { out.day = f(); out.dueWord = /(pour|avant|d'ici|rendre|jusqu)\s*$/i.test(t.slice(0, m.index)); cut(m[0]); break; } }
  if (!out.day) {
    m = t.match(/\b(?:le|du|au)\s+(\d{1,2}|1er|premier)\b(?!\s*(?:h|heures?|min|janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec))/i);
    if (m) {
      const n = /^\d/.test(m[1]) ? parseInt(m[1]) : 1;
      if (n >= 1 && n <= 31) {
        const d = fromKey(today); let c = new Date(d.getFullYear(), d.getMonth(), n);
        if (dayKey(c) < today) c = new Date(d.getFullYear(), d.getMonth() + 1, n);
        out.day = dayKey(c); out.dueWord = /(pour|avant|d'ici|rendre|jusqu)\s*$/i.test(t.slice(0, m.index)); cut(m[0]);
      }
    }
  }
  if (!out.day) {
    const ref = fromKey(today); const now = new Date(); ref.setHours(now.getHours(), now.getMinutes());
    const r = chrono.fr.parse(t, ref, { forwardDate: true }).find((x) => x.start.isCertain("day") || x.start.isCertain("weekday") || /demain|aujourd|ce soir|ce matin|cet apr/i.test(x.text));
    if (r) {
      out.day = dayKey(r.start.date());
      if (out.time == null && r.start.isCertain("hour")) {
        out.time = r.start.get("hour") * 60 + (r.start.get("minute") || 0);
        if (r.end && out.minutes == null) out.minutes = (r.end.get("hour") * 60 + (r.end.get("minute") || 0)) - out.time;
      }
      out.dueWord = /(pour|avant|d'ici|rendre|jusqu'?|à rendre)\s*(le\s*)?$/i.test(t.slice(0, r.index));
      cut(r.text);
    }
  }
  if (pm) t = t.replace(new RegExp(`(?:^|\\s)(?:ce |cet |le |l')?(?:matin|après[- ]midi|aprem|soir|soirée|midi)(?=\\s|$|[,.?!])`, "i"), " ");
  out.rest = t.replace(/\s+/g, " ").trim();
  return out;
}
function nextDow(today, dow, allowToday) {
  for (let i = allowToday ? 0 : 1; i < 15; i++) { const k = addDays(today, i); if (fromKey(k).getDay() === dow) return k; }
  return today;
}
export const PARTS = { tard: [20 * 60 + 30, 23 * 60], matin: [8 * 60, 12 * 60], midi: [12 * 60, 14 * 60], aprem: [13 * 60 + 30, 18 * 60 + 30], soir: [18 * 60, 23 * 60] };

const L = "(?<![\\p{L}\\d'])", R = "(?![\\p{L}\\d])";
const W = (src, fl = "giu") => new RegExp(src.replace(/<</g, L).replace(/>>/g, R), fl);
const FILLERS = [
  W("^(?:ok|bon|alors|euh|salut|bonjour|hey|dis|jarvis)>>[,\\s]*", "iu"),
  W("<<(?:s'il te plaît|s'il te plait|stp|merci)>>"),
  W("^(?:et\\s+)?(?:est-ce que tu peux|tu peux|peux-tu|pourrais-tu)>>\\s*", "iu"),
  W("^(?:et\\s+)?(?:rajoute|ajoute|note|mets|programme|planifie|prévois|inscris|rappelle[- ]moi(?: de)?)>>\\s*(?:moi\\s+)?(?:que\\s+)?", "iu"),
  W("^(?:et\\s+)?(?:j'ai aussi|j'ai|je dois aussi|je dois|il faut aussi que je|il faut que je|faut que je|il faut|je vais|je voudrais|j'aimerais|je veux)>>\\s*", "iu"),
  W("<<(?:ça|ca|cela)\\s+(?:va\\s+)?(?:me\\s+)?(?:prendre|prend|prends|durer|dure)>>"),
  W("<<(?:à rendre|a rendre|à faire|a faire|pendant|durant|environ|à peu près|aussi|au total)>>"),
  W("^(?:fasse|fasses)>>\\s*", "iu"),
  W("^(?:(?:une|un|des|les|le|la|mon|ma|mes|du|de la|de|ton|ta)\\s+|l'|d')", "iu"),
];
export function cleanTitle(s) {
  let t = s;
  for (let pass = 0; pass < 3; pass++) for (const re of FILLERS) t = t.trim().replace(re, " ").trim();
  const TAIL = W("(?:\\s|^)(?:pour|avant|d'ici|jusqu'à|le|la|de|du|à|a|et|en|au)\\s*$", "iu");
  t = t.replace(W("<<(?:pour|avant|d'ici|le|de|à)\\s*,"), ",").replace(/\s+([,.;!?])/g, "$1").replace(/,+/g, ",");
  for (let i = 0; i < 3; i++) t = t.replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "").replace(TAIL, "");
  t = t.replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/* ---------- compréhension d'une phrase ---------- */
const SPLIT = /\s*(?:[.;!?]+\s+|\bet puis\b|\bpuis\b|\bensuite\b|\bet après\b|\bet aussi\b|,?\s+et\s+(?=(?:j'ai|je dois|il faut|faut|un |une |des |mon |ma |mes |le |la |réviser|revoir|faire|apprendre|finir|bosser|aller)))\s*/i;

export function understand(text, st, today) {
  const f = fold(text).trim();
  if (!f) return [];
  if (/^(aide|help|que sais-tu faire|qu'est-ce que tu sais faire|tu sais faire quoi)/.test(f)) return [{ op: "help" }];
  const ex = extract(text, today);
  // Questions sur le planning
  if (/(qu'est-ce que (j'ai|je (dois|fais))|qu'est ce que (j'ai|je)|j'ai quoi|je fais quoi|quoi (de prevu|au programme|faire)|qu'ai-je|mon (planning|programme|emploi du temps)|ma journee|ma semaine|le planning|le programme|il me reste|quelles? (sont mes )?taches|liste (des|de mes) taches|c'est quoi (le|mon))/.test(f) && !/\b(ajoute|rajoute|note|mets)\b/.test(f)) {
    if (/semaine/.test(f)) return [{ op: "week" }];
    if (/il me reste|taches/.test(f) && !ex.day) return [{ op: "list" }];
    return [{ op: "query", day: ex.day || today }];
  }
  if (/\b(efface|supprime|vide|annule)\b.*\b(tout|toutes)\b/.test(f)) return [{ op: "clearAsk" }];
  // Indisponibilités
  if (/(pas dispo|indisponible|je suis occupe|je serai occupe|pas libre|je ne suis pas la|je suis pas la|je serai pas la|je ne serai pas la|empeche|bloque (mon|ma|le|la)|j'ai (un |une )?(rdv|rendez-vous|entrainement|match|soiree))/.test(f) && !/\b(dm|exos?|exercices|reviser)\b/.test(f)) {
    const day = ex.day || today;
    let from, to;
    if (ex.time != null) { from = ex.time; to = ex.time + (ex.minutes || 60); }
    else if (ex.part) [from, to] = PARTS[ex.part];
    else { from = 0; to = 24 * 60; }
    const label = cleanTitle(ex.rest.replace(/(je ne suis pas dispo(nible)?|je suis pas dispo(nible)?|pas dispo(nible)?|indisponible|je (suis|serai) occupée?|pas libre|je (ne )?(suis|serai) pas là|bloque)/gi, "")) || "Indisponible";
    return [{ op: "busy", day, from, to: Math.min(to, 24 * 60), label }];
  }
  // Tâche terminée / avancée
  const doneRe = /^(et )?(j'ai (fini|termine|fait|rendu|boucle|acheve|bien fait)|c'est fait|c'est bon pour|fini|termine|valide)\b/;
  if (doneRe.test(f)) {
    const what = f.replace(doneRe, "").trim();
    if (ex.minutes && /fait|bosse|travaille/.test(f)) return [{ op: "progress", match: what, minutes: ex.minutes }];
    return [{ op: "done", match: what }];
  }
  if (/^(et )?(j'ai (bosse|travaille|avance)|j'ai deja fait)\b/.test(f) && ex.minutes) return [{ op: "progress", match: f, minutes: ex.minutes }];
  if (/^(et )?(supprime|enleve|retire|annule|oublie|efface|vire)\b/.test(f)) return [{ op: "delete", match: f.replace(/^(et )?(supprime|enleve|retire|annule|oublie|efface|vire)\s*/, "") }];
  if (/^(et )?(decale|deplace|reporte|repousse|bouge|mets plutot)\b/.test(f) && ex.day) {
    return [{ op: "move", match: fold(ex.rest).replace(/^(et )?(decale|deplace|reporte|repousse|bouge|mets plutot)\s*/, ""), day: ex.day, time: ex.time }];
  }
  // Sinon : nouvelles tâches (une ou plusieurs)
  const parts = text.split(SPLIT).filter((p) => p && p.trim());
  const acts = [];
  for (const p of parts) {
    const e = extract(p, today), d = detect(p), title = cleanTitle(e.rest);
    if (!title || title.length < 2 || /^(ça|ca|ce|c'est)$/i.test(title)) {
      const prev = acts[acts.length - 1];
      if (prev) { if (e.minutes) prev.minutes = e.minutes; if (e.day) { prev.due = prev.isDeadline || e.dueWord ? e.day : prev.due; if (!prev.due) prev.day = e.day; } if (e.time != null) prev.time = e.time; }
      continue;
    }
    const isDl = d.isDeadline || /(?:^|\s)(rendre|rendu)(?=\s|$)/i.test(p);
    const a = { op: "add", title, subject: d.subject, kind: d.kind, minutes: e.minutes || d.defMin, defaulted: !e.minutes, due: null, day: null, time: null, isDeadline: isDl };
    if (e.day) {
      if (e.time != null && !e.dueWord) { a.day = e.day; a.time = e.time; if (!e.minutes && !d.kind) a.minutes = 60; }
      else if (e.dueWord || isDl) a.due = e.day;
      else a.day = e.day;
    } else if (e.time != null) { a.day = today; a.time = e.time; }
    if (e.part && !a.time) a.part = e.part;
    acts.push(a);
  }
  if (!acts.length) return [{ op: "unknown" }];
  return acts;
}

/* ---------- recherche floue d'une tâche ---------- */
const STOP = new Set("le la les un une des de du d l mon ma mes ton ta tes pour avec en et a au aux j ai je tache taches ce cette c est".split(" "));
const toks = (s) => fold(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
export function findTask(tasks, query) {
  const q = toks(query);
  let best = null, bestScore = 0;
  for (const t of tasks) {
    const words = toks(`${t.title} ${t.subject || ""} ${t.kind || ""}`);
    let s = 0;
    for (const w of q) if (words.some((x) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x))))) s++;
    s = s / Math.max(1, q.length) + (t.done ? -0.5 : 0);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return bestScore >= 0.34 ? best : null;
}

/* ---------- planificateur ---------- */
export const DEFAULT_WINDOWS = {
  1: "17:45-19:45, 20:30-22:30", 2: "17:45-19:45, 20:30-22:30", 3: "17:45-19:45, 20:30-22:30",
  4: "17:45-19:45, 20:30-22:30", 5: "17:45-19:45, 20:30-22:30", 6: "09:30-12:30, 14:00-19:00", 0: "10:00-12:30, 14:00-19:00",
};
export function parseWindows(s) {
  return (s || "").split(/[,;]/).map((x) => x.trim().match(/^(\d{1,2})[:h]?(\d{2})?\s*-\s*(\d{1,2})[:h]?(\d{2})?$/)).filter(Boolean)
    .map((m) => [+m[1] * 60 + +(m[2] || 0), +m[3] * 60 + +(m[4] || 0)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
}
function subtract(free, a, b) {
  const out = [];
  for (const [x, y] of free) { if (b <= x || a >= y) out.push([x, y]); else { if (a > x) out.push([x, a]); if (b < y) out.push([b, y]); } }
  return out;
}

/** Calcule le planning des `days` prochains jours. Renvoie {blocks, late}. */
export function plan(st, now = new Date(), days = 14) {
  const today = dayKey(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const maxBlock = st.settings.maxBlock || 90, brk = st.settings.pause ?? 10, MIN = 30;
  const free = {}, blocks = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(today, i);
    let f = parseWindows(st.settings.windows[fromKey(k).getDay()]);
    if (i === 0) f = subtract(f, 0, Math.ceil((nowMin + 1) / 5) * 5);
    for (const b of st.busy.filter((b) => b.day === k)) f = subtract(f, b.from, b.to);
    free[k] = f;
  }
  const open = st.tasks.filter((t) => !t.done);
  // 1) rendez-vous / tâches à heure fixe
  for (const t of open.filter((t) => t.day && t.time != null)) {
    const rem = Math.max(0, t.minutes - (t.doneMin || 0));
    if (!free[t.day] && t.day < today) continue;
    blocks.push({ taskId: t.id, day: t.day, from: t.time, to: t.time + (rem || t.minutes), fixed: true });
    if (free[t.day]) free[t.day] = subtract(free[t.day], t.time - brk, t.time + (rem || t.minutes) + brk);
  }
  const place = (t, dayList, rem, range) => {
    for (const k of dayList) {
      if (rem <= 0) break;
      let i = 0;
      while (rem > 0 && free[k] && i < free[k].length) {
        let [x, y] = free[k][i];
        if (range) { x = Math.max(x, range[0]); y = Math.min(y, range[1]); }
        const len = y - x;
        if (len < Math.min(MIN, rem)) { i++; continue; }
        let take = Math.min(rem, maxBlock, len);
        if (rem - take > 0 && rem - take < MIN) take = rem - MIN >= MIN ? rem - MIN : Math.min(len, rem);
        take = Math.min(take, len, rem);
        blocks.push({ taskId: t.id, day: k, from: x, to: x + take });
        rem -= take;
        free[k] = subtract(free[k], x, x + take + brk);
        i = 0;
      }
    }
    return rem;
  };
  const late = [];
  // 2) tâches prévues un jour précis
  for (const t of open.filter((t) => t.day && t.time == null)) {
    const k = t.day < today ? today : t.day;
    let rem = Math.max(0, t.minutes - (t.doneMin || 0));
    rem = place(t, [k], rem, t.part ? PARTS[t.part] : null);
    if (rem > 0) rem = place(t, [k], rem, null);
    if (rem > 0) late.push({ taskId: t.id, missing: rem, reason: "day" });
  }
  // 3) le reste : échéance la plus proche d'abord
  const flex = open.filter((t) => !t.day).sort((a, b) => (a.due || "9999") .localeCompare(b.due || "9999") || a.created - b.created);
  for (const t of flex) {
    let rem = Math.max(0, t.minutes - (t.doneMin || 0));
    if (!rem) continue;
    const list = [];
    for (let i = 0; i < days; i++) { const k = addDays(today, i); if (t.due && k >= t.due && !(t.due <= today && k === today)) break; list.push(k); }
    rem = place(t, list, rem, null);
    if (rem > 0) late.push({ taskId: t.id, missing: rem, reason: t.due ? "due" : "horizon" });
  }
  blocks.sort((a, b) => a.day.localeCompare(b.day) || a.from - b.from);
  return { blocks, late };
}
