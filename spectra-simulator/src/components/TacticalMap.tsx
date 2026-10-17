import type { ContactView } from "../simulation";

interface Props {
  contacts: ContactView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lighting: string;
}

function observationColor(status?: ContactView["status"]) {
  if (status === "TRACK") return "#52c6a1";
  if (status === "INTERMITTENT") return "#f5bf58";
  if (status === "UNOBSERVED") return "#ff647c";
  return "#7b8c98";
}

export default function TacticalMap({ contacts, selectedId, onSelect, lighting }: Props) {
  const visibleContacts = contacts.filter((contact) => typeof contact.x === "number" && typeof contact.y === "number");
  const pendingCount = contacts.length - visibleContacts.length;

  return (
    <div className={`map-shell map-${lighting}`}>
      <div className="map-grid" />
      <svg className="map-svg" viewBox="0 0 1000 700" role="img" aria-label="Synthetic observation-based contact map">
        <defs>
          <pattern id="blocks" width="160" height="140" patternUnits="userSpaceOnUse">
            <rect x="10" y="12" width="48" height="28" rx="2" fill="currentColor" opacity=".12" />
            <rect x="72" y="18" width="65" height="24" rx="2" fill="currentColor" opacity=".08" />
            <rect x="24" y="60" width="90" height="22" rx="2" fill="currentColor" opacity=".1" />
            <rect x="118" y="70" width="28" height="42" rx="2" fill="currentColor" opacity=".1" />
          </pattern>
        </defs>
        <rect width="1000" height="700" fill="url(#blocks)" opacity=".6" />
        <path d="M0 505 C180 470 210 535 370 480 S650 430 1000 500" fill="none" stroke="currentColor" strokeWidth="26" opacity=".07" />
        <path d="M0 505 C180 470 210 535 370 480 S650 430 1000 500" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="8 8" opacity=".35" />
        <path d="M150 0 L220 700 M760 0 L640 700" stroke="currentColor" strokeWidth="1" strokeDasharray="3 8" opacity=".16" />
        {visibleContacts.map((contact) => {
          const status = contact.status;
          const x = (contact.x ?? 0) * 1000;
          const y = (contact.y ?? 0) * 700;
          const color = observationColor(status);
          const selected = selectedId === contact.id;
          return (
            <g key={contact.id} onClick={() => onSelect(contact.id)} role="button" tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && onSelect(contact.id)} style={{ cursor: "pointer" }}>
              {status === "TRACK" && <circle cx={x} cy={y} r={25 + (100 - (contact.confidence ?? 0)) * 0.16} fill={color} opacity=".06" />}
              <circle cx={x} cy={y} r={selected ? 18 : 13} fill={color} opacity={selected ? ".2" : ".1"} />
              <path d={`M ${x} ${y - 10} L ${x + 10} ${y} L ${x} ${y + 10} L ${x - 10} ${y} Z`} fill={color} stroke={color} strokeWidth="1.4" />
              {selected && <circle cx={x} cy={y} r="25" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 5" />}
              <text x={x + 19} y={y - 12} fill={color} fontSize="14" fontFamily="monospace">{contact.id}</text>
              <text x={x + 19} y={y + 5} fill="currentColor" opacity=".7" fontSize="10" fontFamily="monospace">{status === "UNOBSERVED" ? "LAST KNOWN" : status ?? "PENDING"}</text>
            </g>
          );
        })}
      </svg>
      <div className="map-compass"><span>N</span><span className="compass-arrow">↑</span></div>
      <div className="map-scale">SIMULATED COORDINATE GRID <span>GRID 1000 × 700</span></div>
      <div className="map-disclaimer">SYNTHETIC OBSERVATIONS · MEASURED OR LAST KNOWN POSITIONS{pendingCount > 0 ? ` · ${pendingCount} NOT YET LOCATED` : ""}</div>
    </div>
  );
}
