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
- Optional full-screen phone-motion view using device orientation sensors.
- Optional Cardboard-style side-by-side left/right-eye stereo mode for inexpensive phone viewers, with a gaze-and-hold 3D HUD.
- Touch and gaze controls for observe, request more information, classify, report, escalate, authorise an abstract response, defer and set confidence.
- Trainee actions record their input method (mouse, touch or gaze) in the session event log.
- A desktop decision workflow for acknowledging contacts, requesting additional synthetic observations, classifying with confidence, reporting, escalating, deferring and authorising an abstract response.
- An on-demand secondary synthetic camera sample that may improve a contact estimate or return unavailable under degraded conditions; event history links the request to the resulting observation event.
- Mission briefing and per-contact latest-decision status; the initial waiting state explains how to start the exercise.
- Start, pause and resume controls are available within phone and Cardboard views, so the exercise can be controlled without leaving immersive mode.

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

## Phone VR / inexpensive Cardboard viewer

Open SPECTRA on the phone, then use the controls above the 3D view:

- **3D** — return to the normal desktop-style viewport.
- **Phone VR** — enter full-screen motion-controlled viewing with touch overlays.
- **Cardboard** — enter split-screen left/right-eye stereo. Rotate the phone to **landscape** for the two side-by-side eye views, then put it into the viewer. Look at a 3D HUD button and hold your gaze for about 1.1 seconds to activate it. The **EXIT VIEW** button returns to normal mode.

Phone orientation sensors generally require a secure context (HTTPS, except localhost). On iPhone, tap the mode button and grant motion permission when asked. If motion tracking does not start, check browser permission and confirm the site is HTTPS. The Cardboard mode is a basic phone-based stereo prototype, not full WebXR headset support; the exact visual result depends on the phone screen, viewer lens spacing and how the device fits in the viewer.

The 3D HUD and touch buttons issue the same trainee actions and write the selected input method (mouse, touch or gaze) to the event timeline. All contact markers and decisions are based on trainee-visible synthetic observations; truth labels are not shown in the trainee HUD.

## Real-time loop and diagnostics

The exercise uses a fixed-step simulation clock targeting 30 updates per second. The rendering loop is separate and uses `requestAnimationFrame`; catch-up work is capped and timing is rebased when the browser tab becomes hidden. Sensor observations are sampled less frequently than motion updates. These are software targets, not a guarantee of 30 FPS or 30 updates/s on all hardware.

Use **Performance diagnostics** below the session timeline while an exercise is running to view measured render FPS, simulation updates per second, and average frame time for that local device.

Scenario selection remains visible; environment, lighting, visibility, sensor quality, difficulty, contact count and seed are grouped under **Advanced settings**.

## Current boundaries

This is an engineering prototype, not a validated training product. Its sensor model is illustrative, not calibrated to physical sensors. Decision-tree scoring and evidence-linked score explanations remain future work (the log records which observation event came from an additional-information request). Seekable synchronized replay, expert-reviewed decision rules, a backend and multi-user networking also remain future work. The browser-delivered code can be inspected; truth separation is an architectural separation, not a security boundary against a determined user. Phone motion and Cardboard stereo have not yet been validated across a matrix of physical phones, browsers and viewers.


## Contribution and validation

Issues and pull requests are welcome. Every change should pass the GitHub Actions workflow before it is treated as verified. Student testing can establish software consistency and usability, but claims about real operator performance require qualified review and appropriate evaluation.
