# SPECTRA Combined Simulator

An offline-first training simulator concept combining a 2D tactical awareness display with a synchronized 3D digital twin.

## Current slice

- Multiple synthetic scenario templates: perimeter, rural site, urban site, multi-contact.
- Environment controls for setting, lighting, visibility, scenario seed and event density.
- Deterministic seeded scenario variation.
- A simulated observation feed with uncertainty and occasional missing observations.
- Synchronized tactical map and Three.js 3D scene using the same scenario state.
- Pause, resume, step and reset controls.
- Event timeline, session persistence in browser localStorage, and replay selection.
- This version is a simulation prototype only. It does not connect to real sensors or countermeasure hardware.
- The decision-tree scoring engine is intentionally deferred to a later phase.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

The UI and simulation run locally after dependencies are installed. No backend or network service is required at runtime.

## Project layout

- `src/simulation.ts`: deterministic synthetic scenario generation and simulation state.
- `src/App.tsx`: dashboard and operator workflow.
- `src/components/TacticalMap.tsx`: 2D situational-awareness view.
- `src/components/DigitalTwin.tsx`: 3D visualization of the same entities.
- `src/components/AfterActionReview.tsx`: event history and session replay selection.
- `src/styles.css`: visual system.
