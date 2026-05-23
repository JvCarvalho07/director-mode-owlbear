import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import OBR, { buildShape, buildLabel } from "@owlbear-rodeo/sdk";
import { Clapperboard, Eye, Star, Zap, Trash2, EyeOff, Sparkles, Skull, Clock3, Target, MapPin, RotateCcw, Save, Flame, Shield, Crosshair, CircleDashed } from "lucide-react";
import "./style.css";

const VERSION = "0.6.0";
const META = "com.sworddance.director-mode/state";
const EFFECT_META = "com.sworddance.director-mode/effect";
const TOKEN_META = "com.sworddance.director-mode/token";
const SNAPSHOT_META = "com.sworddance.director-mode/snapshots";

const modes = [
  { id: "exploration", label: "Exploração", ambience: "Ruínas, vento baixo", color: "#60a5fa" },
  { id: "combat", label: "Combate", ambience: "Percussão leve", color: "#ef4444" },
  { id: "rest", label: "Descanso", ambience: "Fogueira, noite", color: "#22c55e" },
  { id: "chase", label: "Perseguição", ambience: "Ritmo rápido", color: "#f97316" },
  { id: "investigation", label: "Investigação", ambience: "Drone misterioso", color: "#a78bfa" },
  { id: "boss", label: "Boss fight", ambience: "Tema intenso", color: "#f43f5e" }
];

const presets = [
  { id: "ambush", label: "Emboscada", mode: "combat", intensity: 75, title: "A emboscada começa", text: "Sombras se movem. Algo ataca primeiro.", fx: "threat" },
  { id: "dark-room", label: "Sala escura", mode: "exploration", intensity: 55, title: "Escuridão densa", text: "A luz parece morrer antes de tocar as paredes.", fx: "dark" },
  { id: "boss-entry", label: "Entrada de boss", mode: "boss", intensity: 100, title: "A presença desperta", text: "O ar pesa. O verdadeiro inimigo se revela.", fx: "boss" },
  { id: "clue", label: "Pista importante", mode: "investigation", intensity: 40, title: "Uma pista surge", text: "Um detalhe muda tudo.", fx: "clue" },
  { id: "escape", label: "Fuga", mode: "chase", intensity: 85, title: "Corram!", text: "O cenário inteiro parece virar contra vocês.", fx: "escape" }
];

const statuses = [
  { id: "alvo", label: "ALVO", color: "#ef4444" },
  { id: "perigo", label: "PERIGO", color: "#f97316" },
  { id: "protegido", label: "PROTEGIDO", color: "#22c55e" },
  { id: "oculto", label: "OCULTO", color: "#6366f1" },
  { id: "boss", label: "BOSS", color: "#f43f5e" },
  { id: "pista", label: "PISTA", color: "#a78bfa" }
];

const zones = [
  { id: "danger", label: "Zona de perigo", color: "#dc2626", icon: Flame },
  { id: "safe", label: "Zona segura", color: "#16a34a", icon: Shield },
  { id: "objective", label: "Objetivo", color: "#8b5cf6", icon: Target },
  { id: "smoke", label: "Fumaça/Névoa", color: "#64748b", icon: CircleDashed }
];

const directorMoves = [
  { id: "cold-open", label: "Abertura sombria", subtitle: "Escurece a área, cria pista e sobe tensão", tone: "mystery" },
  { id: "boss-reveal", label: "Entrada de boss", subtitle: "Spotlight, reveal, marcador BOSS e ameaça", tone: "danger" },
  { id: "objective", label: "Objetivo dramático", subtitle: "Cria nota, zona de objetivo e destaque", tone: "arcane" },
  { id: "panic", label: "Virada de cena", subtitle: "Zona de perigo, ping e relógio de ameaça", tone: "danger" }
];


function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function nowLabel() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

function effectMeta(kind, extra = {}) {
  return { [EFFECT_META]: { kind, createdAt: Date.now(), version: VERSION, ...extra } };
}

async function getFocusBounds() {
  const ids = await OBR.player.getSelection();
  if (ids?.length) {
    const bounds = await OBR.scene.items.getItemBounds(ids);
    if (bounds?.center) return { ids, bounds };
  }
  const w = await OBR.viewport.getWidth();
  const h = await OBR.viewport.getHeight();
  const center = await OBR.viewport.inverseTransformPoint({ x: w / 2, y: h / 2 });
  return { ids: [], bounds: { center, width: 220, height: 220, min: { x: center.x - 110, y: center.y - 110 }, max: { x: center.x + 110, y: center.y + 110 } } };
}

function makeShapeBase({ shapeType = "CIRCLE", center, width, height, color, name, opacity = 0.1, stroke = 6, dash = [], z = 9000, kind = name }) {
  return buildShape()
    .name(name)
    .shapeType(shapeType)
    .width(width)
    .height(height)
    .position({ x: center.x - width / 2, y: center.y - height / 2 })
    .layer("DRAWING")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .zIndex(z)
    .fillColor(color)
    .fillOpacity(opacity)
    .strokeColor(color)
    .strokeOpacity(0.95)
    .strokeWidth(stroke)
    .strokeDash(dash)
    .metadata(effectMeta(kind))
    .build();
}

function makeRing({ center, radius, color, name, opacity = 0.1, stroke = 6, dash, z, kind }) {
  return makeShapeBase({ center, width: radius * 2, height: radius * 2, color, name, opacity, stroke, dash, z, kind });
}

function makeLabel({ center, text, color, name, yOffset = -120, size = 20, width = 300, kind = name }) {
  return buildLabel()
    .name(name)
    .plainText(text)
    .position({ x: center.x - width / 2, y: center.y + yOffset })
    .layer("TEXT")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .zIndex(9100)
    .width(width)
    .padding(10)
    .fontSize(size)
    .fontWeight(800)
    .textAlign("CENTER")
    .fillColor("#ffffff")
    .backgroundColor(color)
    .backgroundOpacity(0.92)
    .cornerRadius(12)
    .metadata(effectMeta(kind))
    .build();
}

function makeOverlay({ center, width, height, opacity = 0.38 }) {
  const pad = 700;
  return makeShapeBase({
    shapeType: "RECTANGLE",
    center,
    width: Math.max(width + pad, 1300),
    height: Math.max(height + pad, 900),
    color: "#050510",
    name: "Director: dark overlay",
    opacity,
    stroke: 0,
    z: 5000,
    kind: "dark-overlay"
  });
}

function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({ mode: "exploration", intensity: 50, revealTitle: "", revealText: "", threat: 0, history: [], zoneSize: 240, note: "" });
  const mode = useMemo(() => modes.find(m => m.id === state.mode) || modes[0], [state.mode]);

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true);
      try {
        const meta = await OBR.scene.getMetadata();
        if (meta[META]) setState(s => ({ ...s, ...meta[META] }));
      } catch (err) {
        console.warn("Director Mode metadata load failed", err);
      }
    });
  }, []);

  async function run(task, fallback = "Ação executada") {
    if (!ready) return alert("Abra a extensão dentro de uma sala do Owlbear.");
    setBusy(true);
    try {
      await task();
    } catch (err) {
      console.error(err);
      try { await OBR.notification.show(`Director Mode: ${err?.message || fallback}`); } catch { alert(err?.message || fallback); }
    } finally {
      setBusy(false);
    }
  }

  async function save(next) {
    setState(next);
    if (ready) await OBR.scene.setMetadata({ [META]: next });
  }

  async function applyMode(id) { await save({ ...state, mode: id }); }
  async function setIntensity(value) { await save({ ...state, intensity: Number(value) }); }

  async function addCinematicReveal(custom = {}) {
    const title = custom.title || state.revealTitle || "Reveal cinematográfico";
    const text = custom.text || state.revealText || "Algo importante foi revelado.";
    const currentMode = modes.find(m => m.id === (custom.mode || state.mode)) || mode;
    const { bounds } = await getFocusBounds();
    const center = bounds.center;
    const radius = clamp(Math.max(bounds.width || 180, bounds.height || 180) * 0.75, 90, 420);
    const color = currentMode.color;
    await OBR.scene.items.addItems([
      makeRing({ center, radius, color, name: "Director: reveal aura", opacity: 0.12, stroke: 8, kind: "reveal" }),
      makeRing({ center, radius: radius * 1.28, color, name: "Director: reveal pulse", opacity: 0.03, stroke: 4, dash: [16, 10], kind: "reveal" }),
      makeRing({ center, radius: radius * 0.36, color: "#ffffff", name: "Director: reveal core", opacity: 0.08, stroke: 2, dash: [5, 6], kind: "reveal" }),
      makeLabel({ center, text: `${title}\n${text}`, color, name: "Director: reveal label", yOffset: -radius - 70, size: 18, kind: "reveal" })
    ]);
    await save({
      ...state,
      mode: custom.mode || state.mode,
      intensity: custom.intensity ?? state.intensity,
      history: [{ title, text, at: nowLabel(), kind: "reveal" }, ...(state.history || [])].slice(0, 12)
    });
  }

  async function spotlight(label = "FOCO", color = "#facc15") {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) throw new Error("Selecione um ou mais tokens primeiro.");
    const items = [];
    for (const id of ids) {
      const bounds = await OBR.scene.items.getItemBounds([id]);
      const radius = clamp(Math.max(bounds.width || 120, bounds.height || 120) * 0.65, 55, 230);
      items.push(makeRing({ center: bounds.center, radius, color, name: `Director: ${label} aura`, opacity: 0.08, stroke: 7, kind: "token-marker" }));
      items.push(makeLabel({ center: bounds.center, text: label, color: "#7c3aed", name: `Director: ${label} label`, yOffset: -radius - 52, size: 16, kind: "token-marker" }));
    }
    await OBR.scene.items.addItems(items);
    await OBR.scene.items.updateItems(ids, selected => {
      for (const item of selected) item.metadata[TOKEN_META] = { ...(item.metadata[TOKEN_META] || {}), marker: label, ts: Date.now() };
    });
  }

  async function markStatus(status) {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) throw new Error("Selecione tokens para marcar.");
    const items = [];
    for (const id of ids) {
      const bounds = await OBR.scene.items.getItemBounds([id]);
      const radius = clamp(Math.max(bounds.width || 120, bounds.height || 120) * 0.72, 50, 240);
      items.push(makeRing({ center: bounds.center, radius, color: status.color, name: `Director: ${status.label}`, opacity: 0.04, stroke: 6, dash: [12, 8], kind: `status:${status.id}` }));
      items.push(makeLabel({ center: bounds.center, text: status.label, color: status.color, name: `Director: ${status.label} tag`, yOffset: radius * 0.55, size: 13, width: 170, kind: `status:${status.id}` }));
    }
    await OBR.scene.items.addItems(items);
  }

  async function hideSelected() {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) throw new Error("Selecione tokens/itens para ocultar.");
    await OBR.scene.items.updateItems(ids, items => { for (const item of items) item.visible = false; });
  }

  async function revealSelected() {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) throw new Error("Selecione tokens/itens para revelar.");
    await OBR.scene.items.updateItems(ids, items => { for (const item of items) item.visible = true; });
    await spotlight("REVELADO", "#38bdf8");
  }

  async function pingSelected() {
    const { bounds } = await getFocusBounds();
    const radius = clamp(Math.max(bounds.width || 100, bounds.height || 100) * 0.55, 70, 260);
    await OBR.scene.items.addItems([
      makeRing({ center: bounds.center, radius, color: "#38bdf8", name: "Director: ping outer", opacity: 0.08, stroke: 6, dash: [10, 8], kind: "ping" }),
      makeRing({ center: bounds.center, radius: radius * 0.35, color: "#38bdf8", name: "Director: ping inner", opacity: 0.02, stroke: 4, kind: "ping" })
    ]);
  }

  async function darkenArea() {
    const { bounds } = await getFocusBounds();
    await OBR.scene.items.addItems([makeOverlay({ center: bounds.center, width: bounds.width || 500, height: bounds.height || 400, opacity: 0.36 })]);
  }

  async function createZone(zone) {
    const { bounds } = await getFocusBounds();
    const size = Number(state.zoneSize || 240);
    const center = bounds.center;
    await OBR.scene.items.addItems([
      makeRing({ center, radius: size / 2, color: zone.color, name: `Director: ${zone.label}`, opacity: zone.id === "smoke" ? 0.18 : 0.08, stroke: 5, dash: zone.id === "smoke" ? [8, 7] : [], kind: `zone:${zone.id}` }),
      makeLabel({ center, text: zone.label.toUpperCase(), color: zone.color, name: `Director: ${zone.label} label`, yOffset: -size / 2 - 44, size: 14, width: 220, kind: `zone:${zone.id}` })
    ]);
  }

  async function createNote() {
    const text = state.note?.trim();
    if (!text) throw new Error("Escreva uma nota primeiro.");
    const { bounds } = await getFocusBounds();
    await OBR.scene.items.addItems([
      makeLabel({ center: bounds.center, text, color: "#4c1d95", name: "Director: scene note", yOffset: 0, size: 16, width: 360, kind: "note" })
    ]);
    await save({ ...state, note: "", history: [{ title: "Nota criada", text, at: nowLabel(), kind: "note" }, ...(state.history || [])].slice(0, 12) });
  }

  async function addThreat() {
    const nextThreat = (state.threat + 1) % 7;
    const old = await OBR.scene.items.getItems(item => item.metadata?.[EFFECT_META]?.kind === "threat-clock");
    if (old.length) await OBR.scene.items.deleteItems(old.map(item => item.id));
    const { bounds } = await getFocusBounds();
    const center = { x: bounds.center.x, y: bounds.center.y + clamp((bounds.height || 200) / 2 + 80, 120, 300) };
    const filled = "●".repeat(nextThreat) + "○".repeat(6 - nextThreat);
    await OBR.scene.items.addItems([
      makeLabel({ center, text: `RELÓGIO DE AMEAÇA ${nextThreat}/6\n${filled}`, color: nextThreat >= 5 ? "#dc2626" : "#4c1d95", name: "Director: threat clock", yOffset: 0, size: 16, width: 300, kind: "threat-clock" })
    ]);
    await save({ ...state, threat: nextThreat });
  }

  async function saveSnapshot() {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) throw new Error("Selecione os tokens para salvar posição.");
    const selected = await OBR.scene.items.getItems(ids);
    const snapshot = selected.map(item => ({ id: item.id, name: item.name, position: item.position, rotation: item.rotation || 0 }));
    const meta = await OBR.scene.getMetadata();
    const list = meta[SNAPSHOT_META] || [];
    const entry = { id: `snap-${Date.now()}`, at: nowLabel(), count: snapshot.length, snapshot };
    await OBR.scene.setMetadata({ [SNAPSHOT_META]: [entry, ...list].slice(0, 5) });
    await save({ ...state, history: [{ title: "Snapshot salvo", text: `${snapshot.length} item(ns)`, at: nowLabel(), kind: "snapshot" }, ...(state.history || [])].slice(0, 12) });
  }

  async function restoreSnapshot() {
    const meta = await OBR.scene.getMetadata();
    const entry = (meta[SNAPSHOT_META] || [])[0];
    if (!entry) throw new Error("Nenhum snapshot salvo nesta cena.");
    const ids = entry.snapshot.map(s => s.id);
    await OBR.scene.items.updateItems(ids, items => {
      for (const item of items) {
        const saved = entry.snapshot.find(s => s.id === item.id);
        if (saved?.position) item.position = saved.position;
        if (typeof saved?.rotation === "number") item.rotation = saved.rotation;
      }
    });
  }

  async function clearEffects(kindPrefix = null) {
    const fx = await OBR.scene.items.getItems(item => {
      const kind = item.metadata?.[EFFECT_META]?.kind;
      return kindPrefix ? String(kind || "").startsWith(kindPrefix) : Boolean(kind);
    });
    if (fx.length) await OBR.scene.items.deleteItems(fx.map(item => item.id));
  }


  async function createObjectiveCard(text = "OBJETIVO\nInterrompa o ritual") {
    const { bounds } = await getFocusBounds();
    const center = bounds.center;
    await OBR.scene.items.addItems([
      makeRing({ center, radius: 110, color: "#8b5cf6", name: "Director: objective pulse", opacity: 0.06, stroke: 5, dash: [9, 7], kind: "objective" }),
      makeLabel({ center, text, color: "#312e81", name: "Director: objective card", yOffset: 30, size: 16, width: 330, kind: "objective" })
    ]);
    await save({ ...state, history: [{ title: "Objetivo criado", text: text.replace(/\n/g, " · "), at: nowLabel(), kind: "objective" }, ...(state.history || [])].slice(0, 12) });
  }

  async function createClueMarker(text = "PISTA\nAlgo aqui importa") {
    const { bounds } = await getFocusBounds();
    const center = bounds.center;
    await OBR.scene.items.addItems([
      makeRing({ center, radius: 70, color: "#fbbf24", name: "Director: clue glow", opacity: 0.09, stroke: 7, kind: "clue-marker" }),
      makeRing({ center, radius: 105, color: "#fbbf24", name: "Director: clue outer", opacity: 0.02, stroke: 3, dash: [7, 9], kind: "clue-marker" }),
      makeLabel({ center, text, color: "#92400e", name: "Director: clue label", yOffset: 92, size: 15, width: 260, kind: "clue-marker" })
    ]);
  }

  async function directorMove(move) {
    if (move.id === "cold-open") {
      await darkenArea();
      await createClueMarker("PISTA\nO silêncio denuncia algo");
      await addThreat();
      await addCinematicReveal({ mode: "investigation", intensity: 60, title: "O ar muda", text: "A cena prende a respiração." });
    }
    if (move.id === "boss-reveal") {
      await spotlight("BOSS", "#f43f5e").catch(() => {});
      await markStatus(statuses.find(s => s.id === "boss")).catch(() => {});
      await addThreat();
      await addCinematicReveal({ mode: "boss", intensity: 100, title: "A presença desperta", text: "O verdadeiro inimigo toma o centro da cena." });
    }
    if (move.id === "objective") {
      await createZone(zones.find(z => z.id === "objective"));
      await createObjectiveCard("OBJETIVO\nConquiste isto antes que seja tarde");
      await pingSelected();
    }
    if (move.id === "panic") {
      await createZone(zones.find(z => z.id === "danger"));
      await pingSelected();
      await addThreat();
      await addCinematicReveal({ mode: "chase", intensity: 90, title: "A cena vira", text: "Agora tudo tem consequência imediata." });
    }
  }

  async function applyPreset(p) {
    await save({ ...state, mode: p.mode, intensity: p.intensity });
    if (p.fx === "dark") await darkenArea();
    if (p.fx === "threat") await addThreat();
    if (p.fx === "boss") await spotlight("BOSS", "#f43f5e").catch(() => {});
    if (p.fx === "clue") await pingSelected();
    if (p.fx === "escape") await addThreat();
    await addCinematicReveal(p);
  }

  return <main className="director-shell v06">
    <header className="dm-topbar hero-top">
      <div className="brand">
        <div className="brand-icon crest"><Clapperboard size={24}/></div>
        <div className="brand-copy">
          <h1>Director Mode <small className="version">v0.6</small></h1>
          <p className="connection"><span className={ready ? "connection-dot on" : "connection-dot"}></span>{ready ? "Conectado ao Owlbear" : "Abra pelo Owlbear"} · Mesa cinematográfica</p>
        </div>
      </div>
      <div className="quick-actions command-ribbon">
        <button className="top-action" disabled={busy} onClick={() => run(hideSelected)}><EyeOff size={16}/><span><b>Ocultar</b><small>seleção</small></span></button>
        <button className="top-action" disabled={busy} onClick={() => run(revealSelected)}><Eye size={16}/><span><b>Revelar</b><small>+ foco</small></span></button>
        <button className="top-action danger" disabled={busy} onClick={() => run(() => clearEffects())}><Trash2 size={16}/><span><b>Limpar</b><small>efeitos</small></span></button>
        <button className="top-action primary" disabled={busy} onClick={() => run(saveSnapshot)}><Save size={16}/><span><b>Salvar cena</b><small>snapshot</small></span></button>
      </div>
    </header>

    <div className="scene-strip">
      <button className="scene-tab active">1. Entrada</button>
      <button className="scene-tab">2. Suspense</button>
      <button className="scene-tab">3. Ritual</button>
      <button className="scene-tab">4. Reforços</button>
      <button className="scene-tab ghost">+ Nova cena</button>
    </div>

    <div className="dm-layout command-center">
      <nav className="rail">
        <span className="rail-active"><Eye size={18}/>Revelar</span>
        <span><Star size={18}/>Tokens</span>
        <span><Crosshair size={18}/>Zonas</span>
        <span><Clock3 size={18}/>Relógio</span>
        <span><Sparkles size={18}/>Presets</span>
      </nav>

      <div className="control-panel v06-panel">
        <section className="card director-card featured">
          <div className="card-title-row"><h2>Comandos de diretor</h2><span className="badge-live">Novo</span></div>
          <p className="hint">Botões macro que combinam reveal, foco, zonas e relógio. É aqui que a extensão começa a ficar útil.</p>
          <div className="move-grid">{directorMoves.map(m => <button key={m.id} className={`move-card ${m.tone}`} disabled={busy} onClick={() => run(() => directorMove(m))}><b>{m.label}</b><small>{m.subtitle}</small></button>)}</div>
        </section>

        <section className="card compact-card"><h2>Estado da cena</h2><div className="state-grid cinematic">{modes.map(m => <button key={m.id} style={{"--mode-color": m.color}} className={state.mode === m.id ? "mode-button active" : "mode-button"} onClick={() => run(() => applyMode(m.id))}><span className="mode-swatch"></span>{m.label}</button>)}</div><label><span>Intensidade dramática <b>{state.intensity}%</b></span></label><input type="range" min="0" max="100" value={state.intensity} onChange={e => setIntensity(e.target.value)} /></section>

        <section className="card compact-card"><h2><Eye size={18}/> Reveal cinematográfico</h2><input placeholder="Título" value={state.revealTitle} onChange={e => setState({ ...state, revealTitle: e.target.value })}/><textarea placeholder="Texto para a revelação" value={state.revealText} onChange={e => setState({ ...state, revealText: e.target.value })}/><div className="button-row"><button disabled={busy} className="dm-button primary" onClick={() => run(() => addCinematicReveal())}><Zap size={16}/> Reveal</button><button className="dm-button" disabled={busy} onClick={() => run(createClueMarker)}><Target size={15}/> Pista</button><button className="dm-button" disabled={busy} onClick={() => run(createObjectiveCard)}><MapPin size={15}/> Objetivo</button></div></section>

        <section className="card compact-card"><h2><Star size={18}/> Tokens selecionados</h2><div className="button-row"><button className="dm-button" disabled={busy} onClick={() => run(() => spotlight())}>Spotlight</button><button className="dm-button" disabled={busy} onClick={() => run(pingSelected)}>Ping</button><button className="dm-button" disabled={busy} onClick={() => run(hideSelected)}><EyeOff size={14}/> Ocultar</button><button className="dm-button" disabled={busy} onClick={() => run(revealSelected)}><Eye size={14}/> Revelar</button></div><div className="chipGrid premium-chips">{statuses.map(s => <button className="status-button" disabled={busy} key={s.id} style={{ "--chip": s.color }} onClick={() => run(() => markStatus(s))}>{s.label}</button>)}</div></section>

        <section className="card compact-card"><h2><Crosshair size={18}/> Zonas + notas</h2><label>Tamanho da zona <b>{state.zoneSize || 240}px</b></label><input type="range" min="80" max="600" step="20" value={state.zoneSize || 240} onChange={e => setState({ ...state, zoneSize: Number(e.target.value) })}/><div className="button-row">{zones.map(z => { const Icon = z.icon; return <button className="zone-button" disabled={busy} key={z.id} onClick={() => run(() => createZone(z))}><Icon size={14}/>{z.label}</button>; })}</div><textarea placeholder="Nota rápida na cena" value={state.note || ""} onChange={e => setState({ ...state, note: e.target.value })}/><button className="dm-button wide" disabled={busy} onClick={() => run(createNote)}><MapPin size={15}/> Fixar nota no mapa</button></section>

        <section className="card compact-card"><h2><Sparkles size={18}/> Ferramentas e limpeza</h2><div className="button-row"><button className="dm-button" disabled={busy} onClick={() => run(darkenArea)}>Overlay escuro</button><button className="dm-button" disabled={busy} onClick={() => run(addThreat)}><Clock3 size={14}/> Ameaça {state.threat}/6</button><button className="dm-button" disabled={busy} onClick={() => run(saveSnapshot)}><Save size={14}/> Salvar posições</button><button className="dm-button" disabled={busy} onClick={() => run(restoreSnapshot)}><RotateCcw size={14}/> Restaurar</button><button className="dm-button" disabled={busy} onClick={() => run(() => clearEffects("status:"))}>Limpar marcadores</button><button className="dm-button" disabled={busy} onClick={() => run(() => clearEffects("zone:"))}>Limpar zonas</button><button disabled={busy} className="dm-button danger" onClick={() => run(() => clearEffects())}><Trash2 size={14}/> Tudo</button></div></section>
      </div>

      <aside className="preview-board v06-preview" aria-label="Prévia visual do Director Mode">
        <div className="preview-header"><span className="scene-name">Salão do Sacrifício</span><div className="preview-tools"><span className="mini-chip">{mode.label}</span><span className="mini-chip">Ameaça {state.threat}/6</span><span className="mini-chip">{state.intensity}% drama</span></div></div>
        <div className="battlemap deluxe">
          <div className="ritual-grid"></div><div className="reveal-ring"></div><div className="reveal-ring second"></div><div className="fog"></div><div className="danger-zone"></div><div className="safe-zone"></div>
          <div className="callout reveal">Revelação cinematográfica</div><div className="callout danger-call">Zona de perigo</div><div className="callout objective-call">Objetivo fixado</div>
          <div className="map-label clue">PISTA · Símbolo antigo</div><div className="map-label zone">ZONA DE PERIGO</div><div className="map-label obj">OBJETIVO · Interromper ritual</div>
          <div className="token boss">♛<span>BOSS</span></div><div className="token hero1">T<span>THALION</span></div><div className="token hero2">L<span>LIRIA</span></div><div className="token hero3">D<span>DORAN</span></div>
          <div className="threat-preview"><b>RELÓGIO DE AMEAÇA</b><div className="threat-dots"><b className={state.threat >= 1 ? "active" : ""}>1</b><b className={state.threat >= 2 ? "active" : ""}>2</b><b className={state.threat >= 3 ? "active" : ""}>3</b><b className={state.threat >= 4 ? "active" : ""}>4</b><b className={state.threat >= 5 ? "active" : ""}>5</b><b className={state.threat >= 6 ? "active" : ""}>6</b></div><small>A tensão aumenta. Escolhas têm consequências.</small></div>
        </div>
        <div className="preview-footer"><span className="mini-chip">Players (5)</span><div className="mini-tools"><span className="mini-chip">Mão</span><span className="mini-chip">Régua</span><span className="mini-chip">Dados</span><span className="mini-chip">Música</span></div></div>
      </aside>
    </div>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
