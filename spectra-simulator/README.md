# SPECTRA Combined Simulator

An offline-capable prototype combining a 2D tactical awareness display with a synchronized 3D digital twin for synthetic counter-UAS operator training.

## Included in this build

- Four scenario templates: perimeter watch, urban observation, rural site and multi-contact exercise.
- Environment controls for urban/rural/perimeter, day/dusk/night, clear/haze/fog, synthetic sensor quality, difficulty and contact count.
- Seeded contact generation for reproducible scenario setup.
- An abstract simulated observation feed with tracks, intermittent observations and observation gaps.
- Synchronized 2D tactical map and 3D environment using shared entity state.
- Pause/resume, single-step and reset controls.
- Browser-local session history with entity/observation snapshots and JSON AAR export.
- Generic illustrative virtual sensor panel. No real sensor or countermeasure hardware is connected.
- Decision-tree scoring is intentionally deferred to a later phase.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Validate the project:

```bash
npm run typecheck
npm test
npm run build
```

A GitHub Actions workflow runs these validation commands on changes to this project. The code has not yet been executed in the authoring environment, so inspect the workflow result before treating the build as verified.

The source uses no remote API at runtime. After dependencies are installed, the simulation logic runs locally. All scenario and sensor data are synthetic; sensor behaviour is abstract and is not a validated physical model.

## Project layout

- `src/simulation.ts`: types, seeded scenario generation, synthetic observations and entity motion.
- `src/App.tsx`: controls, operator workstation, session storage and export.
- `src/components/TacticalMap.tsx`: 2D tactical awareness view.
- `src/components/DigitalTwin.tsx`: Three.js 3D environment.
- `src/components/AfterActionReview.tsx`: event timeline and saved-session selection.
- `src/styles.css`: interface styling.

## Current boundaries

This is a frontend prototype. It does not yet implement decision-tree scoring, a backend, multi-user networking, real-world sensor fusion, physical sensor integration or operational countermeasure control. Saved sessions are local to the browser profile, not a shared training database.
