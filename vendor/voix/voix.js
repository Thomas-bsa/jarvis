// Voix neuronale française (Piper, modèle « tom », licence MIT/CC) exécutée dans le navigateur.
// D'après github.com/diffusionstudio/vits-web : phonémisation espeak-ng (wasm) + modèle VITS (onnxruntime-web).
import { createPiperPhonemize } from "./piper-phonemize.js";

const ORT = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";
const PHON = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
const HF = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/";
export const VOICES = {
  tom: "fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx",
  gilles: "fr/fr_FR/gilles/low/fr_FR-gilles-low.onnx",
  upmc: "fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx",
  siwis: "fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
};
const CACHE = "jarvis-voix-v1";
let ortP = null, session = null, config = null, current = null, loading = null;

function loadOrt(){
  if (window.ort) return Promise.resolve(window.ort);
  return ortP || (ortP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = ORT + "ort.min.js"; s.onload = () => res(window.ort); s.onerror = () => rej(new Error("onnxruntime indisponible")); document.head.appendChild(s); }));
}
async function cached(url, onProgress){
  let cache = null; try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return await hit.arrayBuffer(); } catch(e){}
  const r = await fetch(url); if (!r.ok) throw new Error("Téléchargement impossible (" + r.status + ")");
  const total = +r.headers.get("content-length") || 0;
  let buf;
  if (r.body && onProgress && total){
    const reader = r.body.getReader(), chunks = []; let got = 0;
    for (;;){ const {done, value} = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(got / total); }
    const out = new Uint8Array(got); let o = 0; for (const c of chunks){ out.set(c, o); o += c.length; } buf = out.buffer;
  } else buf = await r.arrayBuffer();
  try { if (cache) await cache.put(url, new Response(buf.slice(0), {headers: {"Content-Type": "application/octet-stream"}})); } catch(e){}
  return buf;
}
export async function isDownloaded(voice = "tom"){ try { const c = await caches.open(CACHE); return !!(await c.match(HF + VOICES[voice])); } catch(e){ return false; } }
export function init(voice = "tom", onProgress){
  if (current === voice && session) return Promise.resolve();
  if (loading && loading.voice === voice) return loading.p;
  const p = (async () => {
    const ort = await loadOrt();
    ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    config = JSON.parse(new TextDecoder().decode(await cached(HF + VOICES[voice] + ".json")));
    const model = await cached(HF + VOICES[voice], onProgress);
    session = await ort.InferenceSession.create(model);
    current = voice;
  })();
  loading = {voice, p};
  p.catch(() => { loading = null; });
  return p;
}
function phonemize(text){
  return new Promise(async (res, rej) => {
    try {
      const mod = await createPiperPhonemize({
        print: l => { try { res(JSON.parse(l).phoneme_ids); } catch(e){ rej(e); } },
        printErr: () => {},
        locateFile: f => f.endsWith(".wasm") ? PHON + ".wasm" : f.endsWith(".data") ? PHON + ".data" : f
      });
      mod.callMain(["-l", config.espeak.voice, "--input", JSON.stringify([{text}]), "--espeak_data", "/espeak-ng-data"]);
    } catch(e){ rej(e); }
  });
}
/** Synthétise une phrase : renvoie {samples: Float32Array, rate} */
export async function synth(text, {speed = 1} = {}){
  if (!session) throw new Error("voix non chargée");
  const ort = window.ort, ids = await phonemize(text.trim());
  const inf = config.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)])),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / speed, inf.noise_w ?? 0.8]))
  };
  if (config.num_speakers > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]));
  const out = await session.run(feeds);
  return {samples: out.output.data, rate: config.audio.sample_rate};
}
