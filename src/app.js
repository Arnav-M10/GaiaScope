import { fetchLiveData, fetchWildfireInputs, plannedSources } from "./live-data.js";
import { buildWildfireModel, defaultWildfireModel } from "./wildfire-model.js";

const scenarios = {
  hurricane: {
    label: "Hurricane",
    region: "Florida coast",
    brief:
      "Cyclone envelope couples wind stress, pressure deficit, rainfall loading, storm surge, and critical-facility exposure.",
    accent: "#54d8ff",
    location: [27.7, -81.7],
    camera: { lat: 23, lon: -76, zoom: 4.55 },
    score: 82,
    telemetryLabels: ["Wind", "Moisture", "Exposure", "Uncertainty"],
    telemetry: ["64 kt", "82%", "1.8M", "+/-14%"],
    factors: { forcing: 0.86, exposure: 0.78, vulnerability: 0.66, confidence: 0.73 },
    diagnostics: { residual: 0.18, cfl: 0.42, diffusion: 0.018, vorticity: 0.77 },
    field: { source: 0.88, advectionX: 0.9, advectionY: -0.15, diffusion: 0.055, swirl: 0.9 },
    timeline: [
      ["0-2h", 0.48, "bands arrive"],
      ["3-6h", 0.78, "surge peak"],
      ["7-12h", 0.64, "inland flood"],
    ],
    equations: [
      "du/dt = -grad(p)/rho + nu laplacian(u) + f x u",
      "eta_t + div(Hu) = rainfall + surge_boundary",
      "risk = P(flood | ensemble) x exposure x criticality",
    ],
    explanations: [
      "Cyclonic wind vectors tighten around a low-pressure core east of the coast.",
      "Onshore wind stress and shallow bathymetry amplify the coastal surge surface.",
      "Hospitals, substations, and evacuation roads intersect the six-hour flood envelope.",
    ],
  },
  wildfire: {
    label: "Wildfire",
    region: "Northern California",
    brief:
      "Fire spread model blends heat transfer, wind-driven advection, slope acceleration, fuel dryness, and smoke dispersion.",
    accent: "#ff8a3d",
    location: [39.2, -121.1],
    camera: { lat: 37, lon: -118, zoom: 4.35 },
    score: 76,
    telemetryLabels: ["Wind", "Humidity", "Population", "Uncertainty"],
    telemetry: ["28 mph", "18%", "420k", "+/-19%"],
    factors: { forcing: 0.74, exposure: 0.58, vulnerability: 0.71, confidence: 0.64 },
    diagnostics: { residual: 0.24, cfl: 0.57, diffusion: 0.026, vorticity: 0.52 },
    field: { source: 0.95, advectionX: 0.78, advectionY: 0.22, diffusion: 0.04, swirl: 0.35 },
    wildfire: {
      bbox: "-124.8,32.2,-114.0,42.2",
    },
    timeline: [
      ["0-1h", 0.55, "ignition growth"],
      ["2-4h", 0.82, "wind run"],
      ["5-8h", 0.68, "smoke basin"],
    ],
    equations: [
      "R = R0 x wind_factor x slope_factor x fuel_dryness",
      "dT/dt = alpha laplacian(T) + Q_combustion - Q_loss",
      "dC/dt + u dot grad(C) = D laplacian(C) + fire_source",
    ],
    explanations: [
      "Thermal detections cluster over dry fuel with low overnight humidity recovery.",
      "Terrain slope and wind advection tilt the spread cone toward nearby towns.",
      "Smoke concentration rises downwind as particles diffuse through the valley.",
    ],
  },
  earthquake: {
    label: "Earthquake",
    region: "Japan trench",
    brief:
      "Seismic module maps magnitude-energy release, depth, attenuation, shaking intensity, tsunami screening, and asset fragility.",
    accent: "#ffd166",
    location: [38.3, 142.4],
    camera: { lat: 35, lon: 139, zoom: 4.25 },
    score: 88,
    telemetryLabels: ["Magnitude", "PGA", "Population", "Uncertainty"],
    telemetry: ["M7.1", "0.32g", "6.4M", "+/-11%"],
    factors: { forcing: 0.91, exposure: 0.83, vulnerability: 0.77, confidence: 0.81 },
    diagnostics: { residual: 0.15, cfl: 0.39, diffusion: 0.009, vorticity: 0.18 },
    field: { source: 0.9, advectionX: 0.05, advectionY: 0.02, diffusion: 0.025, swirl: 0.05 },
    timeline: [
      ["0-1m", 0.88, "P-wave"],
      ["2-5m", 0.94, "S-wave"],
      ["6-30m", 0.58, "coastal screen"],
    ],
    equations: [
      "E = 10^(1.5M + 4.8)",
      "I(r,z) = I0 exp(-k r) / sqrt(r^2 + z^2)",
      "risk = shaking x fragility x population_density",
    ],
    explanations: [
      "The epicenter releases high seismic energy near dense coastal infrastructure.",
      "Modeled wavefronts attenuate inland but remain strong across urban corridors.",
      "Coastal exposure is high enough to keep tsunami screening active.",
    ],
  },
  heatwave: {
    label: "Heatwave",
    region: "Dallas metro",
    brief:
      "Urban heat solver couples solar loading, impervious cover, tree canopy gaps, boundary-layer stagnation, and air-quality stress.",
    accent: "#ff5f6d",
    location: [32.8, -96.8],
    camera: { lat: 31, lon: -94, zoom: 4.5 },
    score: 69,
    telemetryLabels: ["Heat index", "Canopy gap", "Population", "Uncertainty"],
    telemetry: ["109 F", "41%", "2.2M", "+/-16%"],
    factors: { forcing: 0.68, exposure: 0.82, vulnerability: 0.74, confidence: 0.61 },
    diagnostics: { residual: 0.21, cfl: 0.31, diffusion: 0.033, vorticity: 0.29 },
    field: { source: 0.76, advectionX: 0.18, advectionY: -0.08, diffusion: 0.065, swirl: 0.14 },
    timeline: [
      ["10a", 0.46, "ramp"],
      ["2p", 0.79, "peak heat"],
      ["8p", 0.62, "slow cooling"],
    ],
    equations: [
      "dT/dt = k laplacian(T) + solar_gain - evap_cooling",
      "AQI = f(PM2.5, O3, NO2, boundary_layer_height)",
      "risk = heat_index x vulnerability / cooling_access",
    ],
    explanations: [
      "Impervious cover and building density intensify urban heat islands.",
      "Low tree canopy limits evaporative cooling across vulnerable zones.",
      "Air-quality stress compounds the heat index during stagnant afternoon flow.",
    ],
  },
};

const enabledLayers = {
  weather: true,
  fire: true,
  quake: true,
  flood: true,
  pollution: true,
  infrastructure: true,
  live: true,
};

const earthLayers = {
  satellite: true,
  night: true,
  clouds: true,
  atmosphere: true,
  grid: true,
  coastlines: true,
  terrain: false,
  bathymetry: false,
};

const ui = {
  canvas: document.querySelector("#earth-canvas"),
  fallback: document.querySelector("#fallback"),
  scenarioList: document.querySelector("#scenarioList"),
  scenarioRegion: document.querySelector("#scenarioRegion"),
  scenarioBrief: document.querySelector("#scenarioBrief"),
  riskScore: document.querySelector("#riskScore"),
  riskMeter: document.querySelector("#riskMeter"),
  factorGrid: document.querySelector("#factorGrid"),
  explainList: document.querySelector("#explainList"),
  equationStack: document.querySelector("#equationStack"),
  impactTimeline: document.querySelector("#impactTimeline"),
  horizon: document.querySelector("#timeHorizon"),
  horizonValue: document.querySelector("#horizonValue"),
  blend: document.querySelector("#assimilationBlend"),
  blendValue: document.querySelector("#blendValue"),
  speed: document.querySelector("#simSpeed"),
  speedValue: document.querySelector("#speedValue"),
  autoRotate: document.querySelector("#autoRotate"),
  solverMode: document.querySelector("#solverMode"),
  ensembleCount: document.querySelector("#ensembleCount"),
  assimilationValue: document.querySelector("#assimilationValue"),
  modelResidual: document.querySelector("#modelResidual"),
  cflValue: document.querySelector("#cflValue"),
  diffusionValue: document.querySelector("#diffusionValue"),
  vorticityValue: document.querySelector("#vorticityValue"),
  telemetryLabels: [
    document.querySelector("#telemetryLabel0"),
    document.querySelector("#telemetryLabel1"),
    document.querySelector("#telemetryLabel2"),
    document.querySelector("#telemetryLabel3"),
  ],
  telemetry: [
    document.querySelector("#windTelemetry"),
    document.querySelector("#moistureTelemetry"),
    document.querySelector("#exposureTelemetry"),
    document.querySelector("#uncertaintyTelemetry"),
  ],
  feedStatus: document.querySelector("#feedStatus"),
  liveEventList: document.querySelector("#liveEventList"),
  refreshFeeds: document.querySelector("#refreshFeeds"),
  lastUpdated: document.querySelector("#lastUpdated"),
  fieldCanvas: document.querySelector("#field-canvas"),
  confidenceScore: document.querySelector("#confidenceScore"),
  sourceModeBanner: document.querySelector("#sourceModeBanner"),
  sourceModeLabel: document.querySelector("#sourceModeLabel"),
  sourceModeDetail: document.querySelector("#sourceModeDetail"),
  copyModelSummary: document.querySelector("#copyModelSummary"),
  scenarioModelTitle: document.querySelector("#scenarioModelTitle"),
  confidenceRows: document.querySelector("#confidenceRows"),
  wildfireAudit: document.querySelector("#wildfireAudit"),
  windCompassArrow: document.querySelector("#windCompassArrow"),
  windCompassSpeed: document.querySelector("#windCompassSpeed"),
  earthTextureStatus: document.querySelector("#earthTextureStatus"),
  overlayOpacity: document.querySelector("#overlayOpacity"),
  overlayOpacityValue: document.querySelector("#overlayOpacityValue"),
  followRegion: document.querySelector("#followRegion"),
  whatSeeingButton: document.querySelector("#whatSeeingButton"),
  whatSeeingText: document.querySelector("#whatSeeingText"),
};

let activeScenario = "hurricane";
let currentView = "cinematic";
let livePressure = 0;
let wildfireModel;
let wildfireLoading = false;
let engine;
let fieldModel;
let THREE_NS;

for (const [key, scenario] of Object.entries(scenarios)) {
  const button = document.createElement("button");
  button.className = "scenario-button";
  button.type = "button";
  button.dataset.scenario = key;
  button.style.setProperty("--accent", scenario.accent);
  button.innerHTML = `<i></i><b>${scenario.label}</b><small>${scenario.score}</small>`;
  button.addEventListener("click", () => setScenario(key));
  ui.scenarioList.append(button);
}

document.querySelectorAll("[data-layer]").forEach((checkbox) => {
  checkbox.addEventListener("change", (event) => {
    enabledLayers[event.target.dataset.layer] = event.target.checked;
    engine?.setLayerVisibility(enabledLayers);
    renderWhatSeeingText();
  });
});

document.querySelectorAll("[data-earth-layer]").forEach((checkbox) => {
  checkbox.addEventListener("change", (event) => {
    earthLayers[event.target.dataset.earthLayer] = event.target.checked;
    engine?.setEarthLayers(earthLayers);
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    engine?.setViewMode(currentView);
    renderScenario();
  });
});

ui.horizon.addEventListener("input", () => {
  ui.horizonValue.textContent = `${ui.horizon.value}h`;
  renderScenario();
});

ui.blend.addEventListener("input", () => {
  ui.blendValue.textContent = `${ui.blend.value}%`;
  ui.assimilationValue.textContent = `${ui.blend.value}%`;
  renderScenario();
});

ui.speed.addEventListener("input", () => {
  ui.speedValue.textContent = `${(Number(ui.speed.value) / 10).toFixed(1)}x`;
  engine?.setSpeed(Number(ui.speed.value) / 10);
});

ui.overlayOpacity.addEventListener("input", () => {
  const opacity = Number(ui.overlayOpacity.value) / 100;
  ui.overlayOpacityValue.textContent = `${ui.overlayOpacity.value}%`;
  engine?.setOverlayOpacity(opacity);
});

ui.autoRotate.addEventListener("change", () => {
  engine?.setAutoRotate(ui.autoRotate.checked);
});

ui.followRegion.addEventListener("change", () => {
  if (ui.followRegion.checked) {
    engine?.focusScenario(scenarios[activeScenario], enabledLayers, { follow: true });
  }
});

ui.refreshFeeds.addEventListener("click", () => {
  refreshLiveFeeds();
});

ui.copyModelSummary.addEventListener("click", () => {
  copyWildfireSummary();
});

ui.whatSeeingButton.addEventListener("click", () => {
  ui.whatSeeingText.hidden = !ui.whatSeeingText.hidden;
  renderWhatSeeingText();
});

async function boot() {
  fieldModel = createPhysicsField(ui.fieldCanvas);
  fieldModel.start();
  renderScenario();

  try {
    const THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js"
    );
    THREE_NS = THREE;
    engine = createEarthEngine(THREE, ui.canvas);
    engine.setSpeed(Number(ui.speed.value) / 10);
    engine.setAutoRotate(ui.autoRotate.checked);
    setScenario(activeScenario);
    engine.animate();
    refreshLiveFeeds();
    refreshWildfireModel();
  } catch (error) {
    console.error(error);
    ui.fallback.hidden = false;
  }
}

async function refreshLiveFeeds() {
  ui.refreshFeeds.disabled = true;
  ui.refreshFeeds.textContent = "Loading";
  renderFeedStatus({
    sources: [],
    events: [],
    updatedAt: new Date().toISOString(),
    loading: true,
  });

  try {
    const liveData = await fetchLiveData();
    livePressure = calculateLivePressure(liveData.events);
    renderFeedStatus(liveData);
    renderScenario();
    engine?.setLiveEvents(liveData.events);
  } catch (error) {
    renderFeedStatus({
      sources: [],
      events: [],
      updatedAt: new Date().toISOString(),
      error: error.message,
    });
  } finally {
    ui.refreshFeeds.disabled = false;
    ui.refreshFeeds.textContent = "Refresh";
  }
}

async function refreshWildfireModel() {
  const scenario = scenarios.wildfire;
  wildfireLoading = true;
  renderConfidencePanel();

  try {
    const payload = await fetchWildfireInputs({
      lat: scenario.location[0],
      lon: scenario.location[1],
      bbox: scenario.wildfire.bbox,
    });
    wildfireModel = buildWildfireModel(payload, scenario);
  } catch (error) {
    wildfireModel = defaultWildfireModel(scenario);
    wildfireModel.confidence.rows.unshift({
      label: "Proxy server",
      status: "missing",
      detail: `Wildfire proxy unavailable. If you are running python -m http.server, switch to node server.mjs. (${error.message})`,
    });
    wildfireModel.sourceMode = {
      label: "Demo fallback mode",
      detail: "The browser could not reach /api/wildfire, so weather, FIRMS, and NWS inputs are demo fallbacks.",
    };
    wildfireModel.confidence.score = Math.max(0.22, wildfireModel.confidence.score - 0.18);
  } finally {
    wildfireLoading = false;
    if (activeScenario === "wildfire") {
      fieldModel?.setWildfireModel(wildfireModel);
      engine?.setWildfireModel(wildfireModel);
      engine?.focusScenario(scenarios.wildfire, enabledLayers, { follow: ui.followRegion.checked });
    }
    renderScenario();
    renderConfidencePanel();
  }
}

function renderFeedStatus(liveData) {
  if (liveData.loading) {
    ui.feedStatus.innerHTML = `<div class="feed-row"><span>Fetching live sources</span><strong>...</strong></div>`;
    ui.liveEventList.innerHTML = `<li>Contacting USGS, NWS, and NOAA CO-OPS.</li>`;
    ui.lastUpdated.textContent = "Assimilating public feeds...";
    return;
  }

  const sourceRows = liveData.sources
    .map((source) => {
      const state = source.status === "ok" ? "ok" : "error";
      return `<div class="feed-row is-${state}">
        <span>${escapeHtml(source.label)}</span>
        <strong>${source.status === "ok" ? source.count : "!"}</strong>
      </div>`;
    })
    .join("");

  const plannedRows = plannedSources
    .map((source) => `<div class="feed-row is-planned"><span>${escapeHtml(source)}</span><strong>next</strong></div>`)
    .join("");

  ui.feedStatus.innerHTML =
    sourceRows ||
    `<div class="feed-row is-error"><span>${escapeHtml(liveData.error ?? "No feeds loaded")}</span><strong>!</strong></div>`;
  ui.feedStatus.insertAdjacentHTML("beforeend", plannedRows);

  const events = liveData.events
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 6)
    .map((event) => `<li>
      <b>${escapeHtml(event.title)}</b>
      <span>${escapeHtml(event.source)} - ${escapeHtml(event.detail)}</span>
    </li>`)
    .join("");

  ui.liveEventList.innerHTML = events || `<li>No live events returned yet.</li>`;
  ui.lastUpdated.textContent = `Updated ${new Date(liveData.updatedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - live pressure ${(livePressure * 100).toFixed(0)}%`;
}

function setScenario(key) {
  activeScenario = key;
  renderScenario();
  if (key === "wildfire" && !wildfireModel && !wildfireLoading) {
    refreshWildfireModel();
  }
  if (key === "wildfire" && wildfireModel) {
    engine?.setWildfireModel(wildfireModel);
  }
  engine?.focusScenario(scenarios[key], enabledLayers, { follow: ui.followRegion.checked });
  engine?.setOverlayOpacity(Number(ui.overlayOpacity.value) / 100);
  if (key === "wildfire" && wildfireModel) {
    fieldModel?.setWildfireModel(wildfireModel);
  } else {
    fieldModel?.setScenario(scenarios[key]);
  }
}

function renderScenario() {
  const scenario = scenarios[activeScenario];
  const operationalWildfire = activeScenario === "wildfire" ? wildfireModel : null;
  const horizonFactor = Number(ui.horizon.value) / 24;
  const blendFactor = Number(ui.blend.value) / 100;
  const viewBoost = currentView === "physics" ? 2 : currentView === "response" ? -1 : 0;
  const baseScore = operationalWildfire ? Math.round(operationalWildfire.risk.score * 100) : scenario.score;
  const score = Math.min(
    99,
    Math.round(baseScore + horizonFactor * 8 + livePressure * blendFactor * 8 + viewBoost),
  );

  ui.scenarioRegion.textContent = scenario.region;
  ui.scenarioBrief.textContent = scenario.brief;
  ui.riskScore.textContent = score;
  ui.riskMeter.style.width = `${score}%`;
  ui.assimilationValue.textContent = `${ui.blend.value}%`;
  ui.ensembleCount.textContent = `${Math.round(24 + Number(ui.horizon.value) * 4)} runs`;
  ui.solverMode.textContent = currentView === "physics" ? "PDE focus" : "Hybrid PDE";

  const telemetry = operationalWildfire?.telemetry ?? scenario.telemetry;
  scenario.telemetryLabels.forEach((label, index) => {
    ui.telemetryLabels[index].textContent = label;
  });
  telemetry.forEach((value, index) => {
    ui.telemetry[index].textContent = value;
  });

  const factors = operationalWildfire?.factors ?? adjustedFactors(scenario, horizonFactor, blendFactor);
  ui.factorGrid.innerHTML = Object.entries(factors)
    .map(([key, value]) => factorRow(key, value))
    .join("");

  const explanations = operationalWildfire
    ? wildfireExplanations(operationalWildfire)
    : scenario.explanations;
  ui.explainList.replaceChildren(
    ...explanations.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }),
  );

  ui.equationStack.replaceChildren(
    ...scenario.equations.map((text) => {
      const code = document.createElement("code");
      code.textContent = text;
      return code;
    }),
  );

  const timeline = operationalWildfire ? wildfireTimeline(operationalWildfire) : scenario.timeline;
  ui.impactTimeline.innerHTML = timeline
    .map(([time, value, label]) => timelineRow(time, value + horizonFactor * 0.08, label))
    .join("");

  const diagnostics = operationalWildfire?.diagnostics ?? scenario.diagnostics;
  ui.modelResidual.textContent = `Residual ${diagnostics.residual.toFixed(2)}`;
  ui.cflValue.textContent = diagnostics.cfl.toFixed(2);
  ui.diffusionValue.textContent = diagnostics.diffusion.toFixed(3);
  ui.vorticityValue.textContent = diagnostics.vorticity.toFixed(2);

  document.querySelectorAll(".scenario-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scenario === activeScenario);
  });
  renderConfidencePanel();
  renderWhatSeeingText();
}

function renderConfidencePanel() {
  if (activeScenario !== "wildfire") {
    renderScenarioDiagnosticsPanel();
    return;
  }

  if (wildfireLoading) {
    ui.scenarioModelTitle.textContent = "Wildfire model confidence";
    ui.confidenceScore.textContent = "Loading";
    setSourceModeBanner("Loading wildfire model", "Fetching wildfire proxy inputs and rebuilding spread/smoke model.", "neutral");
    ui.copyModelSummary.disabled = true;
    ui.copyModelSummary.classList.remove("is-hidden");
    ui.windCompassSpeed.closest(".wind-compass")?.classList.remove("is-hidden");
    ui.confidenceRows.innerHTML = groupedConfidenceRows([
      {
        label: "Assimilation",
        status: "simulated",
        detail: "Contacting local proxy for FIRMS, NWS, and Open-Meteo.",
      },
    ]);
    ui.wildfireAudit.innerHTML = "";
    renderWindCompass(null);
    return;
  }

  if (!wildfireModel) {
    ui.scenarioModelTitle.textContent = "Wildfire model confidence";
    ui.confidenceScore.textContent = "--";
    setSourceModeBanner(
      "No wildfire model loaded",
      "Select Wildfire to inspect live, estimated, simulated, and missing inputs.",
      "neutral",
    );
    ui.copyModelSummary.disabled = true;
    ui.copyModelSummary.classList.remove("is-hidden");
    ui.windCompassSpeed.closest(".wind-compass")?.classList.remove("is-hidden");
    ui.confidenceRows.innerHTML = "";
    ui.wildfireAudit.innerHTML = "";
    renderWindCompass(null);
    return;
  }

  ui.scenarioModelTitle.textContent = "Wildfire model confidence";
  const score = Math.round(wildfireModel.confidence.score * 100);
  ui.confidenceScore.textContent = `${score}%`;
  setSourceModeBanner(
    wildfireModel.sourceMode.label,
    `${wildfireModel.sourceMode.label}: ${wildfireModel.sourceMode.detail}`,
    sourceModeClass(wildfireModel.sourceMode.label),
  );
  ui.copyModelSummary.disabled = false;
  ui.copyModelSummary.classList.remove("is-hidden");
  ui.windCompassSpeed.closest(".wind-compass")?.classList.remove("is-hidden");
  ui.confidenceRows.innerHTML = groupedConfidenceRows(wildfireModel.confidence.rows);
  ui.wildfireAudit.innerHTML = renderWildfireAudit(wildfireModel);
  renderWindCompass(wildfireModel);
}

function renderScenarioDiagnosticsPanel() {
  const scenario = scenarios[activeScenario];
  ui.scenarioModelTitle.textContent = `${scenario.label} diagnostics`;
  ui.confidenceScore.textContent = `${Math.round(scenario.factors.confidence * 100)}%`;
  ui.copyModelSummary.disabled = true;
  ui.copyModelSummary.classList.add("is-hidden");
  ui.windCompassSpeed.closest(".wind-compass")?.classList.add("is-hidden");

  const mode = {
    hurricane: [
      "Hurricane operational view",
      "Weather forcing, surge, flood, and asset exposure overlays are attached to the Florida coast scenario region.",
      "synthetic",
    ],
    earthquake: [
      "Earthquake operational view",
      "Epicenter, wave attenuation, shaking, and coastal screening diagnostics are attached to the Japan trench region.",
      "live",
    ],
    heatwave: [
      "Heatwave operational view",
      "Urban heat, vulnerable exposure, air-quality stress, and cooling-access diagnostics are attached to Dallas.",
      "synthetic",
    ],
  }[activeScenario] ?? ["Scenario diagnostics", "Select a scenario to inspect physics layers.", "neutral"];

  setSourceModeBanner(mode[0], mode[1], mode[2]);
  ui.confidenceRows.innerHTML = groupedConfidenceRows(scenarioConfidenceRows(activeScenario));
  ui.wildfireAudit.innerHTML = renderScenarioAudit(scenario, activeScenario);
  renderWindCompass(null);
}

function scenarioConfidenceRows(key) {
  const rows = {
    hurricane: [
      { label: "NWS alert feed", status: "live", detail: "Public weather alerts are loaded in the Live feeds panel when available." },
      { label: "Wind/pressure field", status: "simulated", detail: "Cyclonic vectors and pressure cone are generated from the Florida scenario forcing." },
      { label: "Storm surge", status: "estimated", detail: "Coastal flood surfaces use shallow-water style assumptions and local bathymetry placeholders." },
      { label: "Facility exposure", status: "estimated", detail: "Hospitals, roads, and substations are placeholder assets until OSM infrastructure is connected." },
    ],
    earthquake: [
      { label: "USGS earthquake feed", status: "live", detail: "Live earthquake markers are read from the public feed and plotted by latitude/longitude." },
      { label: "Epicenter/wavefront", status: "simulated", detail: "Seismic rings approximate P/S-wave propagation and attenuation around the Japan trench." },
      { label: "Depth attenuation", status: "estimated", detail: "Shaking intensity uses simplified radial decay because full ground-motion maps are not connected." },
      { label: "Tsunami screen", status: "fallback", detail: "Coastal risk is scenario-based until NOAA tsunami and bathymetry feeds are wired." },
    ],
    heatwave: [
      { label: "Urban heat layer", status: "simulated", detail: "Heat diffusion is modeled from solar loading, stagnant air, and impervious-surface assumptions." },
      { label: "Population exposure", status: "estimated", detail: "Exposure is a placeholder metro-scale estimate for the Dallas scenario." },
      { label: "Air-quality stress", status: "fallback", detail: "OpenAQ is planned, so the current layer is a fallback stress indicator." },
      { label: "Cooling access", status: "missing", detail: "Cooling centers and canopy equity data are not connected yet." },
    ],
  };
  return rows[key] ?? [];
}

function renderScenarioAudit(scenario, key) {
  const auditRows = {
    hurricane: [
      ["Selected region", scenario.region],
      ["Anchor", `${scenario.location[0].toFixed(1)}, ${scenario.location[1].toFixed(1)}`],
      ["Main overlay", "Wind + surge cone"],
      ["Data effects", "Earth-attached"],
      ["Inactive layers", "Dimmed"],
      ["Camera", "Florida coast"],
    ],
    earthquake: [
      ["Selected region", scenario.region],
      ["Anchor", `${scenario.location[0].toFixed(1)}, ${scenario.location[1].toFixed(1)}`],
      ["Main overlay", "Epicenter + waves"],
      ["Data effects", "Earth-attached"],
      ["Magnitude", scenario.telemetry[0]],
      ["Tsunami screen", "Prototype"],
    ],
    heatwave: [
      ["Selected region", scenario.region],
      ["Anchor", `${scenario.location[0].toFixed(1)}, ${scenario.location[1].toFixed(1)}`],
      ["Main overlay", "Heat diffusion"],
      ["Data effects", "Earth-attached"],
      ["Heat index", scenario.telemetry[0]],
      ["AQ stress", "Fallback"],
    ],
  }[key] ?? [["Selected region", scenario.region]];

  return auditRows
    .map(
      ([label, value]) => `<div class="audit-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>`,
    )
    .join("");
}

function renderWhatSeeingText() {
  if (ui.whatSeeingText.hidden) return;
  const scenario = scenarios[activeScenario];
  const layerNames = Object.entries(enabledLayers)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .join(", ");
  const scenarioText = {
    hurricane:
      "You are viewing the Florida coast hurricane scenario: cyan wind streamlines, a storm-risk cone, coastal flood surfaces, live weather markers, and exposed infrastructure around the selected region.",
    wildfire:
      "You are viewing the Northern California wildfire scenario: separate ignition glows, modeled spread cells, an active perimeter, smoke particles drifting downwind, and the wildfire confidence/audit panel.",
    earthquake:
      "You are viewing the Japan trench earthquake scenario: a yellow epicenter, expanding seismic wave rings, coastal screening layers, live USGS markers, and simplified shaking diagnostics.",
    heatwave:
      "You are viewing the Dallas heatwave scenario: red/orange heat diffusion, urban exposure markers, fallback air-quality stress, and simplified heat-risk diagnostics.",
  }[activeScenario];
  ui.whatSeeingText.textContent = `${scenarioText} Active layers: ${layerNames || "none"}. The selected marker and hazard overlays are anchored to ${scenario.region} coordinates and rotate with Earth.`;
}

function setSourceModeBanner(label, detail, mode) {
  ui.sourceModeLabel.textContent = label;
  ui.sourceModeDetail.textContent = detail;
  ui.sourceModeBanner.className = `source-mode-banner is-${mode}`;
}

function sourceModeClass(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes("demo") || normalized.includes("low-confidence")) return "demo";
  if (normalized.includes("synthetic")) return "synthetic";
  if (normalized.includes("operational")) return "live";
  return "neutral";
}

function groupedConfidenceRows(rows) {
  const groups = [
    ["Live", rows.filter((row) => row.status === "live")],
    ["Estimated", rows.filter((row) => row.status === "estimated")],
    ["Simulated", rows.filter((row) => row.status === "simulated")],
    ["Missing / Fallback", rows.filter((row) => ["missing", "fallback", "error"].includes(row.status))],
  ];
  return groups
    .filter(([, groupRows]) => groupRows.length)
    .map(([title, groupRows]) => `<section class="confidence-group">
      <h3>${escapeHtml(title)}</h3>
      ${groupRows
        .map(
          (row) => `<div class="confidence-row">
            <span><b>${escapeHtml(row.label)}</b><small>${escapeHtml(row.detail)}</small></span>
            <strong class="confidence-badge is-${escapeHtml(row.status)}">${escapeHtml(row.status)}</strong>
          </div>`,
        )
        .join("")}
    </section>`)
    .join("");
}

function renderWindCompass(model) {
  if (!model) {
    ui.windCompassArrow.style.setProperty("--wind-deg", "0deg");
    ui.windCompassSpeed.textContent = "-- mph";
    return;
  }
  ui.windCompassArrow.style.setProperty("--wind-deg", `${Math.round(model.wind.directionDeg)}deg`);
  ui.windCompassSpeed.textContent = `${Math.round(model.wind.speedMph)} mph`;
}

async function copyWildfireSummary() {
  if (!wildfireModel) return;
  const text = wildfireSummaryText(wildfireModel);
  try {
    await navigator.clipboard.writeText(text);
    ui.copyModelSummary.textContent = "Copied";
    setTimeout(() => {
      ui.copyModelSummary.textContent = "Copy model summary";
    }, 1400);
  } catch {
    ui.copyModelSummary.textContent = "Copy failed";
    setTimeout(() => {
      ui.copyModelSummary.textContent = "Copy model summary";
    }, 1600);
  }
}

function wildfireSummaryText(model) {
  const audit = model.audit;
  return [
    "GaiaScope wildfire model summary",
    `Source mode: ${model.sourceMode.label}`,
    `Confidence score: ${Math.round(model.confidence.score * 100)}%`,
    `Wind: ${audit.windSpeedMph.toFixed(1)} mph @ ${Math.round(audit.windDirectionDeg)} deg`,
    `Humidity: ${Math.round(audit.humidityPct)}% RH`,
    `Fuel dryness: ${Math.round(audit.fuelDryness * 100)}%`,
    `Slope grade/aspect: ${Math.round(audit.slopeGrade * 100)}% @ ${Math.round(audit.slopeAspectDeg)} deg`,
    `Spread area: ${audit.spreadAreaKm2.toFixed(1)} km2`,
    `Head-fire rate: ${audit.headFireRateKmh.toFixed(1)} km/h`,
    `Smoke particle count: ${audit.smokeParticleCount}`,
    `Input source summary: ${audit.sourceSummary}`,
  ].join("\n");
}

function wildfireExplanations(model) {
  return [
    `Wind-driven head-fire spread is ${model.spread.headFireRateKmh.toFixed(1)} km/h: the solver elongates the fire ellipse in the downwind direction using ${Math.round(model.wind.speedMph)} mph wind and ${Math.round(model.fuelDryness * 100)}% estimated fuel dryness.`,
    `Crosswind smoke diffusion is modeled separately from downwind advection; lower humidity increases turbulent widening, so the plume spreads laterally while still drifting toward ${Math.round(model.wind.directionDeg)} degrees.`,
    `Terrain slope is currently estimated from a regional Sierra foothill grade/aspect approximation. Real DEM tiles are not connected yet, so slope boosts confidence less than live weather or FIRMS detections.`,
    model.sourceMode.label.includes("synthetic") || model.sourceMode.label.includes("fallback")
      ? "Because FIRMS_MAP_KEY is missing or the proxy is unavailable, ignition points are synthetic fallback seeds; confidence is intentionally reduced and the UI labels this as fallback/demo mode."
      : "FIRMS detections are live, so ignition placement contributes strongly to confidence while fuel dryness and slope remain estimated.",
  ];
}

function renderWildfireAudit(model) {
  const audit = model.audit;
  const rows = [
    ["Ignitions", audit.ignitionPoints],
    ["Wind", `${audit.windSpeedMph.toFixed(1)} mph @ ${Math.round(audit.windDirectionDeg)} deg`],
    ["Humidity", `${Math.round(audit.humidityPct)}% RH`],
    ["Fuel dryness", `${Math.round(audit.fuelDryness * 100)}%`],
    ["Slope", `${Math.round(audit.slopeGrade * 100)}% @ ${Math.round(audit.slopeAspectDeg)} deg`],
    ["Spread area", `${audit.spreadAreaKm2.toFixed(1)} km2`],
    ["Head-fire", `${audit.headFireRateKmh.toFixed(1)} km/h`],
    ["Smoke particles", audit.smokeParticleCount],
    ["Inputs", audit.sourceSummary],
  ];
  return rows
    .map(
      ([label, value]) => `<div class="audit-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>`,
    )
    .join("");
}

function wildfireTimeline(model) {
  return [
    ["0-1h", clamp(model.risk.score * 0.62, 0, 1), "surface run"],
    ["2-4h", clamp(model.risk.score * 0.92, 0, 1), "head fire"],
    ["5-8h", clamp(model.smoke.diffusion + model.risk.score * 0.45, 0, 1), "smoke impact"],
  ];
}

function adjustedFactors(scenario, horizonFactor, blendFactor) {
  return {
    forcing: clamp(scenario.factors.forcing + horizonFactor * 0.1, 0, 1),
    exposure: clamp(scenario.factors.exposure + livePressure * blendFactor * 0.14, 0, 1),
    vulnerability: scenario.factors.vulnerability,
    confidence: clamp(scenario.factors.confidence + blendFactor * 0.12 - horizonFactor * 0.05, 0, 1),
  };
}

function factorRow(label, value) {
  const pct = Math.round(value * 100);
  return `<div class="factor-row">
    <span>${escapeHtml(label)}</span>
    <div class="factor-track"><span style="--value:${pct}%"></span></div>
    <strong>${pct}%</strong>
  </div>`;
}

function timelineRow(time, value, label) {
  const pct = Math.round(clamp(value, 0, 1) * 100);
  return `<div class="timeline-row">
    <span>${escapeHtml(time)}</span>
    <div class="timeline-track"><span style="--value:${pct}%"></span></div>
    <strong>${escapeHtml(label)}</strong>
  </div>`;
}

function calculateLivePressure(events) {
  if (!events.length) {
    return 0;
  }
  const top = events
    .map((event) => event.severity)
    .sort((a, b) => b - a)
    .slice(0, 20);
  return clamp(top.reduce((sum, value) => sum + value, 0) / Math.max(7, top.length), 0, 1);
}

function createEarthEngine(THREE, canvas) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02050a, 0.036);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.22, 7.1);

  const backgroundSpaceGroup = new THREE.Group();
  scene.add(backgroundSpaceGroup);

  const earthSystem = new THREE.Group();
  scene.add(earthSystem);

  const fallbackEarthTexture = createEarthTexture(THREE);
  const bumpTexture = createBumpTexture(THREE);
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(2, 160, 160),
    new THREE.MeshStandardMaterial({
      map: fallbackEarthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.055,
      roughness: 0.78,
      metalness: 0.02,
      emissive: 0x021421,
      emissiveIntensity: 0.32,
    }),
  );
  earthSystem.add(globe);

  const cityLights = createCityLights(THREE);
  earthSystem.add(cityLights);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(2.045, 128, 128),
    new THREE.MeshBasicMaterial({
      map: createCloudTexture(THREE),
      transparent: true,
      opacity: 0.21,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  earthSystem.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.16, 128, 128),
    new THREE.MeshBasicMaterial({
      color: 0x54d8ff,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    }),
  );
  earthSystem.add(atmosphere);

  const gridOverlay = createGrid(THREE);
  earthSystem.add(gridOverlay);
  const coastlineOverlay = createCoastlineOverlay(THREE);
  earthSystem.add(coastlineOverlay);
  const terrainOverlay = createSurfaceModeOverlay(THREE, 0xb88f59, 0.0);
  const bathymetryOverlay = createSurfaceModeOverlay(THREE, 0x064b7c, 0.0);
  earthSystem.add(terrainOverlay);
  earthSystem.add(bathymetryOverlay);
  backgroundSpaceGroup.add(createStars(THREE));
  backgroundSpaceGroup.add(createSunGlow(THREE));

  const hazardRoot = new THREE.Group();
  earthSystem.add(hazardRoot);

  const layers = {
    weather: new THREE.Group(),
    fire: new THREE.Group(),
    quake: new THREE.Group(),
    flood: new THREE.Group(),
    pollution: new THREE.Group(),
    infrastructure: new THREE.Group(),
    live: new THREE.Group(),
    selection: new THREE.Group(),
  };
  Object.values(layers).forEach((layer) => hazardRoot.add(layer));

  const lights = [
    new THREE.AmbientLight(0x6d94bc, 0.8),
    new THREE.DirectionalLight(0xffffff, 3.2),
    new THREE.PointLight(0x54d8ff, 20, 14),
  ];
  lights[1].position.set(-3.8, 2.7, 5.4);
  lights[2].position.set(2.4, -0.4, 3.2);
  lights.forEach((light) => scene.add(light));

  let targetRotation = new THREE.Euler(0, 0, 0);
  let autoRotate = true;
  let speed = 1.2;
  let viewMode = "cinematic";
  let activeWildfireModel = null;
  let overlayOpacity = Number(ui.overlayOpacity.value) / 100;
  let layerEmphasis = scenarioLayerEmphasis("Hurricane");
  let orbitAngle = 0;
  const clock = new THREE.Clock();
  loadPremiumEarthTextures(THREE, globe, clouds, cityLights);
  installAnchoringDebug({ THREE, earthSystem, globe, hazardRoot, layers });

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function focusScenario(scenario, visibility, options = {}) {
    if (options.follow !== false) {
      targetRotation = rotationForLatLon(scenario.camera.lat, scenario.camera.lon);
      camera.position.z = scenario.camera.zoom;
    }
    layerEmphasis = scenarioLayerEmphasis(scenario.label);
    rebuildHazards(scenario);
    setLayerVisibility(visibility);
    setViewMode(viewMode);
    setOverlayOpacity(overlayOpacity);
  }

  function rebuildHazards(scenario) {
    ["weather", "fire", "quake", "flood", "pollution", "infrastructure", "selection"].forEach((key) => {
      clearGroup(layers[key]);
    });
    const [lat, lon] = scenario.location;
    createSelectedRegionMarker(THREE, layers.selection, scenario);
    createWindField(THREE, layers.weather, lat, lon, scenario.accent, scenario.field.swirl);
    if (scenario.label === "Wildfire" && activeWildfireModel) {
      createOperationalFireField(THREE, layers.fire, activeWildfireModel);
      createOperationalSmokePlume(THREE, layers.pollution, activeWildfireModel);
    } else {
      createFireField(THREE, layers.fire, lat, lon, scenario.accent);
      createSmokePlume(THREE, layers.pollution, lat, lon);
    }
    createSeismicRings(THREE, layers.quake, lat, lon, scenario.accent);
    createFloodField(THREE, layers.flood, lat, lon);
    createInfrastructure(THREE, layers.infrastructure, lat, lon, scenario.accent);
    createRiskCone(THREE, layers.weather, lat, lon, scenario.accent);
  }

  function setLayerVisibility(visibility) {
    Object.entries(visibility).forEach(([key, value]) => {
      if (layers[key]) {
        layers[key].visible = value;
        setLayerOpacity(layers[key], overlayOpacity * (layerEmphasis[key] ?? 0.25));
      }
    });
    layers.selection.visible = true;
    setLayerOpacity(layers.selection, overlayOpacity);
  }

  function setEarthLayers(nextLayers) {
    globe.visible = nextLayers.satellite;
    cityLights.visible = nextLayers.night;
    clouds.visible = nextLayers.clouds;
    atmosphere.visible = nextLayers.atmosphere;
    gridOverlay.visible = nextLayers.grid;
    coastlineOverlay.visible = nextLayers.coastlines;
    terrainOverlay.visible = nextLayers.terrain;
    bathymetryOverlay.visible = nextLayers.bathymetry;
    terrainOverlay.material.opacity = nextLayers.terrain ? 0.18 : 0;
    bathymetryOverlay.material.opacity = nextLayers.bathymetry ? 0.16 : 0;
    globe.material.bumpScale = nextLayers.terrain ? 0.09 : 0.055;
    globe.material.needsUpdate = true;
  }

  function setOverlayOpacity(value) {
    overlayOpacity = value;
    Object.values(layers).forEach((layer) => {
      layer.traverse((child) => {
        if (child.material?.transparent) {
          child.material.userData.baseOpacity ??= child.material.opacity;
          const layerKey = Object.entries(layers).find(([, value]) => value === layer)?.[0];
          const emphasis = layerKey === "selection" ? 1 : layerEmphasis[layerKey] ?? 0.25;
          child.material.opacity = child.material.userData.baseOpacity * overlayOpacity * emphasis;
        }
      });
    });
    gridOverlay.children.forEach((child) => {
      if (child.material) child.material.opacity = 0.04 + overlayOpacity * 0.12;
    });
    coastlineOverlay.children.forEach((child) => {
      if (child.material) child.material.opacity = 0.12 + overlayOpacity * 0.28;
    });
  }

  function setLiveEvents(events) {
    clearGroup(layers.live);
    events.slice(0, 80).forEach((event) => {
      createLiveEventMarker(THREE, layers.live, event);
    });
  }

  function setViewMode(mode) {
    viewMode = mode;
    layers.infrastructure.visible = enabledLayers.infrastructure && mode !== "cinematic";
    layers.live.visible = enabledLayers.live;
    atmosphere.material.opacity = mode === "physics" ? 0.18 : 0.12;
    cityLights.material.opacity = mode === "response" ? 0.95 : 0.58;
  }

  function setAutoRotate(value) {
    autoRotate = value;
  }

  function setSpeed(value) {
    speed = value;
  }

  function setWildfireModel(model) {
    activeWildfireModel = model;
  }

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const dt = Math.max(0.6, speed);
    if (autoRotate) {
      orbitAngle += 0.00055 * dt;
    }
    earthSystem.rotation.x += (targetRotation.x - earthSystem.rotation.x) * 0.034;
    earthSystem.rotation.y += (targetRotation.y + orbitAngle - earthSystem.rotation.y) * 0.034;
    earthSystem.rotation.z = Math.sin(elapsed * 0.08) * 0.02;

    layers.weather.children.forEach((item, index) => {
      item.rotation.z += (0.006 + index * 0.00035) * dt;
      if (item.material) {
        item.material.opacity =
          (0.24 + Math.sin(elapsed * 2 + index) * 0.1) * overlayOpacity * (layerEmphasis.weather ?? 1);
      }
    });

    layers.fire.children.forEach((item, index) => {
      const flicker = 1 + Math.sin(elapsed * 6 + index) * 0.24;
      item.scale.setScalar(item.userData.baseScale * flicker);
    });

    layers.quake.children.forEach((ring, index) => {
      const wave = ((elapsed * 0.3 * dt + index * 0.2) % 1) + 0.22;
      ring.scale.setScalar(wave);
      ring.material.opacity = Math.max(0, 0.62 - wave * 0.42) * overlayOpacity * (layerEmphasis.quake ?? 1);
    });

    layers.pollution.children.forEach((puff, index) => {
      if (!puff.userData.drift) return;
      puff.position.addScaledVector(puff.userData.drift, 0.0048 * dt);
      puff.material.opacity =
        (0.1 + Math.sin(elapsed + index) * 0.035) * overlayOpacity * (layerEmphasis.pollution ?? 1);
      if (puff.position.length() > 2.48) {
        puff.position.copy(puff.userData.origin);
      }
    });

    layers.live.children.forEach((item, index) => {
      if (item.userData.isLiveMarker) {
        item.scale.setScalar(1 + Math.sin(elapsed * 3.2 + index) * 0.2);
      }
    });

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  resize();
  setEarthLayers(earthLayers);
  setOverlayOpacity(overlayOpacity);

  return {
    animate,
    focusScenario,
    setLayerVisibility,
    setLiveEvents,
    setViewMode,
    setAutoRotate,
    setSpeed,
    setWildfireModel,
    setEarthLayers,
    setOverlayOpacity,
  };
}

function scenarioLayerEmphasis(label) {
  const dim = 0.18;
  const base = {
    weather: dim,
    fire: dim,
    quake: dim,
    flood: dim,
    pollution: dim,
    infrastructure: 0.42,
    live: 0.72,
  };
  if (label === "Hurricane") {
    return { ...base, weather: 1, flood: 0.86, infrastructure: 0.55, live: 0.78 };
  }
  if (label === "Wildfire") {
    return { ...base, fire: 1, pollution: 0.9, weather: 0.62, infrastructure: 0.5, live: 0.7 };
  }
  if (label === "Earthquake") {
    return { ...base, quake: 1, flood: 0.42, infrastructure: 0.55, live: 0.9 };
  }
  if (label === "Heatwave") {
    return { ...base, fire: 0.78, pollution: 0.56, infrastructure: 0.58, weather: 0.35, live: 0.64 };
  }
  return base;
}

function setLayerOpacity(group, multiplier) {
  group.traverse((child) => {
    if (child.material?.transparent) {
      child.material.userData.baseOpacity ??= child.material.opacity;
      child.material.opacity = child.material.userData.baseOpacity * multiplier;
    }
  });
}

function installAnchoringDebug({ earthSystem, globe, hazardRoot, layers }) {
  window.gaiaScopeAnchoringDebug = () => {
    earthSystem.updateMatrixWorld(true);
    const floridaLocal = latLonToVector3(27.7, -81.7, 2.31);
    const californiaLocal = latLonToVector3(39.2, -121.1, 2.31);
    const japanLocal = latLonToVector3(38.3, 142.4, 2.31);
    const toPlain = (vector) => ({
      x: Number(vector.x.toFixed(3)),
      y: Number(vector.y.toFixed(3)),
      z: Number(vector.z.toFixed(3)),
    });

    return {
      hierarchy: {
        globeParentIsEarthSystem: globe.parent === earthSystem,
        hazardRootParentIsEarthSystem: hazardRoot.parent === earthSystem,
        layerParentsAreHazardRoot: Object.fromEntries(
          Object.entries(layers).map(([key, layer]) => [key, layer.parent === hazardRoot]),
        ),
      },
      earthRotation: {
        x: Number(earthSystem.rotation.x.toFixed(4)),
        y: Number(earthSystem.rotation.y.toFixed(4)),
        z: Number(earthSystem.rotation.z.toFixed(4)),
      },
      sampleAnchors: {
        floridaWorld: toPlain(earthSystem.localToWorld(floridaLocal.clone())),
        californiaWorld: toPlain(earthSystem.localToWorld(californiaLocal.clone())),
        japanWorld: toPlain(earthSystem.localToWorld(japanLocal.clone())),
      },
      note:
        "Run this while Orbit is enabled. Sample world positions should change as earthSystem rotates, while every hazard layer remains parented under hazardRoot.",
    };
  };
  console.info("GaiaScope anchoring debug ready: run window.gaiaScopeAnchoringDebug()");
}

function createGrid(THREE) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x7acdf2,
    transparent: true,
    opacity: 0.1,
  });
  for (let lat = -60; lat <= 60; lat += 15) {
    group.add(makeLatitude(THREE, lat, material));
  }
  for (let lon = 0; lon < 180; lon += 10) {
    const meridian = makeMeridian(THREE, material);
    meridian.rotation.y = THREE.MathUtils.degToRad(lon);
    group.add(meridian);
  }
  return group;
}

function createWindField(THREE, group, lat, lon, accent, swirl) {
  for (let i = 0; i < 44; i += 1) {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.34,
    });
    const radius = 0.1 + i * 0.015;
    const points = [];
    for (let t = 0; t < 72; t += 1) {
      const angle = t / 8 + i * 0.4;
      const shear = Math.sin(t * 0.09 + i) * swirl * 1.4;
      points.push(
        latLonToVector3(
          lat + Math.sin(angle) * radius * 10 + shear,
          lon + Math.cos(angle) * radius * 15 + i * 0.04,
          2.08 + i * 0.001,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)), material));
  }
}

function createRiskCone(THREE, group, lat, lon, accent) {
  const normal = latLonToVector3(lat, lon, 1).normalize();
  const cone = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 96, 0.2, Math.PI * 1.25),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  cone.position.copy(latLonToVector3(lat + 1.1, lon + 0.6, 2.11));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  group.add(cone);
}

function createFireField(THREE, group, lat, lon, accent) {
  const colors = [0xff4d2e, 0xff9f1c, 0xffd166, new THREE.Color(accent)];
  for (let i = 0; i < 34; i += 1) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.022 + Math.random() * 0.028, 18, 18),
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
      }),
    );
    spot.position.copy(latLonToVector3(lat + (Math.random() - 0.5) * 5.6, lon + (Math.random() - 0.5) * 7, 2.15));
    spot.userData.baseScale = 0.75 + Math.random() * 1.9;
    group.add(spot);
  }
}

function createOperationalFireField(THREE, group, model) {
  const heatMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6a2e,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const perimeterMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff2a8,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
  });

  model.spread.cells.slice(0, 240).forEach((cell) => {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.015 + cell.intensity * 0.045, 18), heatMaterial.clone());
    const normal = latLonToVector3(cell.lat, cell.lon, 1).normalize();
    patch.position.copy(latLonToVector3(cell.lat, cell.lon, 2.155));
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    patch.material.opacity = 0.12 + cell.intensity * 0.46;
    patch.userData.baseScale = 0.85 + cell.intensity * 1.2;
    group.add(patch);
  });

  model.spread.perimeter.slice(0, 90).forEach((cell) => {
    const point = new THREE.Mesh(new THREE.SphereGeometry(0.018 + cell.intensity * 0.035, 12, 12), perimeterMaterial);
    point.position.copy(latLonToVector3(cell.lat, cell.lon, 2.2));
    point.userData.baseScale = 1;
    group.add(point);
  });

  model.ignitions.forEach((ignition) => {
    const normal = latLonToVector3(ignition.lat, ignition.lon, 1).normalize();
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.082, 42),
      new THREE.MeshBasicMaterial({
        color: ignition.live ? 0xfff2a8 : 0xff8a3d,
        transparent: true,
        opacity: ignition.live ? 0.72 : 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.position.copy(latLonToVector3(ignition.lat, ignition.lon, 2.235));
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    halo.userData.baseScale = 1.1;
    group.add(halo);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + ignition.intensity * 0.05, 18, 18),
      new THREE.MeshBasicMaterial({
        color: ignition.live ? 0xfff2a8 : 0xff8a3d,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.position.copy(latLonToVector3(ignition.lat, ignition.lon, 2.24));
    marker.userData.baseScale = 1.2;
    group.add(marker);
  });
}

function createSeismicRings(THREE, group, lat, lon, accent) {
  const normal = latLonToVector3(lat, lon, 1).normalize();
  const origin = latLonToVector3(lat, lon, 2.18);
  for (let i = 0; i < 7; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1 + i * 0.075, 0.106 + i * 0.075, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(accent),
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.copy(origin);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(ring);
  }
}

function createFloodField(THREE, group, lat, lon) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x36b8ff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 5; i += 1) {
    const normal = latLonToVector3(lat + i * 0.35, lon - i * 0.3, 1).normalize();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18 + i * 0.1, 84), material.clone());
    disc.position.copy(latLonToVector3(lat + i * 0.45, lon - i * 0.38, 2.112));
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(disc);
  }
}

function createSmokePlume(THREE, group, lat, lon) {
  for (let i = 0; i < 34; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.055, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xb7c7c9,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
      }),
    );
    const origin = latLonToVector3(lat + i * 0.11, lon - i * 0.25, 2.18 + i * 0.002);
    puff.position.copy(origin);
    puff.userData.origin = origin.clone();
    puff.userData.drift = latLonToVector3(lat + 1.4, lon - 2.8, 1).normalize().multiplyScalar(0.9);
    group.add(puff);
  }
}

function createOperationalSmokePlume(THREE, group, model) {
  const plumeLineMaterial = new THREE.LineBasicMaterial({
    color: 0xd4dad6,
    transparent: true,
    opacity: 0.22,
  });
  const axisPoints = model.smoke.particles
    .filter((_, index) => index % 12 === 0)
    .slice(0, 18)
    .map((particle) => latLonToVector3(particle.lat, particle.lon, 2.245));
  if (axisPoints.length > 2) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(axisPoints), plumeLineMaterial));
  }

  model.smoke.particles.slice(0, 120).forEach((particle) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + particle.concentration * 0.06, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xc7d0cb,
        transparent: true,
        opacity: 0.1 + particle.concentration * 0.2,
        blending: THREE.AdditiveBlending,
      }),
    );
    const origin = latLonToVector3(particle.lat, particle.lon, 2.2 + particle.concentration * 0.04);
    puff.position.copy(origin);
    puff.userData.origin = origin.clone();
    puff.userData.drift = latLonToVector3(
      particle.lat + Math.cos((model.wind.directionDeg * Math.PI) / 180),
      particle.lon + Math.sin((model.wind.directionDeg * Math.PI) / 180),
      1,
    )
      .normalize()
      .multiplyScalar(0.55 + model.wind.speedMph / 80);
    group.add(puff);
  });
}

function createInfrastructure(THREE, group, lat, lon, accent) {
  const roadMaterial = new THREE.LineBasicMaterial({
    color: 0xeef7ff,
    transparent: true,
    opacity: 0.42,
  });
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent),
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
  });
  for (let i = -4; i <= 4; i += 1) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      latLonToVector3(lat - 3.3, lon + i * 0.68, 2.2),
      latLonToVector3(lat + 3.3, lon + i * 0.68, 2.2),
    ]), roadMaterial));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      latLonToVector3(lat + i * 0.6, lon - 3.3, 2.2),
      latLonToVector3(lat + i * 0.6, lon + 3.3, 2.2),
    ]), roadMaterial.clone()));
  }
  for (let i = 0; i < 16; i += 1) {
    const node = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), nodeMaterial);
    node.position.copy(latLonToVector3(lat + (Math.random() - 0.5) * 5.8, lon + (Math.random() - 0.5) * 5.8, 2.24));
    group.add(node);
  }
}

function createSelectedRegionMarker(THREE, group, scenario) {
  const [lat, lon] = scenario.location;
  const normal = latLonToVector3(lat, lon, 1).normalize();
  const position = latLonToVector3(lat, lon, 2.31);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(scenario.accent),
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.105, 72), ringMaterial);
  ring.position.copy(position);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  group.add(ring);

  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.044, 18, 18),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(scenario.accent),
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
    }),
  );
  pin.position.copy(latLonToVector3(lat, lon, 2.36));
  group.add(pin);

  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createLabelTexture(THREE, `${scenario.label}: ${scenario.region}`),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  label.position.copy(latLonToVector3(lat + 2.2, lon + 2.4, 2.58));
  label.scale.set(0.95, 0.23, 1);
  group.add(label);
}

function createLabelTexture(THREE, text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(4, 14, 24, 0.78)";
  roundRect(ctx, 14, 22, 484, 72, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(144, 218, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#eef7ff";
  ctx.font = "700 31px Segoe UI, Inter, sans-serif";
  ctx.fillText(text, 34, 69);
  return new THREE.CanvasTexture(canvas);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function createLiveEventMarker(THREE, group, event) {
  const color = { quake: 0xffd166, weather: 0x54d8ff, flood: 0x36b8ff }[event.kind] ?? 0xffffff;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.03 + event.severity * 0.07, 20, 20),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    }),
  );
  marker.position.copy(latLonToVector3(event.lat, event.lon, 2.27));
  marker.userData.isLiveMarker = true;
  group.add(marker);
  if (event.kind === "quake") {
    createSeismicRings(THREE, group, event.lat, event.lon, "#ffd166");
  }
}

function createStars(THREE) {
  const vertices = [];
  for (let i = 0; i < 2400; i += 1) {
    const radius = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    vertices.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xb8dfff, size: 0.026, opacity: 0.58, transparent: true }),
  );
}

function createSunGlow(THREE) {
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.set(-5.6, 2.2, -3.6);
  return glow;
}

function createCityLights(THREE) {
  const vertices = [];
  const clusters = [
    [40.7, -74], [34.0, -118.2], [29.7, -95.3], [51.5, -0.1], [48.8, 2.3],
    [35.7, 139.7], [19.4, -99.1], [28.6, 77.2], [31.2, 121.5], [-23.5, -46.6],
  ];
  clusters.forEach(([lat, lon]) => {
    for (let i = 0; i < 42; i += 1) {
      vertices.push(...latLonToVector3(lat + (Math.random() - 0.5) * 5, lon + (Math.random() - 0.5) * 7, 2.032).toArray());
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffdf85,
      size: 0.018,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function loadPremiumEarthTextures(THREE, globe, clouds, cityLights) {
  ui.earthTextureStatus.textContent = "Loading";
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const textureBase = "https://threejs.org/examples/textures/planets/";
  const assets = {
    earth: `${textureBase}earth_atmos_2048.jpg`,
    bump: `${textureBase}earth_bump_2048.jpg`,
    specular: `${textureBase}earth_specular_2048.jpg`,
    clouds: `${textureBase}earth_clouds_1024.png`,
    lights: `${textureBase}earth_lights_2048.png`,
  };

  Promise.allSettled(Object.entries(assets).map(([key, url]) => loadTexture(loader, url).then((texture) => [key, texture])))
    .then((results) => {
      const loaded = Object.fromEntries(
        results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value),
      );

      if (loaded.earth) {
        loaded.earth.colorSpace = THREE.SRGBColorSpace;
        globe.material.map = loaded.earth;
      }
      if (loaded.bump) {
        globe.material.bumpMap = loaded.bump;
        globe.material.bumpScale = 0.035;
      }
      if (loaded.specular) {
        globe.material.roughnessMap = loaded.specular;
        globe.material.roughness = 0.66;
      }
      globe.material.needsUpdate = true;

      if (loaded.clouds) {
        clouds.material.map = loaded.clouds;
        clouds.material.opacity = 0.28;
        clouds.material.needsUpdate = true;
      }
      if (loaded.lights) {
        loaded.lights.colorSpace = THREE.SRGBColorSpace;
        cityLights.material.map = loaded.lights;
        cityLights.material.size = 0.018;
        cityLights.material.needsUpdate = true;
      }

      const count = Object.keys(loaded).length;
      ui.earthTextureStatus.textContent = count >= 3 ? "Premium" : "Fallback";
    })
    .catch(() => {
      ui.earthTextureStatus.textContent = "Fallback";
    });
}

function loadTexture(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function createEarthTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#0b2440");
  ocean.addColorStop(0.28, "#0b4e78");
  ocean.addColorStop(0.52, "#126b94");
  ocean.addColorStop(0.72, "#0b4e78");
  ocean.addColorStop(1, "#071b35");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBathymetry(ctx, canvas);
  drawContinentSet(ctx, canvas, true);
  drawPolarIce(ctx, canvas);
  drawSubtleCloudShadows(ctx, canvas);
  return new THREE.CanvasTexture(canvas);
}

function drawBathymetry(ctx, canvas) {
  ctx.save();
  for (let i = 0; i < 90; i += 1) {
    const y = (i / 90) * canvas.height;
    ctx.strokeStyle = `rgba(125, 205, 235, ${0.018 + Math.sin(i * 0.37) * 0.008})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 48) {
      const wave = Math.sin(x * 0.006 + i * 0.4) * 8 + Math.cos(x * 0.011 + i) * 5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawContinentSet(ctx, canvas, filled) {
  continentPolygons().forEach((polygon, index) => {
    const points = polygon.map(([lon, lat]) => lonLatToCanvas(lon, lat, canvas));
    ctx.beginPath();
    points.forEach((point, pointIndex) => {
      if (pointIndex === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();

    if (filled) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, index % 2 ? "#315f3f" : "#486f3e");
      gradient.addColorStop(0.55, index % 2 ? "#7c7650" : "#5c7c4a");
      gradient.addColorStop(1, "#b99b63");
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(230, 240, 215, 0.28)";
      ctx.lineWidth = 2.1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(202, 244, 255, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
}

function drawPolarIce(ctx, canvas) {
  const north = ctx.createLinearGradient(0, 0, 0, 120);
  north.addColorStop(0, "rgba(247,252,255,0.9)");
  north.addColorStop(1, "rgba(247,252,255,0)");
  ctx.fillStyle = north;
  ctx.fillRect(0, 0, canvas.width, 125);

  const south = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
  south.addColorStop(0, "rgba(247,252,255,0)");
  south.addColorStop(1, "rgba(247,252,255,0.95)");
  ctx.fillStyle = south;
  ctx.fillRect(0, canvas.height - 155, canvas.width, 155);
}

function drawSubtleCloudShadows(ctx, canvas) {
  for (let i = 0; i < 180; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 16 + Math.random() * 58;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createBumpTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#777";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.16})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  return new THREE.CanvasTexture(canvas);
}

function createCoastlineOverlay(THREE) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0xbdefff,
    transparent: true,
    opacity: 0.32,
  });
  continentPolygons().forEach((polygon) => {
    const points = polygon.map(([lon, lat]) => latLonToVector3(lat, lon, 2.031));
    points.push(points[0].clone());
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material.clone()));
  });
  return group;
}

function createSurfaceModeOverlay(THREE, color, opacity) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(2.026, 128, 128),
    new THREE.MeshBasicMaterial({
      map: createSurfaceModeTexture(THREE, color),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

function createSurfaceModeTexture(THREE, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      const value = (Math.sin(x * 0.018) + Math.cos(y * 0.025) + Math.sin((x + y) * 0.011)) / 3;
      ctx.fillStyle = value > 0.05 ? `${hex}55` : `${hex}18`;
      ctx.fillRect(x, y, 8, 8);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function createCloudTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 420; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 8 + Math.random() * 42;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.48)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function continentPolygons() {
  return [
    // North America
    [
      [-168, 72], [-142, 70], [-124, 58], [-117, 49], [-101, 52], [-84, 48], [-60, 52],
      [-53, 45], [-70, 31], [-82, 26], [-97, 18], [-112, 24], [-124, 32], [-130, 46],
      [-150, 58],
    ],
    // South America
    [
      [-82, 12], [-68, 9], [-52, -6], [-38, -17], [-44, -32], [-55, -54], [-68, -52],
      [-74, -35], [-80, -12],
    ],
    // Europe and Asia
    [
      [-10, 36], [4, 54], [31, 60], [60, 58], [88, 66], [132, 55], [158, 48], [148, 30],
      [122, 20], [104, 8], [78, 7], [68, 23], [46, 28], [31, 37], [13, 43],
    ],
    // Africa
    [
      [-18, 34], [7, 37], [31, 31], [42, 10], [38, -19], [27, -35], [13, -35], [0, -24],
      [-12, -4], [-16, 18],
    ],
    // Australia
    [
      [112, -11], [132, -10], [153, -25], [146, -39], [126, -36], [113, -25],
    ],
    // Greenland
    [
      [-53, 60], [-32, 67], [-25, 78], [-48, 84], [-69, 78], [-72, 66],
    ],
    // Antarctica
    [
      [-180, -70], [-120, -74], [-60, -68], [0, -76], [60, -69], [120, -73], [180, -70],
      [180, -90], [-180, -90],
    ],
  ];
}

function lonLatToCanvas(lon, lat, canvas) {
  return {
    x: ((lon + 180) / 360) * canvas.width,
    y: ((90 - lat) / 180) * canvas.height,
  };
}

function makeLatitude(THREE, lat, material) {
  const points = [];
  for (let lon = -180; lon <= 180; lon += 3) points.push(latLonToVector3(lat, lon, 2.02));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function makeMeridian(THREE, material) {
  const points = [];
  for (let lat = -90; lat <= 90; lat += 3) points.push(latLonToVector3(lat, 0, 2.02));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material.clone());
}

function createPhysicsField(canvas) {
  const ctx = canvas.getContext("2d");
  const width = 112;
  const height = 64;
  let current = new Float32Array(width * height);
  let next = new Float32Array(width * height);
  let scenario = scenarios.hurricane;
  let wildfire = null;
  let tick = 0;
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenContext = offscreen.getContext("2d");

  function setScenario(nextScenario) {
    scenario = nextScenario;
    wildfire = null;
    current.fill(0);
    seed();
  }

  function setWildfireModel(model) {
    scenario = scenarios.wildfire;
    wildfire = model;
    current.fill(0);
    seed();
  }

  function seed() {
    const seeds = wildfire
      ? wildfire.ignitions.map((ignition) => {
          const dx = (ignition.lon - wildfire.center.lon) * 2.2;
          const dy = (ignition.lat - wildfire.center.lat) * -2.2;
          return {
            x: Math.floor(width * (0.38 + dx)),
            y: Math.floor(height * (0.5 + dy)),
            source: ignition.intensity,
          };
        })
      : [{ x: Math.floor(width * 0.38), y: Math.floor(height * 0.5), source: scenario.field.source }];

    seeds.forEach((seedPoint) => {
      for (let y = -6; y <= 6; y += 1) {
        for (let x = -6; x <= 6; x += 1) {
          const px = clamp(seedPoint.x + x, 1, width - 2);
          const py = clamp(seedPoint.y + y, 1, height - 2);
          const dist = Math.sqrt(x * x + y * y);
          if (dist < 6) current[py * width + px] = seedPoint.source * (1 - dist / 7);
        }
      }
    });
  }

  function step() {
    tick += 1;
    const params = wildfire
      ? {
          source: Math.max(0.35, wildfire.fuelDryness),
          advectionX: Math.sin((wildfire.wind.directionDeg * Math.PI) / 180) * (0.4 + wildfire.wind.speedMph / 38),
          advectionY: -Math.cos((wildfire.wind.directionDeg * Math.PI) / 180) * (0.4 + wildfire.wind.speedMph / 38),
          diffusion: wildfire.smoke.diffusion * 0.11,
          swirl: wildfire.slope.alignment * 0.35,
        }
      : scenario.field;

    if (wildfire) {
      wildfire.ignitions.slice(0, 5).forEach((ignition, index) => {
        const sx = Math.floor(width * (0.38 + (ignition.lon - wildfire.center.lon) * 2.2));
        const sy = Math.floor(height * (0.5 - (ignition.lat - wildfire.center.lat) * 2.2));
        const safeX = clamp(sx, 1, width - 2);
        const safeY = clamp(sy, 1, height - 2);
        current[safeY * width + safeX] = Math.min(1, current[safeY * width + safeX] + ignition.intensity * 0.11 + index * 0.005);
      });
    } else {
      const sx = Math.floor(width * (0.28 + Math.sin(tick * 0.025) * 0.04));
      const sy = Math.floor(height * (0.5 + Math.cos(tick * 0.018) * 0.09));
      current[sy * width + sx] = Math.min(1, current[sy * width + sx] + params.source * 0.18);
    }

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        const lap = current[i - 1] + current[i + 1] + current[i - width] + current[i + width] - current[i] * 4;
        const advX = params.advectionX * (current[i] - current[i - 1]);
        const advY = params.advectionY * (current[i] - current[i - width]);
        const curl = Math.sin((x - y + tick) * 0.04) * params.swirl * 0.004;
        next[i] = clamp(current[i] + params.diffusion * lap - 0.035 * advX - 0.035 * advY + curl, 0, 1) * 0.992;
      }
    }
    [current, next] = [next, current];
  }

  function draw() {
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < current.length; i += 1) {
      const value = current[i];
      const p = i * 4;
      if (wildfire) {
        image.data[p] = Math.round(34 + value * 221);
        image.data[p + 1] = Math.round(44 + Math.sin(value * Math.PI) * 128 + value * 54);
        image.data[p + 2] = Math.round(58 + (1 - value) * 126);
      } else {
        image.data[p] = Math.round(20 + value * 245);
        image.data[p + 1] = Math.round(80 + Math.sin(value * Math.PI) * 160);
        image.data[p + 2] = Math.round(120 + (1 - value) * 120);
      }
      image.data[p + 3] = 255;
    }
    offscreenContext.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = wildfire ? "rgba(255,216,145,0.42)" : "rgba(166,243,255,0.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin((tick + x) * 0.02) * 16, canvas.height);
      ctx.stroke();
    }
    if (wildfire) {
      ctx.fillStyle = "rgba(255, 245, 210, 0.88)";
      wildfire.ignitions.slice(0, 5).forEach((ignition) => {
        const x = canvas.width * (0.38 + (ignition.lon - wildfire.center.lon) * 2.2);
        const y = canvas.height * (0.5 - (ignition.lat - wildfire.center.lat) * 2.2);
        ctx.beginPath();
        ctx.arc(x, y, 4 + ignition.intensity * 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function loop() {
    for (let i = 0; i < 3; i += 1) step();
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    seed();
    loop();
  }

  return { start, setScenario, setWildfireModel };
}

function rotationForLatLon(lat, lon) {
  return {
    x: (lat * 0.62 * Math.PI) / 180,
    y: (lon * Math.PI) / 180,
    z: 0,
  };
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE_NS.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  }
}

function isKnownLandCluster(lat, lon) {
  const clusters = [
    [39, -98, 35, 52],
    [-15, -55, 28, 42],
    [2, 20, 38, 45],
    [50, 70, 36, 84],
    [23, 78, 28, 34],
    [-25, 135, 24, 35],
    [36, 138, 18, 20],
    [51, 10, 22, 32],
  ];
  return clusters.some(([clat, clon, latRange, lonRange]) => {
    return Math.abs(lat - clat) < latRange / 2 && Math.abs(lon - clon) < lonRange / 2;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

boot();
