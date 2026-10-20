import "server-only";
import { store } from "./store";
import { getOrgaToday } from "./orga";
import { getSummary, type Summary } from "./stats";
import { fmtHours, fmtMinutes, longDate, parisDay, parisTime } from "./time";
import { SUBJECTS } from "./types";

export type ChatMsg = { role: "jarvis" | "user"; text: string };
export type JarvisReply = { reply: string; done: boolean; logged: string[] };

// ---------- Tools Jarvis can use ----------

type ToolResult = { ok: boolean; message: string };

async function logWork(subject: string, minutes: number): Promise<ToolResult> {
  const m = Math.round(Number(minutes));
  if (!(m > 0 && m < 16 * 60)) return { ok: false, message: "durée invalide" };
  const subj = SUBJECTS.find((s) => s.toLowerCase() === String(subject).toLowerCase()) ?? "Autre";
  await store.addWork({ subject: subj, minutes: m, start: new Date(Date.now() - m * 60000).toISOString() });
  return { ok: true, message: `${fmtMinutes(m)} de ${subj} enregistrées` };
}

async function logSport(activity: string, minutes: number): Promise<ToolResult> {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  await store.addSport({ day: parisDay(), activity: String(activity || "Sport"), minutes: m });
  return { ok: true, message: `séance de ${activity || "sport"} enregistrée` };
}

async function logBedtime(): Promise<ToolResult> {
  const recent = await store.listSleep(new Date(Date.now() - 6 * 3_600_000).toISOString());
  if (!recent.some((s) => !s.wake)) await store.addSleep({ bed: new Date().toISOString(), wake: null });
  return { ok: true, message: `coucher enregistré à ${parisTime()}` };
}

function wakeAdvice(s: Summary): string {
  const wake = new Date(Date.now() + s.settings.targets.sleepHours * 3_600_000 + 15 * 60000);
  return parisTime(wake).replace(":", " h ");
}

// ---------- Context given to the model ----------

function context(s: Summary): string {
  const t = s.settings.targets;
  const subjects = s.todayBySubject.map((x) => `${x.subject} ${fmtMinutes(x.minutes)}`).join(", ") || "rien au minuteur";
  return [
    `Nous sommes le ${longDate()}, il est ${parisTime()} (heure de Paris).`,
    `Période : ${s.settings.holidayMode ? "vacances" : "cours"}. Objectif de travail du jour : ${fmtHours(s.workTargetH)}.`,
    `Travail enregistré aujourd'hui : ${fmtMinutes(s.todayWorkMin)} (${subjects}).`,
    `Travail sur 7 jours : ${fmtHours(s.weekWorkH)}.`,
    `Sommeil : objectif ${fmtHours(t.sleepHours)} par nuit ; nuit dernière ${s.lastNightH == null ? "non renseignée" : fmtHours(s.lastNightH)} ; moyenne 7 jours ${s.avgSleepH == null ? "inconnue" : fmtHours(s.avgSleepH)}.`,
    `Sport : objectif ${t.sportPerWeek} séances par semaine ; ${s.sportThisWeek} cette semaine ; aujourd'hui : ${s.sportToday.map((x) => x.activity).join(", ") || "aucune"}.`,
  ].join("\n");
}

const PERSONA = `Tu es JARVIS, l'assistant personnel de Thomas, étudiant en classe préparatoire PTSI.
Ton style : celui de J.A.R.V.I.S. dans Iron Man. Tu le vouvoies et l'appelles « Monsieur ». Calme, précis, bienveillant, une pointe d'humour pince-sans-rire.
Tes réponses sont lues à voix haute : phrases courtes, 1 à 3 phrases, pas de listes, pas de markdown, pas d'émoji. Écris les durées comme on les dit (« trois heures dix »).
Matières possibles : ${SUBJECTS.join(", ")}.
Tu peux enregistrer du travail, du sport et l'heure de coucher avec tes outils. N'invente jamais de données.`;

const BILAN = `C'est le bilan du soir. Déroulé :
1) Résume sa journée de travail d'après les données, et demande s'il a travaillé sans le minuteur (si oui, enregistre-le).
2) Demande s'il a fait du sport (si oui, enregistre-le). S'il reste des devoirs pour demain non faits, rappelle-les brièvement.
3) Dis où il en est sur ses trois objectifs (travail, sommeil, sport) en une ou deux phrases, avec un conseil concret pour demain.
4) Quand il dit bonne nuit ou que le bilan est fini, enregistre le coucher, souhaite bonne nuit et indique l'heure de réveil conseillée pour son objectif de sommeil.
Une seule question à la fois.`;

// ---------- Gemini ----------

type Part = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "enregistrer_travail",
        description: "Enregistre du temps de travail fait aujourd'hui.",
        parameters: {
          type: "OBJECT",
          properties: {
            matiere: { type: "STRING", enum: [...SUBJECTS] },
            minutes: { type: "INTEGER", description: "Durée en minutes" },
          },
          required: ["matiere", "minutes"],
        },
      },
      {
        name: "enregistrer_sport",
        description: "Enregistre une séance de sport faite aujourd'hui.",
        parameters: {
          type: "OBJECT",
          properties: {
            activite: { type: "STRING" },
            minutes: { type: "INTEGER" },
          },
          required: ["activite", "minutes"],
        },
      },
      {
        name: "enregistrer_coucher",
        description: "Enregistre que Thomas va se coucher maintenant. À appeler à la fin du bilan du soir.",
        parameters: { type: "OBJECT", properties: {} },
      },
    ],
  },
];

async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === "enregistrer_travail") return logWork(String(args.matiere), Number(args.minutes));
  if (name === "enregistrer_sport") return logSport(String(args.activite), Number(args.minutes));
  if (name === "enregistrer_coucher") return logBedtime();
  return { ok: false, message: "outil inconnu" };
}

async function gemini(messages: ChatMsg[], mode: "bilan" | "libre", s: Summary): Promise<JarvisReply> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents: Content[] = [
    { role: "user", parts: [{ text: mode === "bilan" ? "[Le bilan de 23 h commence. Ouvre la conversation.]" : "[Thomas ouvre Jarvis.]" }] },
    ...messages.map<Content>((m) => ({ role: m.role === "jarvis" ? "model" : "user", parts: [{ text: m.text }] })),
  ];
  const system = `${PERSONA}\n\n${mode === "bilan" ? BILAN : "Réponds à sa demande."}\n\nDonnées actuelles :\n${context(s)}\n${await orgaContext()}`;
  const logged: string[] = [];
  let bedtime = false;

  for (let round = 0; round < 5; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          tools: TOOLS,
          generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return { reply: text || "Pardon, Monsieur, pourriez-vous répéter ?", done: bedtime, logged };
    }
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls) {
      const r = await runTool(c.functionCall!.name, c.functionCall!.args ?? {});
      if (r.ok) logged.push(r.message);
      if (c.functionCall!.name === "enregistrer_coucher") bedtime = true;
      responses.push({ functionResponse: { name: c.functionCall!.name, response: r } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "C'est noté, Monsieur.", done: bedtime, logged };
}

// ---------- Scripted evening review (works with no API key) ----------

const WORDS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

/** "1 h 30", "une heure et demie", "45 min", "une demi-heure" → minutes */
export function parseDuration(text: string): number {
  const t = text.toLowerCase().replace(/[’']/g, " ");
  if (/demi[- ]heure/.test(t)) return 30;
  const n = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORDS[s] ?? NaN);
  const h = t.match(/(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(h\b|heures?)\s*(et demie|(\d+))?/);
  if (h) {
    const base = n(h[1]) * 60;
    if (h[3] === "et demie") return base + 30;
    return base + (h[4] ? Number(h[4]) : 0);
  }
  const m = t.match(/(\d+)\s*(min|minutes?|mn)/);
  if (m) return Number(m[1]);
  const quarter = t.match(/quart d.?heure/);
  if (quarter) return 15;
  return 0;
}

function guessSubject(text: string): string {
  const t = text.toLowerCase();
  const map: [RegExp, string][] = [
    [/math/, "Maths"],
    [/phys/, "Physique"],
    [/chim/, "Chimie"],
    [/\bsi\b|sciences? de l.?ing/, "SI"],
    [/info|python|algo/, "Informatique"],
    [/fran|philo|dissert/, "Français-philo"],
    [/anglais|english/, "Anglais"],
  ];
  return map.find(([r]) => r.test(t))?.[1] ?? "Autre";
}

const isNo = (t: string) => /^\s*(non|nan|pas|aucun|rien|nope)\b/i.test(t);

async function scripted(messages: ChatMsg[], s: Summary): Promise<JarvisReply> {
  const users = messages.filter((m) => m.role === "user");
  const step = users.length;
  const last = users.at(-1)?.text ?? "";
  const logged: string[] = [];

  if (step === 0) {
    const top = s.todayBySubject[0];
    const detail = top ? `, dont ${fmtMinutes(top.minutes)} de ${top.subject}` : "";
    return {
      reply: `Bonsoir, Monsieur. Il est ${parisTime().replace(":", " h ")}, votre journée est terminée. Le minuteur indique ${fmtMinutes(s.todayWorkMin)} de travail${detail}. Avez-vous travaillé sans le minuteur ?`,
      done: false,
      logged,
    };
  }
  if (step === 1) {
    let extra = "";
    const min = isNo(last) ? 0 : parseDuration(last);
    if (min > 0) {
      const r = await logWork(guessSubject(last), min);
      logged.push(r.message);
      const total = s.todayWorkMin + min;
      extra = `Noté : ${fmtMinutes(total)} au total, soit ${Math.round((total / 60 / s.workTargetH) * 100)} % de votre objectif. `;
    } else if (!isNo(last)) {
      extra = "Je n'ai pas saisi la durée, vous pourrez l'ajouter dans la saisie. ";
    } else {
      extra = `Très bien, ${fmtMinutes(s.todayWorkMin)} pour aujourd'hui. `;
    }
    return { reply: `${extra}Avez-vous fait du sport aujourd'hui ?`, done: false, logged };
  }
  if (step === 2) {
    let sportCount = s.sportThisWeek;
    if (!isNo(last)) {
      const min = parseDuration(last);
      const activity = last.match(/(course|footing|muscu\w*|natation|piscine|foot\w*|basket|tennis|vélo|velo|escalade|boxe|yoga|marche)/i)?.[1] ?? "Sport";
      const r = await logSport(activity, min);
      logged.push(r.message);
      sportCount += 1;
    }
    const left = Math.max(0, s.settings.targets.sportPerWeek - sportCount);
    const sportLine = left === 0 ? "Objectif de sport de la semaine atteint, bravo." : `Il vous reste ${left} séance${left > 1 ? "s" : ""} de sport cette semaine.`;
    const sleepLine = s.avgSleepH != null && s.avgSleepH < s.settings.targets.sleepHours ? " Votre sommeil est un peu court ces jours-ci." : "";
    return { reply: `${sportLine}${sleepLine} Souhaitez-vous que j'enregistre votre coucher maintenant ?`, done: false, logged };
  }
  const r = await logBedtime();
  logged.push(r.message);
  return {
    reply: `Bonne nuit, Monsieur. Coucher enregistré à ${parisTime().replace(":", " h ")}. Pour vos ${fmtHours(s.settings.targets.sleepHours)} de sommeil, réveil conseillé à ${wakeAdvice(s)}.`,
    done: true,
    logged,
  };
}

// French typography: no line break before ? ! : ;
const tidy = (r: JarvisReply): JarvisReply => ({ ...r, reply: r.reply.replace(/ ([?!:;])/g, "\u00a0$1") });

async function orgaContext(): Promise<string> {
  try {
    const o = await getOrgaToday();
    const list = (h: { subject: string; title: string }[]) => h.map((x) => `${x.subject} : ${x.title}`).join(" ; ");
    return [
      `Devoirs pour demain non faits : ${o.dueTomorrow.length ? list(o.dueTomorrow) : "aucun"}.`,
      `Devoirs en retard : ${o.late.length ? list(o.late) : "aucun"}.`,
      `Tâches de la to-do list en attente : ${o.openTodos}.`,
    ].join("\n");
  } catch {
    return "";
  }
}

export async function talk(messages: ChatMsg[], mode: "bilan" | "libre"): Promise<JarvisReply> {
  return tidy(await talkRaw(messages, mode));
}

async function talkRaw(messages: ChatMsg[], mode: "bilan" | "libre"): Promise<JarvisReply> {
  const s = await getSummary();
  if (process.env.GEMINI_API_KEY) {
    try {
      return await gemini(messages, mode, s);
    } catch (e) {
      console.error(e);
      if (mode !== "bilan") return { reply: "Mes circuits sont saturés, Monsieur. Réessayez dans un instant.", done: false, logged: [] };
    }
  }
  if (mode === "bilan") return scripted(messages, s);
  return {
    reply: "Pour converser librement, il me faut une clé Gemini, Monsieur. En attendant, je reste disponible pour le bilan du soir.",
    done: false,
    logged: [],
  };
}

