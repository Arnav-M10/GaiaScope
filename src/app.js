import { fetchLiveData, plannedSources } from "./live-data.js";

const scenarios = {
  hurricane: {
    label: "Hurricane",
    region: "Florida coast",
    accent: "#54d8ff",
    location: [27.7, -81.7],
    camera: { lat: 24, lon: -72, zoom: 4.7 },
    score: 82,
    telemetry: ["64 kt", "82%", "1.8M", "+/-14%"],
    equations: [
      "du/dt = -grad(p)/rho + nu laplacian(u) + Coriolis",
      "surge = tide + wind stress + pressure setup",
      "risk = P(flood) x exposure x criticality",
    ],
    explanations: [
      "Cyclonic wind vectors are tightening around a low-pressure core east of the coast.",
      "Storm surge rises where onshore wind stress aligns with shallow coastal bathymetry.",
      "Hospitals, substations, and evacuation roads sit inside the six-hour flood envelope.",
    ],
  },
  wildfire: {
    label: "Wildfire",
    region: "Northern California",
    accent: "#ff8a3d",
    location: [39.2, -121.1],
    camera: { lat: 37, lon: -115, zoom: 4.4 },
    score: 76,
    telemetry: ["28 mph", "18%", "420k", "+/-19%"],
    equations: [
      "spread = R0 x wind_factor x slope_factor x fuel_dryness",
      "dT/dt = alpha laplacian(T) + combustion - cooling",
      "dC/dt + u dot grad(C) = D laplacian(C) + source",
    ],
    explanations: [
      "Active thermal detections are clustered along dry fuel with low overnight humidity.",
      "Terrain slope and wind advection bias the spread cone toward nearby communities.",
      "Smoke concentration increases downwind as particles diffuse through the valley.",
    ],
  },
  earthquake: {
    label: "Earthquake",
    region: "Japan trench",
    accent: "#ffd166",
    location: [38.3, 142.4],
    camera: { lat: 36, lon: 140, zoom: 4.35 },
    score: 88,
    telemetry: ["M7.1", "0.32g", "6.4M", "+/-11%"],
    equations: [
      "energy = 10^(1.5M + 4.8)",
      "I(r) = I0 exp(-k r) / sqrt(r)",
      "risk = shaking x vulnerability x population_density",
    ],
    explanations: [
      "The epicenter releases high seismic energy near dense coastal infrastructure.",
      "Modeled wavefronts attenuate inland but remain strong across several urban corridors.",
      "Coastal exposure is elevated enough to keep tsunami screening active.",
    ],
  },
  heatwave: {
    label: "Heatwave",
    region: "Dallas metro",
    accent: "#ff5f6d",
    location: [32.8, -96.8],
    camera: { lat: 31, lon: -93, zoom: 4.6 },
    score: 69,
    telemetry: ["109 F", "41%", "2.2M", "+/-16%"],
    equations: [
      "dT/dt = k laplacian(T) + solar_gain - evap_cooling",
      "AQI = f(PM2.5, O3, NO2, boundary_layer)",
      "risk = heat_index x vulnerability / cooling_access",
    ],
    explanations: [
      "Urban heat islands intensify where impervious cover and building density are high.",
      "Low tree cover limits evaporative cooling across several vulnerable census zones.",
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
};

const ui = {
  canvas: document.querySelector("#earth-canvas"),
  fallback: document.querySelector("#fallback"),
  scenarioList: document.querySelector("#scenarioList"),
  scenarioRegion: document.querySelector("#scenarioRegion"),
  riskScore: document.querySelector("#riskScore"),
  riskMeter: document.querySelector("#riskMeter"),
  explainList: document.querySelector("#explainList"),
  equationStack: document.querySelector("#equationStack"),
  horizon: document.querySelector("#timeHorizon"),
  horizonValue: document.querySelector("#horizonValue"),
  telemetry: [
    document.querySelector("#windTelemetry"),
    document.querySelector("#moistureTelemetry"),
    document.querySelector("#exposureTelemetry"),
    document.querySelector("#uncertaintyTelemetry"),
  ],
  feedStatus: document.querySelector("#feedStatus"),
  liveEventList: document.querySelector("#liveEventList"),
  refreshFeeds: document.querySelector("#refreshFeeds"),
};

let activeScenario = "hurricane";
let engine;
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
  });
});

ui.horizon.addEventListener("input", () => {
  ui.horizonValue.textContent = `${ui.horizon.value}h`;
  renderScenario();
});

ui.refreshFeeds.addEventListener("click", () => {
  refreshLiveFeeds();
});

async function boot() {
  try {
    const THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js"
    );
    THREE_NS = THREE;
    engine = createEarthEngine(THREE, ui.canvas);
    setScenario(activeScenario);
    engine.animate();
    refreshLiveFeeds();
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
    renderFeedStatus(liveData);
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

function renderFeedStatus(liveData) {
  if (liveData.loading) {
    ui.feedStatus.innerHTML = `<div class="feed-row"><span>Fetching live sources</span><strong>...</strong></div>`;
    ui.liveEventList.innerHTML = `<li>Contacting USGS, NWS, and NOAA CO-OPS.</li>`;
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
    .slice(0, 5)
    .map((event) => `<li>
      <b>${escapeHtml(event.title)}</b>
      <span>${escapeHtml(event.source)} - ${escapeHtml(event.detail)}</span>
    </li>`)
    .join("");

  ui.liveEventList.innerHTML = events || `<li>No live events returned yet.</li>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setScenario(key) {
  activeScenario = key;
  renderScenario();
  engine?.focusScenario(scenarios[key], enabledLayers);
}

function renderScenario() {
  const scenario = scenarios[activeScenario];
  const horizonFactor = Number(ui.horizon.value) / 24;
  const score = Math.min(96, Math.round(scenario.score + horizonFactor * 8));

  ui.scenarioRegion.textContent = scenario.region;
  ui.riskScore.textContent = score;
  ui.riskMeter.style.width = `${score}%`;

  ui.explainList.replaceChildren(
    ...scenario.explanations.map((text) => {
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

  scenario.telemetry.forEach((value, index) => {
    ui.telemetry[index].textContent = value;
  });

  document.querySelectorAll(".scenario-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scenario === activeScenario);
  });
}

function createEarthEngine(THREE, canvas) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03070d, 0.045);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.35, 7.4);

  const root = new THREE.Group();
  scene.add(root);

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(2, 96, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0a2a3f,
      roughness: 0.9,
      metalness: 0.05,
      emissive: 0x031829,
    }),
  );
  root.add(globe);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.035, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x54d8ff,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    }),
  );
  root.add(atmosphere);

  root.add(createGrid(THREE));
  root.add(createProceduralContinents(THREE));

  const stars = createStars(THREE);
  scene.add(stars);

  const hazardRoot = new THREE.Group();
  root.add(hazardRoot);

  const layers = {
    weather: new THREE.Group(),
    fire: new THREE.Group(),
    quake: new THREE.Group(),
    flood: new THREE.Group(),
    pollution: new THREE.Group(),
    infrastructure: new THREE.Group(),
    live: new THREE.Group(),
  };

  Object.values(layers).forEach((layer) => hazardRoot.add(layer));

  const lights = [
    new THREE.AmbientLight(0x86b8ff, 0.65),
    new THREE.DirectionalLight(0xffffff, 2.2),
    new THREE.PointLight(0x54d8ff, 34, 12),
  ];
  lights[1].position.set(-3, 4, 5);
  lights[2].position.set(2, 0, 2);
  lights.forEach((light) => scene.add(light));

  let targetRotation = new THREE.Euler(0, 0, 0);
  let currentScenario = scenarios.hurricane;
  const clock = new THREE.Clock();

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function focusScenario(scenario, visibility) {
    currentScenario = scenario;
    targetRotation = rotationForLatLon(scenario.camera.lat, scenario.camera.lon);
    camera.position.z = scenario.camera.zoom;
    rebuildHazards(scenario);
    setLayerVisibility(visibility);
  }

  function rebuildHazards(scenario) {
    ["weather", "fire", "quake", "flood", "pollution", "infrastructure"].forEach((key) => {
      clearGroup(layers[key]);
    });
    const [lat, lon] = scenario.location;

    createWindField(THREE, layers.weather, lat, lon, scenario.accent);
    createFireField(THREE, layers.fire, lat, lon);
    createSeismicRings(THREE, layers.quake, lat, lon, scenario.accent);
    createFloodField(THREE, layers.flood, lat, lon);
    createSmokePlume(THREE, layers.pollution, lat, lon);
    createInfrastructure(THREE, layers.infrastructure, lat, lon);
  }

  function setLayerVisibility(visibility) {
    Object.entries(visibility).forEach(([key, value]) => {
      if (layers[key]) {
        layers[key].visible = value;
      }
    });
  }

  function setLiveEvents(events) {
    clearGroup(layers.live);
    events.slice(0, 60).forEach((event) => {
      createLiveEventMarker(THREE, layers.live, event);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    root.rotation.x += (targetRotation.x - root.rotation.x) * 0.035;
    root.rotation.y += (targetRotation.y - root.rotation.y) * 0.035;
    root.rotation.z = Math.sin(elapsed * 0.08) * 0.025;
    globe.rotation.y += 0.0008;
    stars.rotation.y -= 0.0004;

    layers.weather.children.forEach((item, index) => {
      item.rotation.z += 0.01 + index * 0.0008;
      item.material.opacity = 0.28 + Math.sin(elapsed * 2 + index) * 0.12;
    });

    layers.fire.children.forEach((item, index) => {
      const flicker = 1 + Math.sin(elapsed * 5 + index) * 0.22;
      item.scale.setScalar(item.userData.baseScale * flicker);
    });

    layers.quake.children.forEach((ring, index) => {
      const wave = ((elapsed * 0.34 + index * 0.22) % 1) + 0.3;
      ring.scale.setScalar(wave);
      ring.material.opacity = Math.max(0, 0.55 - wave * 0.38);
    });

    layers.pollution.children.forEach((puff, index) => {
      puff.position.addScaledVector(puff.userData.drift, 0.006);
      puff.material.opacity = 0.12 + Math.sin(elapsed + index) * 0.04;
      if (puff.position.length() > 2.42) {
        puff.position.copy(puff.userData.origin);
      }
    });

    layers.live.children.forEach((item, index) => {
      if (item.userData.isLiveMarker) {
        const pulse = 1 + Math.sin(elapsed * 3 + index) * 0.18;
        item.scale.setScalar(pulse);
      }
    });

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  resize();

  return { animate, focusScenario, setLayerVisibility, setLiveEvents };
}

function createGrid(THREE) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x497d9f,
    transparent: true,
    opacity: 0.18,
  });

  for (let lat = -60; lat <= 60; lat += 30) {
    group.add(makeLatitude(THREE, lat, material));
  }
  for (let lon = 0; lon < 180; lon += 15) {
    const meridian = makeMeridian(THREE, material);
    meridian.rotation.y = THREE.MathUtils.degToRad(lon);
    group.add(meridian);
  }
  return group;
}

function createProceduralContinents(THREE) {
  const group = new THREE.Group();
  const material = new THREE.PointsMaterial({
    size: 0.014,
    color: 0x5fd094,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const vertices = [];

  for (let i = 0; i < 2600; i += 1) {
    const lat = -58 + Math.random() * 126;
    const lon = -180 + Math.random() * 360;
    const landScore =
      Math.sin((lon + 24) * 0.045) +
      Math.cos((lat - 12) * 0.08) +
      Math.sin((lat + lon) * 0.035);
    if (landScore > 0.64 || isKnownLandCluster(lat, lon)) {
      vertices.push(...latLonToVector3(lat, lon, 2.012).toArray());
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  group.add(new THREE.Points(geometry, material));
  return group;
}

function createStars(THREE) {
  const vertices = [];
  for (let i = 0; i < 1600; i += 1) {
    const radius = 18 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    vertices.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xb8dfff, size: 0.028, opacity: 0.5, transparent: true }),
  );
}

function createWindField(THREE, group, lat, lon, accent) {
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(accent),
    transparent: true,
    opacity: 0.38,
  });
  for (let i = 0; i < 34; i += 1) {
    const radius = 0.14 + i * 0.012;
    const points = [];
    for (let t = 0; t < 60; t += 1) {
      const angle = t / 7 + i * 0.44;
      const localLat = lat + Math.sin(angle) * radius * 11;
      const localLon = lon + Math.cos(angle) * radius * 15;
      points.push(latLonToVector3(localLat, localLon, 2.08 + i * 0.0008));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90));
    group.add(new THREE.Line(geometry, material.clone()));
  }
}

function createFireField(THREE, group, lat, lon) {
  const colors = [0xff4d2e, 0xff9f1c, 0xffd166];
  for (let i = 0; i < 22; i += 1) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.026 + Math.random() * 0.025, 16, 16),
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
      }),
    );
    spot.position.copy(
      latLonToVector3(
        lat + (Math.random() - 0.5) * 5.2,
        lon + (Math.random() - 0.5) * 6.6,
        2.13,
      ),
    );
    spot.userData.baseScale = 0.75 + Math.random() * 1.8;
    group.add(spot);
  }
}

function createSeismicRings(THREE, group, lat, lon, accent) {
  const normal = latLonToVector3(lat, lon, 1).normalize();
  const origin = latLonToVector3(lat, lon, 2.16);
  for (let i = 0; i < 5; i += 1) {
    const geometry = new THREE.RingGeometry(0.14 + i * 0.08, 0.148 + i * 0.08, 96);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(origin);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(ring);
  }
}

function createFloodField(THREE, group, lat, lon) {
  const normal = latLonToVector3(lat, lon, 1).normalize();
  const material = new THREE.MeshBasicMaterial({
    color: 0x36b8ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 4; i += 1) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.22 + i * 0.11, 72), material.clone());
    disc.position.copy(latLonToVector3(lat + i * 0.55, lon - i * 0.42, 2.105));
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(disc);
  }
}

function createSmokePlume(THREE, group, lat, lon) {
  for (let i = 0; i < 26; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + Math.random() * 0.05, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xaec5ca,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
      }),
    );
    const origin = latLonToVector3(lat + i * 0.12, lon - i * 0.24, 2.18 + i * 0.002);
    puff.position.copy(origin);
    puff.userData.origin = origin.clone();
    puff.userData.drift = latLonToVector3(lat + 1.2, lon - 2.6, 1).normalize().multiplyScalar(0.9);
    group.add(puff);
  }
}

function createInfrastructure(THREE, group, lat, lon) {
  const material = new THREE.LineBasicMaterial({
    color: 0xeef7ff,
    transparent: true,
    opacity: 0.45,
  });
  for (let i = -3; i <= 3; i += 1) {
    const roadA = [
      latLonToVector3(lat - 3, lon + i * 0.8, 2.19),
      latLonToVector3(lat + 3, lon + i * 0.8, 2.19),
    ];
    const roadB = [
      latLonToVector3(lat + i * 0.7, lon - 3, 2.19),
      latLonToVector3(lat + i * 0.7, lon + 3, 2.19),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(roadA), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(roadB), material.clone()));
  }
}

function createLiveEventMarker(THREE, group, event) {
  const color = {
    quake: 0xffd166,
    weather: 0x54d8ff,
    flood: 0x36b8ff,
  }[event.kind] ?? 0xffffff;
  const radius = 0.035 + event.severity * 0.08;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    }),
  );
  marker.position.copy(latLonToVector3(event.lat, event.lon, 2.25));
  marker.userData.baseScale = 1;
  marker.userData.isLiveMarker = true;
  group.add(marker);

  if (event.kind === "quake") {
    createSeismicRings(THREE, group, event.lat, event.lon, "#ffd166");
  }
}

function makeLatitude(THREE, lat, material) {
  const points = [];
  for (let lon = -180; lon <= 180; lon += 3) {
    points.push(latLonToVector3(lat, lon, 2.018));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function makeMeridian(THREE, material) {
  const points = [];
  for (let lat = -90; lat <= 90; lat += 3) {
    points.push(latLonToVector3(lat, 0, 2.018));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material.clone());
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
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
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
  ];
  return clusters.some(([clat, clon, latRange, lonRange]) => {
    return Math.abs(lat - clat) < latRange / 2 && Math.abs(lon - clon) < lonRange / 2;
  });
}

boot();
