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

Still planned:

- NASA FIRMS active fire detections, via a backend-proxied FIRMS MAP_KEY
- OpenAQ pollution, via backend handling for API/auth/CORS stability
- OpenStreetMap/Overpass infrastructure, with throttling and caching
- Sentinel Hub imagery, with OAuth/client credentials
