# GaiaScope

A cinematic prototype for a real-time multi-physics Earth risk engine.

The current build is a standalone web app that renders a procedural Three.js globe with animated hazard layers for:

- hurricane wind, pressure, surge, and infrastructure exposure
- wildfire ignition, heat, smoke transport, and spread logic
- earthquake epicenter, seismic wavefronts, attenuation, and exposure
- city heatwave intensity, air quality stress, and vulnerability

## Run

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173
```

## Notes

This first prototype uses simulated fields and generated geometry. The next useful step is to replace each scenario's static seed data with live adapters for NOAA, NASA FIRMS, USGS, OpenAQ, NOAA Tides & Currents, Sentinel Hub, and OpenStreetMap.
