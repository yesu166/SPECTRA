import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, Check, ChevronDown, CircleHelp,
  Clock3, Crosshair, Eye, Gauge, Grid2X2, Layers3, Map, Moon, Pause,
  Play, Radio, RotateCcw, Save, Settings2, Shield, Sun, SunMoon, Target,
  Waves, Wind,
} from "lucide-react";
import TacticalMap from "./components/TacticalMap";
import DigitalTwin from "./components/DigitalTwin";
import AfterActionReview from "./components/AfterActionReview";
import {
  createEvent, DEFAULT_CONFIG, SCENARIOS, scenarioFor, SimulationSession,
  type Config, type ContactClassification, type ConfidenceLevel, type ContactView,
  type InputMethod, type SessionEvent, type SessionSnapshot, type TraineeAction,
} from "./simulation";

const STORAGE_KEY = "spectra-simulator-sessions-v1";
function loadSessions(): SessionSnapshot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Array<Record<string, unknown>>;
    // Strip truth-bearing fields from sessions created by older builds.
    const safe = parsed.map((session) => {
      const copy = { ...session };
      delete copy.entities;
      delete copy.observations;
      return copy as unknown as SessionSnapshot;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch { return []; }
}
function timeLabel(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`; }

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const engineRef = useRef<SimulationSession | null>(null);
  if (engineRef.current === null) engineRef.current = new SimulationSession(DEFAULT_CONFIG);
  const [contacts, setContacts] = useState<ContactView[]>(() => engineRef.current!.getContacts());
  const [selectedId, setSelectedId] = useState<string | null>("C-01");
  const [operatorConfidence, setOperatorConfidence] = useState<ConfidenceLevel>("MEDIUM");
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [sessions, setSessions] = useState<SessionSnapshot[]>(() => loadSessions());
  const [sessionStarted, setSessionStarted] = useState(new Date().toISOString());
  const [notice, setNotice] = useState("SIMULATION READY · SELECT A SCENARIO");
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [perf, setPerf] = useState({ fps: 0, simHz: 0, frameMs: 0 });
  const performanceRef = useRef({ frames: 0, steps: 0, frameMsSum: 0, windowStart: 0 });
  const simulationHz = 30;
  const fixedStepSeconds = 1 / simulationHz;
  const eventsRef = useRef<SessionEvent[]>([]);
  const tickRef = useRef(0);
  const elapsedRef = useRef(0);
  const configRef = useRef<Config>(config);
  const eventCounter = useRef(0);

  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { configRef.current = config; }, [config]);

  const record = useCallback((
    type: SessionEvent["type"],
    title: string,
    detail: string,
    time: number,
    metadata: Partial<Pick<SessionEvent, "action" | "inputMethod" | "confidence" | "classification" | "contactId" | "tick" | "evidenceEventIds">> = {},
  ) => {
    eventCounter.current += 1;
    const event = {
      ...createEvent(type, title, detail, time, `event-${eventCounter.current}`, metadata.tick ?? tickRef.current, metadata.evidenceEventIds),
      ...metadata,
    };
    setEvents((previous) => {
      const next = [...previous, event].slice(-500);
      eventsRef.current = next;
      return next;
    });
    return event;
  }, []);

  const handleTraineeAction = useCallback((
    action: TraineeAction,
    confidence: ConfidenceLevel,
    inputMethod: InputMethod,
    classification?: ContactClassification,
    contactId?: string,
  ) => {
    const titles: Record<TraineeAction, string> = {
      OBSERVE: "Observation acknowledged",
      REQUEST_MORE_INFO: "Requested more information",
      REPORT: "Contact reported",
      ESCALATE: "Concern escalated",
      AUTHORIZE_RESPONSE: "Abstract response authorised",
      DEFER: "Decision deferred",
      CLASSIFY: "Contact classified",
      SET_CONFIDENCE: "Confidence setting changed",
    };
    if (action === "SET_CONFIDENCE") setOperatorConfidence(confidence);

    const evidenceEventIds: string[] = [];
    if (action === "REQUEST_MORE_INFO" && contactId && tickRef.current > 0) {
      const refreshedContacts = engineRef.current?.requestMoreInfo(contactId) ?? [];
      setContacts(refreshedContacts);
      const refreshed = refreshedContacts.find((item) => item.id === contactId);
      if (refreshed) {
        const available = refreshed.source !== "SIMULATED CAMERA" || refreshed.status !== "UNOBSERVED";
        const evidence = record(
          "OBSERVATION",
          available ? "Secondary synthetic observation received" : "Secondary observation unavailable",
          `${contactId} · ${refreshed.source ?? "SIMULATED CAMERA"} · ${refreshed.note ?? "No additional detail"} · confidence ${refreshed.confidence ?? 0}%`,
          elapsedRef.current,
          { contactId, tick: tickRef.current },
        );
        evidenceEventIds.push(evidence.id);
      }
    }

    const methodLabel = inputMethod === "gaze" ? "gaze-and-hold" : inputMethod;
    const details = [
      contactId ? `Contact ${contactId}` : "No contact selected",
      classification ? `classification ${classification.replaceAll("_", " ").toLowerCase()}` : "",
      `confidence ${confidence.toLowerCase()}`,
      `input ${methodLabel}`,
      action === "REQUEST_MORE_INFO"
        ? (tickRef.current > 0 ? "secondary synthetic sample requested" : "start the exercise before requesting a sample")
        : "",
    ].filter(Boolean).join(" · ");
    record("ACTION", titles[action], details, elapsedRef.current, {
      action, confidence, inputMethod, classification, contactId, tick: tickRef.current,
      ...(evidenceEventIds.length ? { evidenceEventIds } : {}),
    });
    setNotice(`ACTION RECORDED · ${titles[action].toUpperCase()}`);
  }, [record]);

  const toggleExercise = useCallback((inputMethod: InputMethod = "mouse") => {
    const nextRunning = !running;
    if (!nextRunning) {
      setContacts(engineRef.current?.getContacts() ?? []);
      setTick(tickRef.current);
      setElapsed(elapsedRef.current);
    }
    lastFrameTimeRef.current = null;
    accumulatorRef.current = 0;
    setRunning(nextRunning);
    record(
      "SESSION",
      nextRunning ? "Exercise resumed" : "Exercise paused",
      nextRunning ? "Simulation clock resumed by operator." : "Simulation clock paused by operator.",
      elapsedRef.current,
      { inputMethod, tick: tickRef.current },
    );
    setNotice(nextRunning ? "EXERCISE RUNNING" : "EXERCISE PAUSED");
  }, [record, running]);

  const initialEvents = useCallback((cfg: Config): SessionEvent[] => [
    createEvent("SESSION", "Exercise initialized", `${SCENARIOS.find((item) => item.id === cfg.scenarioId)?.name ?? "Scenario"} · seed ${cfg.seed}`, 0, "event-1"),
    createEvent("ENVIRONMENT", "Environment configured", `${cfg.environment} · ${cfg.lighting} · ${cfg.visibility}`, 0, "event-2"),
    createEvent("SENSOR", "Synthetic sensor online", `Observation quality set to ${cfg.sensorQuality}%`, 0, "event-3"),
  ], []);

  const resetScenario = useCallback((cfg: Config, announce = true) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setRunning(false);
    tickRef.current = 0; elapsedRef.current = 0; eventCounter.current = 3;
    accumulatorRef.current = 0; lastFrameTimeRef.current = null;
    setTick(0); setElapsed(0); setOperatorConfidence("MEDIUM");
    const engine = new SimulationSession(cfg);
    engineRef.current = engine;
    const initialContacts = engine.getContacts();
    setContacts(initialContacts);
    setSelectedId(initialContacts[0]?.id ?? null);
    setSessionStarted(new Date().toISOString());
    const log = initialEvents(cfg);
    eventsRef.current = log; setEvents(log);
    if (announce) setNotice(`NEW EXERCISE · ${cfg.scenarioId.replaceAll("-", " ").toUpperCase()}`);
  }, [initialEvents]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const simulationStep = useCallback(() => {
    const cfg = configRef.current;
    tickRef.current += 1;
    elapsedRef.current += fixedStepSeconds;
    const currentTick = tickRef.current;
    const nextContacts = engineRef.current?.step(fixedStepSeconds) ?? [];
    if (currentTick % 2 === 0) {
      setContacts(nextContacts);
      setTick(currentTick);
      setElapsed(elapsedRef.current);
    }
    if (currentTick % simulationHz === 1 && nextContacts.length) {
      const candidate = nextContacts[Math.floor((currentTick * 7 + cfg.seed) % nextContacts.length)];
      if (candidate.status === "TRACK") record(
        "DETECTION", `Contact observed · ${candidate.id}`,
        `Synthetic sensor observation · confidence ${candidate.confidence ?? 0}% · identity not inferred from sensor alone`,
        elapsedRef.current, { contactId: candidate.id, tick: currentTick },
      );
      else record(
        "SENSOR", `Observation gap · ${candidate.id}`,
        "No observation was available for this simulated tick.",
        elapsedRef.current, { contactId: candidate.id, tick: currentTick },
      );
    }
    if (currentTick % (simulationHz * 5) === 0) record(
      "SENSOR", "Sensor status update",
      `${nextContacts.filter((item) => item.status === "TRACK").length} current tracks · ${nextContacts.filter((item) => item.status === "UNOBSERVED").length} unobserved`,
      elapsedRef.current, { tick: currentTick },
    );
  }, [record]);

  useEffect(() => {
    if (!running) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
      accumulatorRef.current = 0;
      return;
    }

    let alive = true;
    const measurement = performanceRef.current;
    let renderedFrames = 0;
    let simulatedSteps = 0;
    let accumulatedFrameMs = 0;
    measurement.frames = 0;
    measurement.steps = 0;
    measurement.frameMsSum = 0;
    measurement.windowStart = 0;
    const MAX_FRAME_DELTA = 0.1;
    const MAX_CATCH_UP_STEPS = 3;

    const onVisibilityChange = () => {
      lastFrameTimeRef.current = null;
      accumulatorRef.current = 0;
    };
    const stepOnce = () => {
      simulationStep();
      setContacts(engineRef.current?.getContacts() ?? []);
      setTick(tickRef.current);
      setElapsed(elapsedRef.current);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const frame = (now: number) => {
      if (!alive) return;
      const previous = lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      const rawDelta = previous === null || document.hidden ? 0 : (now - previous) / 1000;
      const delta = Math.max(0, Math.min(rawDelta, MAX_FRAME_DELTA));
      if (!document.hidden) {
        accumulatorRef.current += delta;
        let steps = 0;
        while (accumulatorRef.current >= fixedStepSeconds && steps < MAX_CATCH_UP_STEPS) {
          simulationStep();
          accumulatorRef.current -= fixedStepSeconds;
          steps += 1;
          simulatedSteps += 1;
        }
        if (steps === MAX_CATCH_UP_STEPS && accumulatorRef.current >= fixedStepSeconds) {
          // Drop excessive backlog to avoid the spiral of death on slow machines.
          accumulatorRef.current = Math.min(accumulatorRef.current, fixedStepSeconds * 0.5);
        }
      }
      renderedFrames += 1;
      measurement.frames = renderedFrames;
      measurement.steps = simulatedSteps;
      accumulatedFrameMs += Math.max(0, now - (previous ?? now));
      measurement.frameMsSum = accumulatedFrameMs;
      if (measurement.windowStart === 0) measurement.windowStart = now;
      if (now - measurement.windowStart >= 500) {
        const span = Math.max(0.001, (now - measurement.windowStart) / 1000);
        if (showPerformance) {
          setPerf({
            fps: Math.round(measurement.frames / span),
            simHz: Math.round(measurement.steps / span),
            frameMs: Number((measurement.frameMsSum / Math.max(1, measurement.frames)).toFixed(1)),
          });
        }
        renderedFrames = 0;
        simulatedSteps = 0;
        accumulatedFrameMs = 0;
        measurement.frames = 0;
        measurement.steps = 0;
        measurement.frameMsSum = 0;
        measurement.windowStart = now;
      }
      frameRef.current = requestAnimationFrame(frame);
    };

    frameRef.current = requestAnimationFrame(frame);
    return () => {
      alive = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameTimeRef.current = null;
      accumulatorRef.current = 0;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [running, simulationStep, showPerformance]);

  const updateConfig = (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next); configRef.current = next;
    setNotice("CONFIGURATION UPDATED · APPLY SETTINGS TO RESET SCENARIO");
  };
  const chooseScenario = (id: string) => {
    const template = scenarioFor(id);
    const next = { ...config, ...template, seed: config.seed };
    setConfig(next); configRef.current = next; resetScenario(next);
  };

  const selected = contacts.find((contact) => contact.id === selectedId) ?? contacts[0];
  const selectedObservation = selected;
  const tracked = contacts.filter((item) => item.status === "TRACK").length;
  const intermittent = contacts.filter((item) => item.status === "INTERMITTENT").length;
  const unobserved = contacts.filter((item) => item.status === "UNOBSERVED").length;
  const sensorHealth = Math.max(8, Math.min(100, config.sensorQuality - (config.visibility === "fog" ? 18 : config.visibility === "haze" ? 8 : 0) - (config.lighting === "night" ? 4 : 0)));
  const scenario = SCENARIOS.find((item) => item.id === config.scenarioId) ?? SCENARIOS[0];
  const canOperate = tick > 0 && !!selected;
  const actionEvents = events.filter((event) => event.type === "ACTION" && event.action);
  const classifiedContactCount = new Set(actionEvents.filter((event) => event.action === "CLASSIFY" && event.contactId).map((event) => event.contactId)).size;
  const reportedContactCount = new Set(actionEvents.filter((event) => event.action === "REPORT" && event.contactId).map((event) => event.contactId)).size;
  const latestClassificationEvent = selected
    ? events.slice().reverse().find((event) => event.contactId === selected.id && event.action === "CLASSIFY")
    : undefined;
  const latestContactAction = selected
    ? events.slice().reverse().find((event) => event.contactId === selected.id && event.type === "ACTION" && event.action !== "SET_CONFIDENCE")
    : undefined;
  const latestDecisionByContact: Record<string, SessionEvent> = {};
  for (const event of events) {
    if (event.contactId && event.type === "ACTION" && event.action && event.action !== "SET_CONFIDENCE" && event.action !== "OBSERVE") {
      latestDecisionByContact[event.contactId] = event;
    }
  }
  const missionObjective = ({
    "perimeter-watch": "Build a cautious contact picture. Confirm what the observations support; defer when evidence is insufficient.",
    "urban-observation": "Work with interrupted observations. Record uncertainty rather than treating a missing return as proof of identity.",
    "rural-site": "Acknowledge contact observations, compare additional evidence and avoid unsupported classification.",
    "multi-contact": "Triage several synthetic contacts, investigate ambiguous observations and record evidence-based decisions.",
  } as Record<string, string>)[config.scenarioId] ?? "Review the observation feed and make evidence-based decisions.";

  const saveSession = () => {
    const snapshot: SessionSnapshot = { id: `session-${Date.now()}`, startedAt: sessionStarted, config, duration: elapsedRef.current, events: eventsRef.current, contacts, tick: tickRef.current };
    const next = [snapshot, ...loadSessions()].slice(0, 12);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSessions(next);
      record("SESSION", "Session saved locally", `${snapshot.events.length} events · duration ${timeLabel(snapshot.duration)}`, elapsedRef.current);
      setNotice("SESSION SAVED LOCALLY");
    } catch { setNotice("SAVE FAILED · BROWSER STORAGE MAY BE FULL"); }
  };

  const loadSession = (session: SessionSnapshot) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null; setRunning(false);
    setConfig(session.config); configRef.current = session.config;
    eventsRef.current = session.events; setEvents(session.events); eventCounter.current = session.events.length;
    setElapsed(session.duration); elapsedRef.current = session.duration;
    setTick(session.tick ?? session.duration); tickRef.current = session.tick ?? session.duration;
    const restoredEngine = new SimulationSession(session.config);
    const restoredContacts = restoredEngine.advanceTo(session.tick ?? session.duration);
    engineRef.current = restoredEngine;
    setContacts(restoredContacts);
    setSessionStarted(session.startedAt); setSelectedId(restoredContacts[0]?.id ?? null);
    setNotice("SESSION LOADED · CONFIGURATION AND EVENT HISTORY RESTORED");
  };

  const exportAar = () => {
    const payload = { product: "SPECTRA Combined Simulator", exportedAt: new Date().toISOString(), config, elapsedSeconds: elapsedRef.current, tick: tickRef.current, contacts, events: eventsRef.current, note: "Synthetic training simulation. Export contains trainee-visible observations only and excludes ground-truth classifications. Decision-tree scoring is planned for a future phase." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `spectra-aar-seed-${config.seed}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice("AAR EXPORTED · JSON EVENT RECORD");
  };

  const generateVariant = () => {
    const seedSource = ((Date.now() ^ config.seed ^ (tickRef.current * 2654435761)) >>> 0) || 1;
    const variantRng = (seedValue: number) => {
      let value = seedValue >>> 0;
      return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    };
    const random = variantRng(seedSource);
    const nextSeed = 10000 + Math.floor(random() * 800000);
    const next = { ...config, seed: nextSeed, contactCount: Math.max(3, Math.min(18, config.contactCount + Math.floor(random() * 5) - 2)) };
    setConfig(next); configRef.current = next; resetScenario(next);
    record("SESSION", "Procedural variant generated", `New reproducible seed ${next.seed} · ${next.contactCount} contacts`, 0);
    setNotice(`VARIANT GENERATED · SEED ${next.seed}`);
  };

  return (
    <div className={`app-shell theme-${config.lighting}`}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Crosshair size={21}/></div><div className="brand-word"><strong>SPECTRA</strong><span>SIMULATION & TRAINING ENVIRONMENT</span></div></div>
        <div className="topbar-center"><span className="online-pip" /> LOCAL SIMULATION <span className="topbar-divider">/</span> NO LIVE SENSOR CONNECTION</div>
        <div className="topbar-right"><span className="mode-pill"><Shield size={13}/> TRAINING MODE</span><span className="top-clock">{new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span></div>
      </header>
      <main className="workspace">
        <aside className="control-rail">
          <div className="rail-heading"><Target size={15}/><span>TRAINING WORKSPACE</span></div>
          <div className="quick-scenario">
            <label className="field-label" htmlFor="scenario-template">EXERCISE</label>
            <div className="select-wrap"><select id="scenario-template" value={config.scenarioId} onChange={(event) => chooseScenario(event.target.value)}>{SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14}/></div>
            <p className="control-help">{scenario.description}</p>
          </div>
          <button className="advanced-settings-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            <span><Settings2 size={14}/> Advanced settings</span><span>{advancedOpen ? "Hide" : "Configure"} <ChevronDown size={13} className={advancedOpen ? "rotate-chevron" : ""}/></span>
          </button>
          {advancedOpen && <div className="advanced-settings-panel">
            <label className="field-label">ENVIRONMENT</label>
            <div className="segmented">{([["urban","Urban",Grid2X2],["rural","Rural",Wind],["perimeter","Site",Map]] as const).map(([value,label,Icon]) => <button key={value} className={config.environment===value?"active":""} onClick={() => updateConfig({environment:value})}><Icon size={13}/>{label}</button>)}</div>
            <label className="field-label">LIGHTING</label>
            <div className="segmented">{([["day","Day",Sun],["dusk","Dusk",SunMoon],["night","Night",Moon]] as const).map(([value,label,Icon]) => <button key={value} className={config.lighting===value?"active":""} onClick={() => updateConfig({lighting:value})}><Icon size={13}/>{label}</button>)}</div>
            <label className="field-label">VISIBILITY</label>
            <div className="segmented">{(["clear","haze","fog"] as const).map((value) => <button key={value} className={config.visibility===value?"active":""} onClick={() => updateConfig({visibility:value})}>{value==="clear"?"Clear":value==="haze"?"Haze":"Fog"}</button>)}</div>
            <div className="range-label"><label className="field-label">SENSOR QUALITY</label><strong>{config.sensorQuality}%</strong></div><input aria-label="Sensor quality" className="range-input" type="range" min="25" max="100" step="5" value={config.sensorQuality} onChange={(event) => updateConfig({sensorQuality:Number(event.target.value)})}/>
            <div className="range-label"><label className="field-label">DIFFICULTY</label><strong>LEVEL {config.difficulty}</strong></div><input aria-label="Difficulty" className="range-input" type="range" min="1" max="5" value={config.difficulty} onChange={(event) => updateConfig({difficulty:Number(event.target.value)})}/>
            <div className="range-label"><label className="field-label">CONTACT COUNT</label><strong>{config.contactCount}</strong></div><input aria-label="Contact count" className="range-input" type="range" min="1" max="18" value={config.contactCount} onChange={(event) => updateConfig({contactCount:Number(event.target.value)})}/>
            <label className="field-label">SCENARIO SEED</label><div className="seed-control"><input type="number" min="1" max="99999999" value={config.seed} onChange={(event) => updateConfig({seed:Number(event.target.value)||1})}/><button title="Generate a new procedural variant" onClick={generateVariant}><RotateCcw size={14}/></button></div>
            <button className="secondary-button full-width" onClick={() => resetScenario(config)}><RotateCcw size={14}/> Apply settings & reset</button>
          </div>}
          <div className="rail-bottom"><div className="offline-lock"><Shield size={15}/><div><strong>Local training</strong><span>Synthetic contacts · no live sensor connection.</span></div></div><button className="text-button" onClick={() => setNotice("SPECTRA PROTOTYPE · DECISIONS ARE RECORDED, FORMAL SCORING IS NOT YET VALIDATED")}><CircleHelp size={13}/> About this build</button></div>
        </aside>
        <section className="main-column">
          <div className="page-intro"><div><div className="eyebrow">COMMAND & TRAINING / WORKSPACE 01</div><h1>Common operating picture</h1><p>Observation-derived awareness across 2D and 3D views.</p></div><div className="intro-actions"><span className="seed-chip">SEED <b>{config.seed}</b></span><span className="status-chip"><span className="status-dot"/> {running?"EXERCISE RUNNING":"EXERCISE PAUSED"}</span></div></div>
          <div className="metric-row">
            {[
              {label:"CURRENT TRACKS",value:tracked,tint:"mint",Icon:Radio,sub:"Current"},{label:"INTERMITTENT",value:intermittent,tint:"amber",Icon:Activity,sub:"Observation"},{label:"UNOBSERVED",value:unobserved,tint:"rose",Icon:AlertTriangle,sub:"Current tick"},{label:"SENSOR QUALITY",value:`${sensorHealth}%`,tint:"blue",Icon:Gauge,sub:"Synthetic"},
            ].map((metric) => <div className="metric-card" key={metric.label}><div className={`metric-icon ${metric.tint}`}><metric.Icon size={16}/></div><div><span>{metric.label}</span><strong>{typeof metric.value==="number"?metric.value.toString().padStart(2,"0"):metric.value}</strong></div><small>{metric.sub}</small></div>)}
          </div>
          <section className="mission-brief">
            <div className="mission-brief-icon"><Target size={17}/></div>
            <div className="mission-brief-copy"><div className="eyebrow">OPERATOR TASK / {scenario.name.toUpperCase()}</div><strong>Build an evidence-based contact picture</strong><p>{missionObjective}</p><div className="mission-progress"><span>{tracked} tracked</span><span>{classifiedContactCount} classified</span><span>{reportedContactCount} reported</span><span>{actionEvents.length} decisions recorded</span></div></div>
            <button className="mission-launch" onClick={() => !running ? toggleExercise("mouse") : selected ? handleTraineeAction("OBSERVE", operatorConfidence, "mouse", undefined, selected.id) : toggleExercise("mouse")}>{running ? "ACKNOWLEDGE CONTACT" : tick > 0 ? "RESUME EXERCISE" : "START EXERCISE"} {running ? <Check size={14}/> : <Play size={14}/>}</button>
          </section>
          <div className="view-grid">
            <section className="panel map-panel"><div className="panel-heading"><div><div className="eyebrow">VIEW 01 / TACTICAL AWARENESS</div><h2>Contact map</h2></div><span className="live-label"><span className="live-dot"/>{running?"UPDATING":"STANDBY"}</span></div><TacticalMap contacts={contacts} selectedId={selectedId} onSelect={setSelectedId} lighting={config.lighting}/><div className="legend"><span><i className="legend-dot mint-dot"/> Track</span><span><i className="legend-dot amber-dot"/> Intermittent</span><span><i className="legend-dot rose-dot"/> Observation unavailable</span><span className="legend-note">Status reflects synthetic observations, not identity</span></div></section>
            <section className="panel twin-panel"><div className="panel-heading"><div><div className="eyebrow">VIEW 02 / DIGITAL TWIN</div><h2>Environment</h2></div><span className="view-tag"><Layers3 size={12}/> 3D VIEW</span></div><DigitalTwin contacts={contacts} config={config} selectedId={selectedId} onSelect={setSelectedId} elapsedSeconds={elapsed} isRunning={running} onToggleSimulation={toggleExercise} onTraineeAction={handleTraineeAction}/><div className="twin-footer"><span><span className="live-dot"/> Last-observed locations only</span><span>LIGHTING: {config.lighting.toUpperCase()}</span><span>VIS: {config.visibility.toUpperCase()}</span></div></section>
          </div>
          <div className="lower-grid">
            <section className="panel contact-panel"><div className="panel-heading"><div><div className="eyebrow">SYNTHETIC SENSOR FEED</div><h2>Contact register</h2></div><span className="count-pill">{contacts.length} CONTACTS</span></div><div className="contact-table-wrap"><table className="contact-table"><thead><tr><th>CONTACT</th><th>OBSERVATION</th><th>CONF.</th><th>ALT.</th><th>SELECT</th></tr></thead><tbody>{contacts.slice(0,8).map((contact) => {const status=contact.status;const decision=latestDecisionByContact[contact.id];return <tr key={contact.id} className={selectedId===contact.id?"selected-row":""} onClick={()=>setSelectedId(contact.id)}><td><span className={`entity-dot ${status==="TRACK"?"track":status==="INTERMITTENT"?"intermittent":status==="UNOBSERVED"?"unobserved":"pending"}`}/><strong>{contact.id}</strong><small>{status==="TRACK"?"TRACK OBSERVED":status==="INTERMITTENT"?"INTERMITTENT":status==="UNOBSERVED"?"NO OBSERVATION":"AWAITING OBSERVATION"}</small><small className="contact-decision-tag">{decision?.title ?? "NO DECISION YET"}</small></td><td><span className={`observation-pill ${status?.toLowerCase()??"pending"}`}>{status??"PENDING"}</span></td><td>{contact.confidence !== undefined ? `${contact.confidence}%` : "—"}</td><td>{contact.altitude !== undefined ? `${contact.altitude} m (observed)` : "—"}</td><td><button className="mini-select" onClick={(event)=>{event.stopPropagation();setSelectedId(contact.id)}}>{selectedId===contact.id?<Check size={13}/>:<Eye size={13}/>}</button></td></tr>})}</tbody></table></div><div className="contact-footer"><span>SELECTION: {selectedId??"NONE"}</span><span>OBSERVATIONS ARE SIMULATED</span></div></section>
            <section className="panel detail-panel"><div className="panel-heading"><div><div className="eyebrow">CONTACT INSPECTOR</div><h2>Observation details</h2></div><Crosshair size={17} className="muted-icon"/></div>{selected?<div className="detail-content"><div className="detail-title"><span className="detail-symbol"><Target size={19}/></span><div><strong>{selected.id}</strong><span>Sensor contact · identity not confirmed</span></div></div><div className="detail-stats"><div><span>ALTITUDE</span><strong>{selected.altitude !== undefined ? `${selected.altitude} m (observed)` : "—"}</strong></div><div><span>OBSERVATION</span><strong>{selectedObservation?.status??"PENDING"}</strong></div><div><span>CONFIDENCE</span><strong>{selectedObservation?`${selectedObservation.confidence}%`:"—"}</strong></div></div><div className="detail-note"><div className="note-icon"><Waves size={14}/></div><p>{selectedObservation?.note??"No observation recorded yet. Start the exercise to populate the synthetic feed."}</p></div><div className="evidence-label">AVAILABLE EVIDENCE</div><div className="evidence-row"><span>Source</span><strong>{selectedObservation?.source ?? "Awaiting synthetic sample"}</strong></div><div className="evidence-row"><span>Reported identity</span><strong>{selectedObservation?.status==="TRACK"?"Unconfirmed by sensor":selectedObservation?.status==="INTERMITTENT"?"Low continuity · identity unknown":"Insufficient observation"}</strong></div><div className="evidence-row"><span>Ground truth</span><strong>Not available in operator view</strong></div>
              <div className="operator-actions">
                <div className="operator-actions-heading"><div><div className="eyebrow">TRAINEE DECISION WORKFLOW</div><strong>Investigate · classify · report</strong></div><span className={canOperate?"decision-ready":"decision-locked"}>{canOperate?"READY":"START FIRST"}</span></div>
                <div className="operator-state-row"><span>Current classification</span><strong>{latestClassificationEvent?.classification ? latestClassificationEvent.classification.replaceAll("_"," ") : "NOT CLASSIFIED"}</strong></div>
                <div className="operator-state-row"><span>Last decision</span><strong>{latestContactAction?.title ?? "NO DECISION YET"}</strong></div>
                <div className="operator-confidence"><span>CONFIDENCE</span>{(["LOW","MEDIUM","HIGH"] as const).map((level) => <button key={level} disabled={!canOperate} className={operatorConfidence===level?"active":""} onPointerUp={(event) => handleTraineeAction("SET_CONFIDENCE",level,event.pointerType==="touch"?"touch":"mouse",undefined,selected.id)}>{level}</button>)}</div>
                <div className="operator-label">CLASSIFICATION</div>
                <div className="operator-classify-grid">
                  {([{value:"POSSIBLE_DRONE",label:"Possible drone"},{value:"NON_DRONE",label:"Non-drone"},{value:"UNKNOWN",label:"Unknown / defer"}] as const).map((item) => <button key={item.value} disabled={!canOperate} onPointerUp={(event) => handleTraineeAction("CLASSIFY",operatorConfidence,event.pointerType==="touch"?"touch":"mouse",item.value,selected.id)}>{item.label}</button>)}
                </div>
                <div className="operator-label">ACTION</div>
                <div className="operator-action-grid">
                  {([{action:"OBSERVE",label:"Acknowledge"},{action:"REQUEST_MORE_INFO",label:"Request more info"},{action:"REPORT",label:"Report"},{action:"ESCALATE",label:"Escalate"},{action:"AUTHORIZE_RESPONSE",label:"Authorize abstract response"},{action:"DEFER",label:"Defer decision"}] as const).map((item) => <button key={item.action} disabled={!canOperate} className={item.action==="AUTHORIZE_RESPONSE"?"operator-action-warn":item.action==="DEFER"?"operator-action-defer":""} onPointerUp={(event) => handleTraineeAction(item.action,operatorConfidence,event.pointerType==="touch"?"touch":"mouse",undefined,selected.id)}>{item.label}</button>)}
                </div>
                {!canOperate && <p className="operator-locked-note">Start the exercise to begin receiving synthetic observations and enable trainee decisions.</p>}
                {canOperate && <p className="operator-locked-note">Training-only controls. Decisions are recorded locally; no real sensor, aircraft or countermeasure is connected.</p>}
              </div>
            </div>:<div className="empty-state">Select a contact to inspect its observations.</div>}</section>
          </div>
          <div className="event-banner"><div className="banner-icon"><Activity size={15}/></div><span>{notice}</span><span className="banner-time">{timeLabel(elapsed)} SIM TIME</span></div>
        </section>
        <aside className="right-column">
          <section className="panel run-panel"><div className="panel-heading"><div><div className="eyebrow">SESSION CONTROL</div><h2>Exercise runner</h2></div><span className="count-pill">LOCAL</span></div><div className="session-clock"><span>ELAPSED SIM TIME</span><strong>{timeLabel(elapsed)}</strong><div><span className={running?"running-dot":"paused-dot"}/>{running?"SIMULATION RUNNING":"SIMULATION PAUSED"}</div></div><div className="runner-actions"><button className={running?"pause-button":"run-button"} onClick={() => toggleExercise("mouse")}>{running?<><Pause size={15}/> Pause</>:<><Play size={15}/>{tick>0?"Resume exercise":"Start exercise"}</>}</button><button className="icon-button" title="Advance one simulation tick" onClick={()=>{if(!running){simulationStep();setContacts(engineRef.current?.getContacts()??[]);setTick(tickRef.current);setElapsed(elapsedRef.current)}}}><Clock3 size={15}/></button><button className="icon-button" title="Reset scenario" onClick={()=>resetScenario(config)}><RotateCcw size={15}/></button></div><div className="runner-secondary"><button onClick={saveSession}><Save size={14}/> Save session</button><button onClick={exportAar}><ArrowDownToLine size={14}/> Export AAR</button></div></section>
          <section className="panel equipment-panel"><div className="panel-heading"><div><div className="eyebrow">VIRTUAL EQUIPMENT</div><h2>Simulated sensor</h2></div><span className="equipment-chip"><span className="live-dot"/> READY</span></div><div className="device-illustration"><div className="device-screen"><span>SIM / SENSOR-01</span><div className="device-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><strong>{sensorHealth}%</strong><small>SYNTHETIC STATUS</small></div><div className="device-body"><span/><span/><span/><i/><i/><i/></div></div><div className="device-state"><span>DEVICE STATE</span><strong>SIMULATED · NO HARDWARE</strong></div><div className="device-state"><span>OBSERVATION QUALITY</span><strong>{config.sensorQuality}% configured</strong></div><p className="device-disclaimer">Illustrative training control only. No actual sensing or countermeasure function.</p></section>
          <section className="panel environment-panel"><div className="panel-heading"><div><div className="eyebrow">ENVIRONMENT STATE</div><h2>Current conditions</h2></div><Sun size={16} className="muted-icon"/></div><div className="env-state-grid"><div><span>SETTING</span><strong>{config.environment.toUpperCase()}</strong></div><div><span>LIGHTING</span><strong>{config.lighting.toUpperCase()}</strong></div><div><span>VISIBILITY</span><strong>{config.visibility.toUpperCase()}</strong></div><div><span>DIFFICULTY</span><strong>LEVEL {config.difficulty}</strong></div></div><div className="environment-note"><Wind size={14}/><span>{config.visibility==="fog"?"Fog enabled: synthetic observation dropout increases.":config.visibility==="haze"?"Haze enabled: observation confidence is reduced.":"Clear conditions: baseline synthetic visibility."}</span></div></section>
          <AfterActionReview events={events} sessions={sessions} onLoadSession={loadSession}/>
          <div className="developer-diagnostics">
            <button className="diagnostics-toggle" aria-expanded={showPerformance} onClick={() => setShowPerformance((visible) => !visible)}><Gauge size={13}/> Performance diagnostics <span>{showPerformance ? "Hide" : "Show"}</span></button>
            {showPerformance && <div className="diagnostics-readout"><div><span>Rendered FPS</span><strong>{running ? perf.fps || "Measuring…" : "Paused"}</strong></div><div><span>Simulation updates / sec</span><strong>{running ? perf.simHz || "Measuring…" : "Paused"}</strong></div><div><span>Average frame delta</span><strong>{running ? `${perf.frameMs} ms` : "Paused"}</strong></div><p>Measured locally while the exercise is running. Target simulation step: 30 Hz. Actual rendering rate depends on this device.</p></div>}
          </div>
          <div className="prototype-note"><Shield size={13}/><span><strong>Prototype boundary</strong> Synthetic entities and observations only. No live sensor data, operational engagement logic or countermeasure control.</span></div>
        </aside>
      </main>
      <footer className="app-footer"><span>SPECTRA <i>SIMULATION LAYER v0.1</i></span><span><span className="online-pip"/> LOCAL · OFFLINE-CAPABLE AFTER LOAD</span><span>TRAINING PROTOTYPE · NOT FOR OPERATIONAL USE</span></footer>
    </div>
  );
}
