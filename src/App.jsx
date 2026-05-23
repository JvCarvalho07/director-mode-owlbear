import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { Clapperboard, Eye, Star, Zap } from "lucide-react";
import "./style.css";

const META = "com.sworddance.director-mode/state";
const TOKEN_META = "com.sworddance.director-mode/token";
const modes = [
  { id: "exploration", label: "Exploração", ambience: "Ruínas, vento baixo", fog: "normal" },
  { id: "combat", label: "Combate", ambience: "Percussão leve", fog: "tactical" },
  { id: "rest", label: "Descanso", ambience: "Fogueira, noite", fog: "open" },
  { id: "chase", label: "Perseguição", ambience: "Ritmo rápido", fog: "motion" },
  { id: "investigation", label: "Investigação", ambience: "Drone misterioso", fog: "focused" },
  { id: "boss", label: "Boss fight", ambience: "Tema intenso", fog: "dramatic" }
];
const presets = [
  { id: "ambush", label: "Emboscada", mode: "combat", intensity: 75, title: "A emboscada começa", text: "Sombras se movem. Algo ataca primeiro." },
  { id: "dark-room", label: "Sala escura", mode: "exploration", intensity: 55, title: "Escuridão densa", text: "A luz parece morrer antes de tocar as paredes." },
  { id: "boss-entry", label: "Entrada de boss", mode: "boss", intensity: 100, title: "A presença desperta", text: "O ar pesa. O verdadeiro inimigo se revela." },
  { id: "clue", label: "Pista importante", mode: "investigation", intensity: 40, title: "Uma pista surge", text: "Um detalhe muda tudo." },
  { id: "escape", label: "Fuga", mode: "chase", intensity: 85, title: "Corram!", text: "O cenário inteiro parece virar contra vocês." }
];

function App() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState({ mode: "exploration", intensity: 50, revealTitle: "", revealText: "", history: [] });
  const mode = useMemo(() => modes.find(m => m.id === state.mode) || modes[0], [state.mode]);

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true);
      try {
        const meta = await OBR.scene.getMetadata();
        if (meta[META]) setState(s => ({ ...s, ...meta[META] }));
      } catch {}
    });
  }, []);

  async function save(next) {
    setState(next);
    if (ready) await OBR.scene.setMetadata({ [META]: next });
  }

  async function applyMode(id) {
    const next = { ...state, mode: id };
    await save(next);
  }

  async function setIntensity(value) {
    await save({ ...state, intensity: Number(value) });
  }

  async function spotlight() {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) return alert("Selecione um ou mais tokens primeiro.");
    await OBR.scene.items.updateItems(ids, items => {
      for (const item of items) {
        item.metadata[TOKEN_META] = { ...(item.metadata[TOKEN_META] || {}), spotlight: true, ts: Date.now() };
      }
    });
  }

  async function clearSpotlight() {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) return alert("Selecione os tokens que quer limpar.");
    await OBR.scene.items.updateItems(ids, items => {
      for (const item of items) {
        item.metadata[TOKEN_META] = { ...(item.metadata[TOKEN_META] || {}), spotlight: false, ts: Date.now() };
      }
    });
  }

  async function reveal(custom = {}) {
    const title = custom.title || state.revealTitle || "Reveal cinematográfico";
    const text = custom.text || state.revealText || "Algo importante foi revelado.";
    const next = {
      ...state,
      mode: custom.mode || state.mode,
      intensity: custom.intensity ?? state.intensity,
      history: [{ title, text, at: new Date().toLocaleTimeString() }, ...(state.history || [])].slice(0, 8)
    };
    await save(next);
    try { await OBR.notification.show(`${title}: ${text}`); } catch { alert(`${title}\n${text}`); }
  }

  async function applyPreset(p) {
    await reveal(p);
  }

  return <main>
    <header><Clapperboard /><div><h1>Director Mode</h1><p>{ready ? "Conectado ao Owlbear" : "Abrindo fora do Owlbear"}</p></div></header>
    <section className="card"><h2>Estado da cena</h2><div className="grid">{modes.map(m => <button key={m.id} className={state.mode === m.id ? "active" : ""} onClick={() => applyMode(m.id)}>{m.label}</button>)}</div><p className="hint">Ambiência: {mode.ambience} · Fog bridge: {mode.fog}</p><label>Intensidade dramática <b>{state.intensity}%</b></label><input type="range" min="0" max="100" value={state.intensity} onChange={e => setIntensity(e.target.value)} /></section>
    <section className="card"><h2><Eye size={18}/> Cinematic Reveal</h2><input placeholder="Título" value={state.revealTitle} onChange={e => setState({ ...state, revealTitle: e.target.value })}/><textarea placeholder="Texto para a revelação" value={state.revealText} onChange={e => setState({ ...state, revealText: e.target.value })}/><button className="primary" onClick={() => reveal()}><Zap size={16}/> Disparar reveal</button></section>
    <section className="card"><h2><Star size={18}/> Spotlight</h2><div className="row"><button onClick={spotlight}>Marcar selecionados</button><button onClick={clearSpotlight}>Limpar selecionados</button></div></section>
    <section className="card"><h2>Presets</h2><div className="grid">{presets.map(p => <button key={p.id} onClick={() => applyPreset(p)}>{p.label}</button>)}</div></section>
    <section className="card"><h2>Histórico</h2>{(state.history || []).length === 0 ? <p className="hint">Nenhum reveal ainda.</p> : state.history.map((h,i) => <div className="log" key={i}><b>{h.at} · {h.title}</b><span>{h.text}</span></div>)}</section>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
