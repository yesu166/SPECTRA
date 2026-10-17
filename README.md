# SPECTRA — Synthetic Counter-UAS Awareness Trainer

[![Simulator CI](https://github.com/yesu166/SPECTRA/actions/workflows/spectra-simulator.yml/badge.svg)](https://github.com/yesu166/SPECTRA/actions/workflows/spectra-simulator.yml)

SPECTRA is a local-first, browser-based training prototype for interpreting **uncertain synthetic observations** and reviewing what an operator could know at a given moment. It combines a 2D awareness display with a lightweight 3D environment.

> **Prototype only:** sensor behaviour is synthetic and abstract. SPECTRA is not connected to live sensors or countermeasure hardware and is not validated for operational use.

## Run SPECTRA

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

### Verify the project

```bash
npm run typecheck
npm test
npm run build
```

No cloud service or API key is required at runtime. After dependencies are installed, the app runs locally.

## Current features

- 2D contact map and 3D environment view driven by sensor-derived or last-known positions.
- Environment presets for urban, rural and perimeter settings.
- Day, dusk and night lighting; clear, haze and fog visibility settings.
- Configurable synthetic sensor quality, difficulty, contact count and seed.
- Repeatable seeded simulation steps with pause, resume, single-step and reset.
- Browser-local session history and JSON export using trainee-visible data.
- Truth/observation separation in the application architecture, guarded by regression tests and an import-boundary check.

## Project structure

The simulator is the **repository root**. Source code and run configuration are visible immediately in this repository—there is no nested project folder to open first.

```text
SPECTRA/
├── .github/workflows/     # CI: typecheck, tests and production build
├── scripts/               # Development and architecture checks
├── src/
│   ├── components/
│   │   ├── AfterActionReview.tsx
│   │   ├── DigitalTwin.tsx
│   │   └── TacticalMap.tsx
│   ├── App.tsx             # Main interface and controls
│   ├── main.tsx            # Browser entry point
│   ├── simulation.ts       # Trainee-safe simulation API
│   ├── simulationCore.ts   # Internal synthetic truth/sensor engine
│   ├── simulation.test.ts
│   └── styles.css
├── tests/                  # Scenario notes and implementation audit
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Current boundaries

This is an engineering prototype, not a validated training product. Its sensor model is illustrative, not calibrated to physical sensors. Decision-tree scoring, evidence-linked score explanations, seekable synchronized replay, expert-reviewed decision rules, a backend and multi-user networking remain future work. The browser-delivered code can be inspected; truth separation is an architectural separation, not a security boundary against a determined user.

## Contribution and validation

Issues and pull requests are welcome. Every change should pass the GitHub Actions workflow before it is treated as verified. Student testing can establish software consistency and usability, but claims about real operator performance require qualified review and appropriate evaluation.
