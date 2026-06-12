const SOURCE_CONFIG = [
  {
    id: "usgs",
    label: "USGS earthquakes",
    kind: "quake",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    parser: parseUsgsEarthquakes,
  },
  {
    id: "nws-fl",
    label: "NWS Florida alerts",
    kind: "weather",
    url: "https://api.weather.gov/alerts/active?area=FL",
    parser: (payload) => parseNwsAlerts(payload, "FL"),
  },
  {
    id: "nws-ca",
    label: "NWS California alerts",
    kind: "weather",
    url: "https://api.weather.gov/alerts/active?area=CA",
    parser: (payload) => parseNwsAlerts(payload, "CA"),
  },
  {
    id: "nws-tx",
    label: "NWS Texas alerts",
    kind: "weather",
    url: "https://api.weather.gov/alerts/active?area=TX",
    parser: (payload) => parseNwsAlerts(payload, "TX"),
  },
  {
    id: "noaa-tides",
    label: "NOAA Key West water level",
    kind: "flood",
    url:
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?date=latest&station=8724580&product=water_level&datum=MLLW" +
      "&time_zone=gmt&units=english&format=json",
    parser: parseNoaaWaterLevel,
  },
];

export const plannedSources = [
  "NASA FIRMS active fires: needs a FIRMS MAP_KEY, best proxied by a backend.",
  "OpenAQ pollution: API access and CORS behavior should be handled server-side.",
  "OpenStreetMap infrastructure: Overpass queries need throttling and caching.",
  "Sentinel Hub imagery: requires OAuth/client credentials.",
];

export async function fetchLiveData() {
  const settled = await Promise.allSettled(SOURCE_CONFIG.map(fetchSource));
  const sources = settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      id: SOURCE_CONFIG[index].id,
      label: SOURCE_CONFIG[index].label,
      status: "error",
      count: 0,
      events: [],
      message: result.reason?.message ?? "Feed unavailable",
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    sources,
    events: sources.flatMap((source) => source.events),
  };
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { Accept: "application/geo+json, application/json" },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const events = source.parser(payload).slice(0, 24);

  return {
    id: source.id,
    label: source.label,
    status: "ok",
    count: events.length,
    events,
    message: events.length ? "Live" : "No active events",
    updatedAt: new Date().toISOString(),
  };
}

function parseUsgsEarthquakes(payload) {
  return (payload.features ?? [])
    .filter((feature) => feature.geometry?.type === "Point")
    .map((feature) => {
      const [lon, lat, depth = 0] = feature.geometry.coordinates;
      const mag = Number(feature.properties?.mag ?? 0);
      return {
        id: feature.id,
        kind: "quake",
        title: `M${mag.toFixed(1)} earthquake`,
        detail: feature.properties?.place ?? "Recent earthquake",
        lat,
        lon,
        value: mag,
        severity: clamp(mag / 7, 0.22, 1),
        source: "USGS",
        time: feature.properties?.time,
        depth,
      };
    })
    .sort((a, b) => b.severity - a.severity);
}

function parseNwsAlerts(payload, area) {
  return (payload.features ?? [])
    .map((feature) => {
      const center = centroidFromGeometry(feature.geometry) ?? fallbackCenterForArea(area);
      const severity = severityFromNws(feature.properties?.severity);
      return {
        id: feature.id,
        kind: "weather",
        title: feature.properties?.event ?? "Weather alert",
        detail: feature.properties?.headline ?? feature.properties?.areaDesc ?? area,
        lat: center.lat,
        lon: center.lon,
        value: severity,
        severity,
        source: `NWS ${area}`,
        time: feature.properties?.sent,
      };
    })
    .sort((a, b) => b.severity - a.severity);
}

function parseNoaaWaterLevel(payload) {
  const latest = payload.data?.at(-1);
  if (!latest) {
    return [];
  }

  const level = Number(latest.v);
  return [
    {
      id: `noaa-key-west-${latest.t}`,
      kind: "flood",
      title: `${level.toFixed(2)} ft water level`,
      detail: "Key West station 8724580, datum MLLW",
      lat: 24.5551,
      lon: -81.8079,
      value: level,
      severity: clamp(Math.abs(level) / 3, 0.18, 0.82),
      source: "NOAA CO-OPS",
      time: latest.t,
    },
  ];
}

function centroidFromGeometry(geometry) {
  if (!geometry) {
    return null;
  }

  const points = [];
  collectCoordinates(geometry.coordinates, points);
  if (!points.length) {
    return null;
  }

  const sum = points.reduce(
    (acc, point) => {
      acc.lon += point[0];
      acc.lat += point[1];
      return acc;
    },
    { lat: 0, lon: 0 },
  );

  return {
    lat: sum.lat / points.length,
    lon: sum.lon / points.length,
  };
}

function collectCoordinates(node, points) {
  if (!Array.isArray(node)) {
    return;
  }

  if (typeof node[0] === "number" && typeof node[1] === "number") {
    points.push(node);
    return;
  }

  node.forEach((child) => collectCoordinates(child, points));
}

function fallbackCenterForArea(area) {
  const centers = {
    FL: { lat: 27.8, lon: -81.7 },
    CA: { lat: 37.2, lon: -119.7 },
    TX: { lat: 31.2, lon: -99.3 },
  };
  return centers[area] ?? { lat: 39.5, lon: -98.3 };
}

function severityFromNws(severity = "") {
  const normalized = severity.toLowerCase();
  if (normalized === "extreme") return 1;
  if (normalized === "severe") return 0.82;
  if (normalized === "moderate") return 0.56;
  if (normalized === "minor") return 0.32;
  return 0.22;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
