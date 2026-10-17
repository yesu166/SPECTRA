import { Activity, Clock3, Database, Radio, ShieldAlert } from "lucide-react";
import type { SessionEvent, SessionSnapshot } from "../simulation";

interface Props {
  events: SessionEvent[];
  sessions: SessionSnapshot[];
  onLoadSession: (session: SessionSnapshot) => void;
}

const iconFor = (type: SessionEvent["type"]) => {
  if (type === "DETECTION") return <Radio size={14} />;
  if (type === "SENSOR") return <Activity size={14} />;
  if (type === "OPERATOR") return <ShieldAlert size={14} />;
  if (type === "ENVIRONMENT") return <Database size={14} />;
  return <Clock3 size={14} />;
};

export default function AfterActionReview({ events, sessions, onLoadSession }: Props) {
  return (
    <section className="panel aar-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">RECORD & REVIEW</div>
          <h2>Session timeline</h2>
        </div>
        <span className="count-pill">{events.length} EVENTS</span>
      </div>
      <div className="timeline-list">
        {events.length === 0 ? (
          <div className="empty-state">Events will appear here when the exercise starts.</div>
        ) : events.slice().reverse().slice(0, 14).map((event) => (
          <div className="timeline-item" key={event.id}>
            <div className={`timeline-icon ${event.type.toLowerCase()}`}>{iconFor(event.type)}</div>
            <div className="timeline-copy">
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </div>
            <time>{Math.floor(event.time / 60).toString().padStart(2, "0")}:{Math.floor(event.time % 60).toString().padStart(2, "0")}</time>
          </div>
        ))}
      </div>
      <div className="saved-sessions">
        <div className="subsection-heading"><span>LOCAL SESSION HISTORY</span><span>{sessions.length} SAVED</span></div>
        {sessions.length === 0 ? <p className="muted small">Completed and paused sessions can be saved locally.</p> :
          sessions.slice(0, 5).map((session) => (
            <button className="saved-session" key={session.id} onClick={() => onLoadSession(session)}>
              <span className="session-mark"><Database size={14}/></span>
              <span className="session-meta"><strong>{session.config.scenarioId.replaceAll("-", " ")}</strong><small>{new Date(session.startedAt).toLocaleString()} · seed {session.config.seed}</small></span>
              <span className="session-events">{session.events.length} ev</span>
            </button>
          ))}
      </div>
    </section>
  );
}
