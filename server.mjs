import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? process.argv[2] ?? 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/wildfire") {
      const payload = await getWildfirePayload(url.searchParams);
      sendJson(response, 200, payload);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message ?? "Internal server error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`GaiaScope server running at http://127.0.0.1:${port}`);
  if (!process.env.FIRMS_MAP_KEY) {
    console.log("FIRMS_MAP_KEY not set; wildfire proxy will use synthetic ignition fallback.");
  }
});

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

async function getWildfirePayload(params) {
  const lat = Number(params.get("lat") ?? 39.2);
  const lon = Number(params.get("lon") ?? -121.1);
  const bbox = params.get("bbox") ?? "-124.8,32.2,-114.0,42.2";

  const [weather, nws, firms] = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchNwsContext(lat, lon),
    fetchFirms(bbox),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    location: { lat, lon, bbox },
    weather: settle("Open-Meteo weather", weather),
    nws: settle("NWS alerts/forecast", nws),
    firms: settle("NASA FIRMS active fires", firms),
  };
}

async function fetchOpenMeteo(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  );
  url.searchParams.set(
    "hourly",
    "relative_humidity_2m,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm",
  );
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("forecast_hours", "12");

  const payload = await fetchJson(url);
  return {
    status: "live",
    source: "Open-Meteo",
    current: payload.current,
    hourly: payload.hourly,
    units: payload.current_units,
  };
}

async function fetchNwsContext(lat, lon) {
  const headers = {
    "user-agent": "GaiaScope wildfire prototype (local development)",
    accept: "application/geo+json, application/json",
  };
  const point = await fetchJson(`https://api.weather.gov/points/${lat},${lon}`, headers);
  const forecastUrl = point.properties?.forecastHourly;
  const alertsUrl = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  const [forecast, alerts] = await Promise.allSettled([
    forecastUrl ? fetchJson(forecastUrl, headers) : Promise.resolve(null),
    fetchJson(alertsUrl, headers),
  ]);

  return {
    status: "live",
    source: "NWS",
    office: point.properties?.gridId,
    forecast: forecast.status === "fulfilled" ? forecast.value : null,
    alerts: alerts.status === "fulfilled" ? alerts.value : null,
  };
}

async function fetchFirms(bbox) {
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    return {
      status: "missing_key",
      source: "NASA FIRMS",
      fires: syntheticFires(),
      note: "Set FIRMS_MAP_KEY to use live NASA FIRMS detections.",
    };
  }

  const source = process.env.FIRMS_SOURCE ?? "VIIRS_SNPP_NRT";
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${bbox}/1`;
  const csv = await fetchText(url);
  return {
    status: "live",
    source: `NASA FIRMS ${source}`,
    fires: parseFirmsCsv(csv),
  };
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseFirmsCsv(csv) {
  const [headerLine, ...rows] = csv.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split(",");
  return rows
    .map((row) => Object.fromEntries(row.split(",").map((value, index) => [headers[index], value])))
    .filter((row) => row.latitude && row.longitude)
    .map((row) => ({
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      brightness: Number(row.bright_ti4 ?? row.brightness ?? 320),
      frp: Number(row.frp ?? 8),
      confidence: row.confidence ?? "nominal",
      dayNight: row.daynight,
      acquired: `${row.acq_date ?? ""} ${row.acq_time ?? ""}`.trim(),
    }));
}

function syntheticFires() {
  return [
    { lat: 39.19, lon: -121.08, brightness: 340, frp: 18, confidence: "estimated", acquired: "fallback" },
    { lat: 39.36, lon: -120.88, brightness: 326, frp: 9, confidence: "estimated", acquired: "fallback" },
    { lat: 38.98, lon: -121.32, brightness: 318, frp: 5, confidence: "estimated", acquired: "fallback" },
  ];
}

function settle(label, result) {
  if (result.status === "fulfilled") {
    return result.value;
  }
  return {
    status: "error",
    source: label,
    error: result.reason?.message ?? "Unavailable",
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(payload));
}
