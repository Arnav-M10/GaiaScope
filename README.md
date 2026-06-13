# GaiaScope

A cinematic prototype for a real-time multi-physics Earth risk engine.

The current build is a standalone web app that renders a procedural Three.js globe with animated hazard layers for:

- hurricane wind, pressure, surge, and infrastructure exposure
- wildfire ignition, heat, smoke transport, and spread logic
- earthquake epicenter, seismic wavefronts, attenuation, and exposure
- city heatwave intensity, air quality stress, and vulnerability
- live USGS earthquake markers, NWS alert signals, and NOAA water-level telemetry
- a command-center UI with cinematic, physics, and response view modes
- a live-data assimilation blend control that changes risk scores
- an animated 2D PDE-style scalar field preview for advection and diffusion
- risk decomposition, solver diagnostics, and impact timelines
- a procedural Earth render with generated land, clouds, city lights, atmosphere, live markers, and hazard cones

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

Then open:

```text
http://127.0.0.1:5173
```

## Notes

This prototype combines simulated physics fields with a first live-data pass:

- USGS all-day earthquake GeoJSON feed
- NWS active alerts for Florida, California, and Texas
- NOAA CO-OPS latest water level for Key West station 8724580
- local `/api/wildfire` proxy for Open-Meteo wind/humidity, NWS context, and NASA FIRMS when `FIRMS_MAP_KEY` is available
- operational wildfire spread model using ignition points, wind speed/direction, fuel dryness, and terrain-slope approximation
- smoke advection-diffusion model projected into the field canvas and onto the globe
- wildfire confidence audit labeling inputs as live, estimated, simulated, or missing

Still planned:

- OpenAQ pollution, via backend handling for API/auth/CORS stability
- OpenStreetMap/Overpass infrastructure, with throttling and caching
- Sentinel Hub imagery, with OAuth/client credentials
