# SPECTRA | Project Brief

> **Proposed repository description:** Local-first synthetic counter-UAS awareness trainer for practicing uncertainty-aware observation, decision-making, and after-action review in a 2D/3D browser simulation.

## Overview
SPECTRA is a local-first browser prototype for exploring how an operator interprets uncertain synthetic observations. It combines a 2D awareness display with a lightweight 3D environment and records trainee decisions for later review.

## Problem and opportunity
Training interfaces can accidentally reveal information that the trainee would not know at the time of a decision. A simulator can make this easier to examine by separating synthetic underlying truth from trainee-visible observations and recording the evidence available for each action.

## Proposed approach
- Run seeded, repeatable synthetic scenarios locally in the browser.
- Separate internal simulation truth from the trainee-visible observation interface.
- Allow trainees to request more information, classify, report, escalate, defer, and record confidence.
- Preserve session history and support JSON export for review.
- Offer desktop, touch, phone-motion, and basic Cardboard-style viewing modes where supported.

## Current scope and maturity
The README describes a working engineering prototype with scenario controls, 2D/3D views, local session history, and CI verification commands. It also explicitly states that sensor behaviour is synthetic, the project is not connected to live sensors or countermeasure hardware, and the trainer is not validated for operational use.

## Roadmap proposal
1. Maintain deterministic seeded scenarios and regression tests.
2. Expand event-linked after-action review so each decision can be traced to the observations visible at that moment.
3. Validate scoring and decision rules with qualified domain reviewers before making effectiveness claims.
4. Test phone-motion and Cardboard behaviour on a documented matrix of devices and browsers.
5. Improve replay, accessibility, scenario documentation, and low-performance-device behaviour.
6. Keep architecture checks that prevent trainee-facing code from reading internal truth labels.

## Safety and evaluation boundaries
SPECTRA is a training and software-engineering prototype, not an operational counter-UAS tool. Synthetic contacts, scoring, or scenario outcomes do not demonstrate real sensor accuracy or real-world operator effectiveness. The client-side separation of truth and observations is an architectural guardrail, not a security boundary against someone inspecting downloaded code.

## Collaboration proposal
Contributions are welcome in deterministic tests, usability, accessibility, performance, replay, documentation, and architecture checks. Changes to training rules or scoring should include their reasoning and tests. Claims about operational value require expert review and a separate evaluation design.

## Licensing and reuse
The repository's root license, if present, governs reuse. This brief does not grant additional rights. Review dependencies and third-party asset licences before redistribution.
