# Validation plan

- Same scenario ID and seed produce the same ground-truth entity list.
- Configuring a new seed generates a reproducible alternate entity list.
- Environment and lighting controls update the digital twin and tactical map presentation.
- Sensor quality, visibility and difficulty influence synthetic observation confidence and observation gaps.
- Pause stops the simulation clock; step advances one tick; reset reinitializes from the selected seed.
- Saved sessions persist locally and can be loaded without a server.
- Exported AAR is a JSON document containing the config, current entities, observations and event records.
- The interface runs without backend/network calls after assets have been installed and built.

Note: the current prototype's sensor model is deliberately abstract and is not a validated physical sensor model. Decision-tree scoring is not implemented yet.
