# GaiaScope

GaiaScope is a cinematic, browser-based prototype for a real-time multi-physics Earth risk engine. It combines a procedural 3D globe, live public data feeds, and simplified disaster physics models for storms, wildfires, earthquakes, floods, heat, smoke, and infrastructure exposure.

The project is designed as a portfolio-grade research prototype: visually dramatic, technically transparent, and honest about which values are live, estimated, simulated, or missing.

## Features

- Cinematic Three.js Earth with generated land, atmosphere, clouds, stars, city lights, live markers, hazard cones, and animated disaster overlays.
- Scenario modes for hurricane, wildfire, earthquake, and heatwave.
- Command-center UI with Cinematic, Physics, and Response views.
- Live-data assimilation blend that changes risk scores.
- USGS earthquake feed, NWS alerts, NOAA CO-OPS water level telemetry.
- Local wildfire proxy for Open-Meteo wind/humidity, NWS context, and NASA FIRMS detections when `FIRMS_MAP_KEY` is available.
- Operational wildfire module with ignition points, wind-driven spread, fuel dryness, terrain-slope approximation, smoke advection-diffusion, active perimeter rendering, and model confidence/audit panels.
- PDE-style field canvas that visualizes smoke/fire transport.
- Risk decomposition, solver diagnostics, and impact timelines.

## Run

Recommended, with the wildfire proxy enabled:

```powershell
node server.mjs
```

Then open:

```text
http://127.0.0.1:5173
```

Optional NASA FIRMS live detections:

```powershell
$env:FIRMS_MAP_KEY="your_firms_map_key"
node server.mjs
```

Static-only fallback, without the wildfire proxy:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

In static-only mode, the wildfire panel will report that the proxy is unavailable and switch to demo fallback mode.

## Wildfire Module

The wildfire scenario is the first physically grounded module. It uses:

- ignition points from NASA FIRMS when a `FIRMS_MAP_KEY` is configured
- synthetic fallback ignition seeds when FIRMS is unavailable
- live Open-Meteo wind speed, wind direction, gusts, humidity, and soil-moisture context
- NWS point forecast/alert context
- estimated fuel dryness derived from humidity and gusts
- estimated terrain slope/aspect until real DEM tiles are connected
- an elliptical wind-driven spread approximation for head-fire growth
- an advection-diffusion smoke model for downwind plume transport and crosswind widening

The confidence panel labels each input as `live`, `fallback`, `estimated`, `simulated`, or `missing`. The model audit shows ignition count, wind, humidity, fuel dryness, slope grade/aspect, spread area, head-fire rate, smoke particle count, and source status.

## Scientific Model Assumptions

GaiaScope is a simplified physics visualization prototype, not an emergency decision system.

The wildfire model is intentionally lightweight so it can run in the browser. It uses heuristic spread equations inspired by operational fire behavior concepts: wind elongates the head-fire direction, fuel dryness increases spread potential, slope alignment boosts uphill growth, and smoke is transported by an advection-diffusion field. It does not yet use calibrated fuel models, real DEM tiles, live suppression activity, spotting, crown fire transition, fire-atmosphere feedback, or validated evacuation/infrastructure models.

Do not use this prototype for real-world emergency response, evacuation decisions, firefighting operations, insurance decisions, or public safety guidance. It is a portfolio and research sandbox for exploring how live data and simplified physics can be made explainable in a 3D Earth interface.

## Data Sources

- USGS all-day earthquake GeoJSON feed
- National Weather Service active alerts and point forecast context
- NOAA CO-OPS water level telemetry
- Open-Meteo weather fields for wildfire wind/humidity
- NASA FIRMS active fire detections when `FIRMS_MAP_KEY` is configured

Still planned:

- OpenAQ pollution with backend auth/CORS handling
- OpenStreetMap/Overpass infrastructure with throttling and caching
- Sentinel Hub imagery with OAuth/client credentials

## File Structure

```text
GaiaScope/
  index.html
  styles.css
  server.mjs
  src/
    app.js
    live-data.js
    wildfire-model.js
```

`index.html` loads `./src/app.js`. `src/app.js` imports `./live-data.js` and `./wildfire-model.js`. `node server.mjs` serves the app and the `/api/wildfire` proxy at `http://127.0.0.1:5173`.
