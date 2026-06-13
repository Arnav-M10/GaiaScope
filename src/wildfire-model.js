const GRID_SIZE = 42;
const KM_PER_DEG_LAT = 111;

export function buildWildfireModel(proxyPayload, scenario) {
  const weather = normalizeWeather(proxyPayload?.weather);
  const fires = normalizeFires(proxyPayload?.firms, scenario.location);
  const slope = estimateTerrainSlope(scenario.location);
  const fuelDryness = estimateFuelDryness(weather);
  const wind = {
    speedMph: weather.windSpeedMph,
    directionDeg: weather.windDirectionDeg,
    gustMph: weather.windGustMph,
    humidityPct: weather.humidityPct,
  };

  const spread = simulateSpread({
    center: scenario.location,
    ignitions: fires,
    wind,
    fuelDryness,
    slope,
  });
  const smoke = simulateSmoke({
    center: scenario.location,
    ignitions: fires,
    wind,
    fuelDryness,
  });
  const confidence = buildConfidence(proxyPayload, fires, weather);
  const risk = calculateWildfireRisk({ spread, smoke, wind, fuelDryness, slope, confidence });
  const sourceMode = determineSourceMode(proxyPayload, confidence);

  return {
    updatedAt: proxyPayload?.updatedAt ?? new Date().toISOString(),
    sourceMode,
    center: { lat: scenario.location[0], lon: scenario.location[1] },
    ignitions: fires,
    wind,
    fuelDryness,
    slope,
    spread,
    smoke,
    confidence,
    risk,
    telemetry: [
      `${Math.round(wind.speedMph)} mph ${bearingLabel(wind.directionDeg)}`,
      `${Math.round(weather.humidityPct)}% RH`,
      `${Math.round(fuelDryness * 100)}% dry`,
      `${Math.round(confidence.score * 100)}% conf`,
    ],
    factors: {
      forcing: clamp(0.32 + wind.speedMph / 55 + fuelDryness * 0.25, 0, 1),
      exposure: clamp(0.42 + spread.areaKm2 / 220, 0, 1),
      vulnerability: clamp(0.55 + slope.alignment * 0.25, 0, 1),
      confidence: confidence.score,
    },
    diagnostics: {
      residual: clamp(0.36 - confidence.score * 0.18 + wind.gustMph / 240, 0.09, 0.42),
      cfl: clamp(wind.speedMph / 80 + 0.12, 0.18, 0.92),
      diffusion: clamp(0.012 + (1 - weather.humidityPct / 100) * 0.04, 0.012, 0.07),
      vorticity: clamp(Math.abs(Math.sin((wind.directionDeg * Math.PI) / 180)) * 0.55 + slope.alignment * 0.25, 0.08, 0.84),
    },
    audit: {
      ignitionPoints: fires.length,
      windSpeedMph: wind.speedMph,
      windDirectionDeg: wind.directionDeg,
      humidityPct: wind.humidityPct,
      fuelDryness,
      slopeGrade: slope.grade,
      slopeAspectDeg: slope.aspectDeg,
      spreadAreaKm2: spread.areaKm2,
      headFireRateKmh: spread.headFireRateKmh,
      smokeParticleCount: smoke.particles.length,
      sourceSummary: summarizeSources(proxyPayload),
    },
  };
}

export function defaultWildfireModel(scenario) {
  return buildWildfireModel(
    {
      updatedAt: new Date().toISOString(),
      weather: {
        status: "estimated",
        current: {
          relative_humidity_2m: 18,
          wind_speed_10m: 28,
          wind_direction_10m: 58,
          wind_gusts_10m: 36,
        },
      },
      firms: {
        status: "estimated",
        fires: [
          { lat: 39.19, lon: -121.08, brightness: 340, frp: 18, confidence: "estimated" },
          { lat: 39.36, lon: -120.88, brightness: 326, frp: 9, confidence: "estimated" },
          { lat: 38.98, lon: -121.32, brightness: 318, frp: 5, confidence: "estimated" },
        ],
      },
      nws: { status: "estimated" },
    },
    scenario,
  );
}

function normalizeWeather(weather) {
  const current = weather?.current ?? {};
  return {
    sourceStatus: weather?.status ?? "estimated",
    humidityPct: validNumber(current.relative_humidity_2m, 18),
    windSpeedMph: validNumber(current.wind_speed_10m, 28),
    windDirectionDeg: validNumber(current.wind_direction_10m, 58),
    windGustMph: validNumber(current.wind_gusts_10m, validNumber(current.wind_speed_10m, 28) * 1.35),
  };
}

function normalizeFires(firms, [lat, lon]) {
  const fires = firms?.fires?.length
    ? firms.fires
    : [
        { lat, lon, brightness: 332, frp: 12, confidence: "estimated" },
        { lat: lat + 0.16, lon: lon + 0.2, brightness: 324, frp: 7, confidence: "estimated" },
      ];
  return fires.slice(0, 12).map((fire, index) => ({
    id: `ignition-${index}`,
    lat: validNumber(fire.lat, lat),
    lon: validNumber(fire.lon, lon),
    brightness: validNumber(fire.brightness, 325),
    frp: validNumber(fire.frp, 8),
    confidence: fire.confidence ?? "unknown",
    intensity: clamp((validNumber(fire.frp, 8) / 35 + (validNumber(fire.brightness, 325) - 295) / 90) / 2, 0.18, 1),
    live: firms?.status === "live",
  }));
}

function simulateSpread({ center, ignitions, wind, fuelDryness, slope }) {
  const cells = [];
  const perimeter = [];
  const windTheta = ((90 - wind.directionDeg) * Math.PI) / 180;
  const windVector = { x: Math.cos(windTheta), y: Math.sin(windTheta) };
  const baseRate = 0.18 + fuelDryness * 0.72 + wind.speedMph / 58;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const nx = (x / (GRID_SIZE - 1) - 0.5) * 2;
      const ny = (y / (GRID_SIZE - 1) - 0.5) * 2;
      let intensity = 0;
      ignitions.forEach((ignition) => {
        const local = latLonToLocalKm(ignition.lat, ignition.lon, center);
        const ix = local.x / 34;
        const iy = local.y / 34;
        const dx = nx - ix;
        const dy = ny - iy;
        const downwind = Math.max(0, dx * windVector.x + dy * windVector.y);
        const crosswind = Math.abs(dx * -windVector.y + dy * windVector.x);
        const slopeBoost = 1 + slope.alignment * Math.max(0, downwind) * 0.4;
        const ellipse = downwind * downwind * 0.65 + crosswind * crosswind * 2.1 + Math.max(0, -downwind) * 1.45;
        intensity += ignition.intensity * Math.exp(-ellipse * (4.8 / (baseRate * slopeBoost)));
      });
      intensity = clamp(intensity, 0, 1);
      if (intensity > 0.12) {
        const lat = center[0] + (ny * 34) / KM_PER_DEG_LAT;
        const lon = center[1] + (nx * 34) / (KM_PER_DEG_LAT * Math.cos((center[0] * Math.PI) / 180));
        cells.push({ lat, lon, intensity });
        if (intensity > 0.34 && intensity < 0.48) {
          perimeter.push({ lat, lon, intensity });
        }
      }
    }
  }

  const areaKm2 = cells.reduce((sum, cell) => sum + cell.intensity * 1.2, 0);
  return {
    cells,
    perimeter: perimeter.length ? perimeter : cells.filter((_, index) => index % 7 === 0),
    areaKm2,
    headFireRateKmh: baseRate * (0.9 + wind.speedMph / 40) * (1 + slope.alignment * 0.35),
  };
}

function simulateSmoke({ center, ignitions, wind, fuelDryness }) {
  const particles = [];
  const theta = ((90 - wind.directionDeg) * Math.PI) / 180;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const diffusion = 0.18 + (1 - wind.humidityPct / 100) * 0.26;

  ignitions.slice(0, 5).forEach((ignition) => {
    for (let i = 0; i < 18; i += 1) {
      const step = i / 17;
      const spread = (Math.sin(i * 2.17) * diffusion + (Math.random() - 0.5) * diffusion) * step;
      const local = latLonToLocalKm(ignition.lat, ignition.lon, center);
      const x = local.x + dx * step * (18 + wind.speedMph * 0.55) + -dy * spread * 10;
      const y = local.y + dy * step * (18 + wind.speedMph * 0.55) + dx * spread * 10;
      particles.push({
        lat: center[0] + y / KM_PER_DEG_LAT,
        lon: center[1] + x / (KM_PER_DEG_LAT * Math.cos((center[0] * Math.PI) / 180)),
        concentration: clamp((1 - step) * ignition.intensity * (0.7 + fuelDryness * 0.4), 0.05, 1),
      });
    }
  });

  return {
    particles,
    diffusion,
    directionDeg: wind.directionDeg,
  };
}

function buildConfidence(payload, fires, weather) {
  const rows = [
    {
      label: "Ignition points",
      status: payload?.firms?.status === "live" ? "live" : payload?.firms?.status === "missing_key" ? "fallback" : "estimated",
      detail:
        payload?.firms?.status === "live"
          ? `${fires.length} NASA FIRMS detections`
          : "FIRMS_MAP_KEY missing; using synthetic ignition seeds, so confidence is reduced",
    },
    {
      label: "Wind/humidity",
      status: payload?.weather?.status === "live" ? "live" : "estimated",
      detail: `${Math.round(weather.windSpeedMph)} mph wind, ${Math.round(weather.humidityPct)}% RH`,
    },
    {
      label: "Terrain slope",
      status: "estimated",
      detail: "Estimated from an analytic Sierra foothill aspect/grade approximation until DEM tiles are connected",
    },
    {
      label: "Fuel dryness",
      status: payload?.weather?.status === "live" ? "estimated" : "simulated",
      detail: "Derived from humidity, gusts, and shallow soil moisture proxy",
    },
    {
      label: "NWS fire context",
      status: payload?.nws?.status === "live" ? "live" : payload?.nws?.status === "error" ? "missing" : "estimated",
      detail: payload?.nws?.status === "live" ? "NWS point/alert context loaded" : "NWS context unavailable; model stays in fallback mode",
    },
  ];
  const score =
    rows.reduce((sum, row) => {
      if (row.status === "live") return sum + 1;
      if (row.status === "estimated") return sum + 0.55;
      if (row.status === "fallback") return sum + 0.32;
      if (row.status === "simulated") return sum + 0.35;
      return sum + 0.15;
    }, 0) / rows.length;

  return { rows, score: clamp(score, 0, 1) };
}

function determineSourceMode(payload, confidence) {
  const statuses = [payload?.weather?.status, payload?.nws?.status, payload?.firms?.status];
  if (statuses.every((status) => status === "error" || status === undefined)) {
    return {
      label: "Demo fallback mode",
      detail: "All wildfire live inputs failed; using demo weather, synthetic ignitions, and estimated terrain.",
    };
  }
  if (payload?.firms?.status === "missing_key") {
    return {
      label: "Live weather + synthetic FIRMS",
      detail: "Weather/NWS may be live, but active fire detections are synthetic until FIRMS_MAP_KEY is set.",
    };
  }
  if (confidence.score < 0.45) {
    return {
      label: "Low-confidence fallback",
      detail: "Most inputs are estimated or missing; use the model only as a visual physics sandbox.",
    };
  }
  return {
    label: "Operational prototype",
    detail: "Live and estimated inputs are blended into the spread and smoke solver.",
  };
}

function summarizeSources(payload) {
  const weather = payload?.weather?.status === "live" ? "weather live" : "weather fallback";
  const nws = payload?.nws?.status === "live" ? "NWS live" : "NWS fallback";
  const firms =
    payload?.firms?.status === "live"
      ? "FIRMS live"
      : payload?.firms?.status === "missing_key"
        ? "FIRMS synthetic"
        : "FIRMS fallback";
  return `${weather}; ${nws}; ${firms}`;
}

function calculateWildfireRisk({ spread, smoke, wind, fuelDryness, slope, confidence }) {
  const score = clamp(
    0.22 + fuelDryness * 0.28 + wind.speedMph / 85 + spread.areaKm2 / 360 + smoke.diffusion * 0.16 + slope.alignment * 0.08,
    0,
    1,
  );
  return {
    score,
    label: score > 0.78 ? "Extreme spread potential" : score > 0.58 ? "High spread potential" : "Moderate spread potential",
    confidence: confidence.score,
  };
}

function estimateFuelDryness(weather) {
  const humidityDryness = 1 - weather.humidityPct / 100;
  const windDrying = clamp(weather.windGustMph / 55, 0, 1) * 0.18;
  return clamp(humidityDryness * 0.82 + windDrying, 0.1, 0.98);
}

function estimateTerrainSlope([lat, lon]) {
  const aspectDeg = 46 + Math.sin(lat * 0.3 + lon * 0.1) * 18;
  return {
    grade: clamp(0.11 + Math.abs(Math.sin(lat + lon)) * 0.18, 0.04, 0.34),
    aspectDeg,
    alignment: clamp(0.48 + Math.cos(((aspectDeg - 58) * Math.PI) / 180) * 0.28, 0.2, 0.9),
  };
}

function latLonToLocalKm(lat, lon, [centerLat, centerLon]) {
  return {
    x: (lon - centerLon) * KM_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180),
    y: (lat - centerLat) * KM_PER_DEG_LAT,
  };
}

function bearingLabel(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function validNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
