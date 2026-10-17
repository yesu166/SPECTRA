import type { Entity, Observation } from "../simulation";

interface Props {
  entities: Entity[];
  observations: Record<string, Observation>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  lighting: string;
}

export default function TacticalMap({ entities, observations, selectedId, onSelect, lighting }: Props) {
  return (
    <div className={`map-shell map-${lighting}`}>
      <div className="map-grid" />
      <svg className="map-svg" viewBox="0 0 1000 700" role="img" aria-label="Synthetic tactical situation map">
        <defs>
          <pattern id="blocks" width="160" height="140" patternUnits="userSpaceOnUse">
            <rect x="10" y="12" width="48" height="28" rx="2" fill="currentColor" opacity=".12" />
            <rect x="72" y="18" width="65" height="24" rx="2" fill="currentColor" opacity=".08" />
            <rect x="24" y="60" width="90" height="22" rx="2" fill="currentColor" opacity=".1" />
            <rect x="118" y="70" width="28" height="42" rx="2" fill="currentColor" opacity=".1" />
          </pattern>
        </defs>
        {entities.length > 0 && <rect width="1000" height="700" fill="url(#blocks)" opacity=".6" />}
        <path d="M0 505 C180 470 210 535 370 480 S650 430 1000 500" fill="none" stroke="currentColor" strokeWidth="26" opacity=".07" />
        <path d="M0 505 C180 470 210 535 370 480 S650 430 1000 500" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="8 8" opacity=".35" />
        <path d="M150 0 L220 700 M760 0 L640 700" stroke="currentColor" strokeWidth="1" strokeDasharray="3 8" opacity=".16" />
        {entities.map((entity) => {
          const obs = observations[entity.id];
          const x = entity.x * 1000;
          const y = entity.y * 700;
          const color = entity.kind === "authorized" ? "#52c6a1" : entity.kind === "unknown" ? "#f5bf58" : "#ff647c";
          const selected = selectedId === entity.id;
          return (
            <g key={entity.id} onClick={() => onSelect(entity.id)} role="button" tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && onSelect(entity.id)} style={{ cursor: "pointer" }}>
              {obs?.status === "TRACK" && <circle cx={x} cy={y} r={25 + (100 - obs.confidence) * 0.16} fill={color} opacity=".06" />}
              <circle cx={x} cy={y} r={selected ? 18 : 13} fill={color} opacity={selected ? ".2" : ".1"} />
              <path d={`M ${x} ${y - 10} L ${x + 10} ${y} L ${x} ${y + 10} L ${x - 10} ${y} Z`} fill={color} stroke={color} strokeWidth="1.4" />
              {selected && <circle cx={x} cy={y} r="25" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 5" />}
              <text x={x + 19} y={y - 12} fill={color} fontSize="14" fontFamily="monospace">{entity.id}</text>
              <text x={x + 19} y={y + 5} fill="currentColor" opacity=".7" fontSize="10" fontFamily="monospace">{obs?.status === "UNOBSERVED" ? "NO OBS" : obs?.status ?? "PENDING"}</text>
            </g>
          );
        })}
      </svg>
      <div className="map-compass"><span>N</span><span className="compass-arrow">↑</span></div>
      <div className="map-scale">SIMULATED COORDINATE GRID <span>GRID 1000 × 700</span></div>
      <div className="map-disclaimer">SYNTHETIC TRAINING DATA · NOT A LIVE SENSOR FEED</div>
    </div>
  );
}
