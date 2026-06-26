import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker, useMapContext } from "react-simple-maps";
import { geoContains } from "d3-geo";

type RsmProjection = ((c: [number, number]) => [number, number] | null) & {
  invert?: (p: [number, number]) => [number, number] | null;
};

function ProjectionCapture({ projRef, onReady }: { projRef: React.MutableRefObject<RsmProjection | null>; onReady?: () => void }) {
  const { projection } = useMapContext() as { projection: RsmProjection };
  projRef.current = projection;
  useEffect(() => { onReady?.(); }, [projection, onReady]);
  return null;
}

function seededRand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function burnPath(seed: string, rx: number, ry: number) {
  const rand = seededRand(seed);
  const pts = 40 + Math.floor(rand() * 12);
  // Layered noise for organic, lobed fire perimeter (à la Inciweb)
  const phases = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
  const amps = [0.32, 0.16, 0.08];
  const freqs = [2 + Math.floor(rand() * 3), 5 + Math.floor(rand() * 3), 9 + Math.floor(rand() * 4)];
  const cxOff = (rand() - 0.5) * rx * 0.15;
  const cyOff = (rand() - 0.5) * ry * 0.15;
  const coords: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    let r = 0.85;
    for (let k = 0; k < freqs.length; k++) {
      r += amps[k] * Math.sin(a * freqs[k] + phases[k]);
    }
    r += (rand() - 0.5) * 0.05;
    coords.push([Math.cos(a) * rx * r + cxOff, Math.sin(a) * ry * r + cyOff]);
  }
  // Smooth closed Catmull-Rom via cubic Beziers
  const n = coords.length;
  let d = `M${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = coords[(i - 1 + n) % n];
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    const p3 = coords[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wildfire Map" },
      { name: "description", content: "An interactive world map you can pan, zoom, and draw on." },
      { property: "og:title", content: "Wildfire Map" },
      { property: "og:description", content: "An interactive world map you can pan, zoom, and draw on." },
    ],
  }),
  component: Index,
});

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country names as they appear in world-atlas 110m
const FIRE_PRONE = new Set<string>([
  "United States of America",
  "Canada",
  "Mexico",
  "Brazil",
  "Chile",
  "Argentina",
  "Portugal",
  "Spain",
  "Italy",
  "Greece",
  "Turkey",
  "Russia",
  "Indonesia",
  "Australia",
  "South Africa",
]);

const SEMI_FIRE_PRONE = new Set<string>([
  "France",
  "Croatia",
  "Albania",
  "Algeria",
  "Morocco",
  "Tunisia",
  "Israel",
  "Lebanon",
  "Iran",
  "Kazakhstan",
  "Mongolia",
  "China",
  "India",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Papua New Guinea",
  "New Zealand",
  "Angola",
  "Mozambique",
  "Zambia",
  "Zimbabwe",
  "Namibia",
  "Botswana",
  "Madagascar",
  "Dem. Rep. Congo",
  "Tanzania",
  "Kenya",
  "Ethiopia",
  "Bolivia",
  "Peru",
  "Paraguay",
  "Colombia",
  "Venezuela",
  "Ukraine",
])

const TUVALU_GEO: any = {
  type: "Feature",
  properties: { name: "Tuvalu" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [[[[179.19,-8.54],[179.2,-8.53],[179.2,-8.52],[179.2,-8.51],[179.2,-8.5],[179.2,-8.48],[179.2,-8.46],[179.21,-8.47],[179.21,-8.5],[179.22,-8.51],[179.22,-8.52],[179.21,-8.53],[179.19,-8.54]]]],
      [[[[178.38,-8.07],[178.37,-8.07],[178.38,-8.06],[178.38,-8.04],[178.39,-8.03],[178.38,-8.07]]]],
      [[[[177.15,-7.2],[177.15,-7.19],[177.15,-7.19],[177.15,-7.19],[177.15,-7.19],[177.15,-7.2],[177.15,-7.2]]]],
      [[[[176.31,-6.3],[176.32,-6.29],[176.32,-6.29],[176.32,-6.29],[176.31,-6.3]]]],
      [[[[177.34,-6.12],[177.34,-6.11],[177.34,-6.11],[177.34,-6.11],[177.35,-6.11],[177.36,-6.11],[177.36,-6.12],[177.34,-6.12]]]],
      [[[[176.13,-5.69],[176.13,-5.68],[176.13,-5.68],[176.14,-5.69],[176.15,-5.71],[176.13,-5.69]]]],
      [[[[179.91,-9.4],[179.91,-9.42],[179.91,-9.42],[179.9,-9.4],[179.9,-9.39],[179.9,-9.39],[179.91,-9.4]]]],
      [[[[179.87,-9.34],[179.87,-9.35],[179.88,-9.36],[179.88,-9.36],[179.87,-9.35],[179.87,-9.34]]]],
      [[[[178.68,-7.49],[178.67,-7.46],[178.66,-7.45],[178.69,-7.47],[178.69,-7.48],[178.69,-7.49],[178.69,-7.5],[178.68,-7.49]]]],
    ],
  },
};

const noCampfireSpots: { name: string; coordinates: [number, number]; score: number }[] = [
  // North America
  { name: "Mojave Desert", coordinates: [-115.5, 35.0], score: 96 },
  { name: "Sonoran Desert", coordinates: [-112.5, 32.5], score: 94 },
  { name: "Great Basin", coordinates: [-117.0, 40.0], score: 92 },
  { name: "Chihuahuan Desert", coordinates: [-105.5, 30.5], score: 95 },
  { name: "Interior BC Dry Belt", coordinates: [-120.5, 50.5], score: 88 },
  { name: "Baja Desert", coordinates: [-113.5, 28.0], score: 93 },
  // South America
  { name: "Atacama Desert", coordinates: [-69.5, -23.5], score: 98 },
  { name: "Patagonia Steppe", coordinates: [-69.0, -45.0], score: 85 },
  { name: "Caatinga", coordinates: [-40.0, -9.0], score: 90 },
  { name: "Gran Chaco", coordinates: [-61.0, -23.0], score: 91 },
  // Europe
  { name: "Inland Spain", coordinates: [-3.5, 40.0], score: 89 },
  { name: "Sardinia", coordinates: [9.0, 40.0], score: 87 },
  { name: "Southern Italy", coordinates: [16.0, 40.0], score: 88 },
  { name: "Peloponnese", coordinates: [22.0, 37.3], score: 86 },
  // Africa — Sahara band
  { name: "Western Sahara", coordinates: [-12.0, 24.0], score: 97 },
  { name: "Mauritanian Sahara", coordinates: [-8.0, 22.0], score: 97 },
  { name: "Malian Sahara", coordinates: [0.0, 22.0], score: 96 },
  { name: "Algerian Sahara", coordinates: [3.0, 26.0], score: 97 },
  { name: "Nigerien Sahara", coordinates: [8.0, 20.0], score: 96 },
  { name: "Libyan Desert", coordinates: [18.0, 26.0], score: 98 },
  { name: "Chadian Sahara", coordinates: [18.0, 18.0], score: 97 },
  { name: "Egyptian Desert", coordinates: [28.0, 26.0], score: 98 },
  { name: "Sudanese Desert", coordinates: [30.0, 20.0], score: 96 },
  // Africa — south & horn
  { name: "Namib Desert", coordinates: [14.5, -24.0], score: 95 },
  { name: "Kalahari", coordinates: [22.0, -23.0], score: 92 },
  { name: "Horn of Africa", coordinates: [46.0, 8.0], score: 94 },
  { name: "Danakil", coordinates: [40.5, 13.5], score: 95 },
  // Middle East
  { name: "Rub' al Khali", coordinates: [50.0, 20.0], score: 99 },
  { name: "Arabian Interior", coordinates: [45.0, 25.0], score: 97 },
  { name: "Syrian Desert", coordinates: [39.0, 33.0], score: 95 },
  { name: "Iranian Plateau", coordinates: [54.0, 33.0], score: 93 },
  { name: "Negev", coordinates: [34.8, 30.6], score: 92 },
  // Central & South Asia
  { name: "Karakum", coordinates: [60.0, 39.0], score: 94 },
  { name: "Kyzylkum", coordinates: [64.0, 42.0], score: 93 },
  { name: "Taklamakan", coordinates: [82.0, 39.0], score: 95 },
  { name: "Gobi Desert", coordinates: [103.0, 43.0], score: 91 },
  { name: "Thar Desert", coordinates: [71.5, 27.0], score: 92 },
  { name: "Afghan Highlands", coordinates: [66.0, 33.5], score: 90 },
  // Australia
  { name: "Simpson Desert", coordinates: [137.0, -25.0], score: 96 },
  { name: "Great Sandy Desert", coordinates: [125.0, -21.0], score: 95 },
  { name: "Great Victoria Desert", coordinates: [127.0, -29.0], score: 94 },
  { name: "Nullarbor Plain", coordinates: [130.0, -31.5], score: 93 },
  { name: "Gibson Desert", coordinates: [124.0, -24.5], score: 95 },
];

// Mid-risk campfire spots — allowed but use caution (dry season, gusty winds, brush nearby).
const midRiskCampfireSpots: { name: string; coordinates: [number, number]; score: number }[] = [
  // North America
  { name: "Sierra Nevada Foothills", coordinates: [-120.0, 38.5], score: 58 },
  { name: "Colorado Front Range", coordinates: [-105.5, 39.5], score: 55 },
  { name: "Texas Hill Country", coordinates: [-99.0, 30.5], score: 62 },
  { name: "Ozarks", coordinates: [-93.0, 36.5], score: 48 },
  { name: "Appalachian Ridge", coordinates: [-82.0, 36.0], score: 45 },
  { name: "Oregon High Desert", coordinates: [-120.5, 43.5], score: 60 },
  { name: "Alberta Foothills", coordinates: [-114.0, 52.0], score: 52 },
  // South America
  { name: "Cerrado", coordinates: [-47.0, -14.0], score: 65 },
  { name: "Pampas Edge", coordinates: [-63.0, -35.0], score: 50 },
  { name: "Andean Foothills", coordinates: [-70.5, -33.5], score: 53 },
  // Europe
  { name: "Provence", coordinates: [5.5, 43.8], score: 56 },
  { name: "Catalonia", coordinates: [1.5, 41.8], score: 54 },
  { name: "Croatian Coast", coordinates: [16.5, 43.5], score: 49 },
  { name: "Northern Greece", coordinates: [23.0, 40.8], score: 57 },
  { name: "Corsica", coordinates: [9.0, 42.2], score: 61 },
  { name: "Sicily Interior", coordinates: [14.0, 37.6], score: 59 },
  // Africa
  { name: "Sahel Belt", coordinates: [5.0, 13.0], score: 68 },
  { name: "East African Highlands", coordinates: [37.0, 0.5], score: 55 },
  { name: "South African Veld", coordinates: [26.0, -28.5], score: 63 },
  { name: "Madagascar West", coordinates: [44.5, -20.0], score: 60 },
  // Asia
  { name: "Anatolian Plateau", coordinates: [33.0, 39.0], score: 57 },
  { name: "Levant Hills", coordinates: [36.5, 33.0], score: 64 },
  { name: "Mongolian Steppe", coordinates: [108.0, 47.0], score: 51 },
  { name: "Deccan Plateau", coordinates: [77.0, 17.0], score: 58 },
  { name: "Indochina Dry Forest", coordinates: [104.0, 14.0], score: 62 },
  // Australia & Oceania
  { name: "NSW Tablelands", coordinates: [149.5, -34.5], score: 61 },
  { name: "Victoria Bushland", coordinates: [145.5, -37.0], score: 59 },
  { name: "WA Wheatbelt", coordinates: [117.5, -31.5], score: 66 },
  { name: "Tasmania Midlands", coordinates: [147.0, -42.0], score: 47 },
  { name: "New Zealand East Coast", coordinates: [177.0, -39.5], score: 44 },
];

type Severity = "small" | "medium" | "large";
const SEVERITY_PX: Record<Severity, number> = { small: 12, medium: 18, large: 26 };
const BURN_R: Record<Severity, number> = { small: 10, medium: 16, large: 24 };
const SMOKE_RX: Record<Severity, number> = { small: 6, medium: 10, large: 16 };
const SMOKE_RY: Record<Severity, number> = { small: 3, medium: 6, large: 10 };
const SEVERITY_PX_EU: Record<Severity, number> = { small: 8, medium: 12, large: 18 };
const BURN_R_EU: Record<Severity, number> = { small: 7, medium: 11, large: 16 };
const SMOKE_RX_EU: Record<Severity, number> = { small: 4, medium: 7, large: 10 };
const SMOKE_RY_EU: Record<Severity, number> = { small: 2, medium: 4, large: 7 };
const SMOKE_EMOJI_PX_EU: Record<Severity, number> = { small: 6, medium: 9, large: 12 };
const SMOKE_EMOJI_PX: Record<Severity, number> = { small: 8, medium: 12, large: 16 };
const isEurope = (c: [number, number]) => c[0] >= -25 && c[0] <= 60 && c[1] >= 35 && c[1] <= 72;
const SMOKE_OPACITY: Record<Severity, number> = { small: 0.12, medium: 0.2, large: 0.3 };
const SMOKE_BLUR: Record<Severity, number> = { small: 1, medium: 1.5, large: 2 };
const SMOKE_DRIFT_DUR: Record<Severity, string> = { small: "3s", medium: "4.5s", large: "6s" };
const SMOKE_DRIFT_DX: Record<Severity, number> = { small: 2, medium: 4, large: 7 };
const SMOKE_DRIFT_DY: Record<Severity, number> = { small: -3, medium: -7, large: -11 };
const SMOKE_PUFFS: Record<Severity, number> = { small: 1, medium: 1, large: 2 };

// wind: bearing in degrees (0=N, 90=E, 180=S, 270=W) — direction the smoke drifts toward.
type Wildfire = {
  id: string;
  name: string;
  coordinates: [number, number];
  severity: Severity;
  wind: number;
  firstSeen: number;
  lastSeen: number;
  baseAcres: number;
};

const SEV_ORDER: Severity[] = ["small", "medium", "large"];
const sevFromAcres = (a: number): Severity => (a < 1000 ? "small" : a < 20000 ? "medium" : "large");
const escalateSeverity = (s: Severity): Severity => {
  const i = SEV_ORDER.indexOf(s);
  const r = Math.random();
  if (r < 0.12 && i > 0) return SEV_ORDER[i - 1];
  if (r > 0.88 && i < 2) return SEV_ORDER[i + 1];
  return s;
};

function splitFire(fire: Wildfire, zoom: number): Wildfire[] {
  // Only split clustered groups (multi-fire aggregates), not individual fires.
  if (!fire.id.startsWith("us-cluster-")) return [fire];
  if (zoom < 2.5) return [fire];
  const count = zoom < 4 ? 3 : 5;
  const spread = zoom * 0.6;
  const subSev: Severity = fire.severity === "large" ? "medium" : "small";
  // Deterministic ring: evenly spaced around center, with center point first.
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      return { ...fire, severity: subSev };
    }
    const ringCount = count - 1;
    const angle = ((i - 1) / ringCount) * Math.PI * 2 - Math.PI / 2;
    const r = spread;
    return {
      ...fire,
      id: `${fire.id}-s${i}`,
      coordinates: [
        fire.coordinates[0] + Math.cos(angle) * r,
        fire.coordinates[1] + Math.sin(angle) * r,
      ] as [number, number],
      severity: subSev,
    };
  });
}

const smokePlumes: {
  name: string;
  coordinates: [number, number];
  size: Severity;
  wind: number;
}[] = [
  { name: "Pacific NW Smoke Drift", coordinates: [-123.0, 47.0], size: "large", wind: 100 },
  { name: "Mediterranean Smoke", coordinates: [18.0, 37.0], size: "medium", wind: 170 },
  { name: "Sahel Smoke Haze", coordinates: [10.0, 14.0], size: "medium", wind: 225 },
];

// Convert bearing (deg, 0=N, clockwise) into unit vector in SVG space (y-down).
function windVec(bearingDeg: number): { x: number; y: number } {
  const r = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

const burnedLand: { name: string; coordinates: [number, number]; size: Severity }[] = [
  { name: "Pilbara Interior (AU)", coordinates: [120.0, -23.0], size: "medium" },
  { name: "Simpson Desert Margin (AU)", coordinates: [137.0, -25.5], size: "small" },
  { name: "Sakha Taiga (RU)", coordinates: [128.0, 62.5], size: "medium" },
  { name: "Krasnoyarsk Taiga (RU)", coordinates: [96.0, 61.0], size: "medium" },
  { name: "Amur Basin (RU)", coordinates: [127.0, 53.0], size: "small" },
  { name: "Mato Grosso Cerrado (BR)", coordinates: [-55.0, -13.5], size: "medium" },
  { name: "Rondônia Arc (BR)", coordinates: [-62.5, -10.5], size: "small" },
  { name: "Pantanal Interior (BR)", coordinates: [-57.0, -17.5], size: "small" },
  { name: "Chaco (PY)", coordinates: [-60.0, -22.5], size: "small" },
  { name: "Angola Miombo", coordinates: [18.0, -12.0], size: "small" },
  { name: "DRC/Zambia Miombo", coordinates: [26.0, -10.5], size: "medium" },
  { name: "Alberta Boreal (CA)", coordinates: [-114.0, 56.5], size: "small" },
  { name: "Saskatchewan Boreal (CA)", coordinates: [-106.0, 55.5], size: "small" },
];

type Tool = "pan" | "pen" | "eraser" | "comment";
type Stroke = { id: string; d: string; points: { x: number; y: number }[] };
type Forecast = "sunny" | "partly cloudy" | "cloudy" | "light rain" | "storms";
type ClickPin = {
  id: string;
  lon: number;
  lat: number;
  score: number;
  wind: number;
  windDir: number;
  moisture: number;
  forecast: Forecast;
};

// Deterministic PRNG seeded by coordinates
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function coordSeed(lon: number, lat: number): number {
  const a = Math.round(lon * 1000);
  const b = Math.round(lat * 1000);
  return ((a * 73856093) ^ (b * 19349663)) >>> 0;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
const FORECAST_DRYNESS: Record<Forecast, number> = {
  sunny: 1.0,
  "partly cloudy": 0.8,
  cloudy: 0.55,
  "light rain": 0.25,
  storms: 0.1,
};
function pickForecast(moisture: number, rnd: () => number): Forecast {
  // Higher moisture → more weight on rainy outcomes
  const dryW = Math.max(0.05, 1 - moisture / 100);
  const wetW = Math.max(0.05, moisture / 100);
  const weights: [Forecast, number][] = [
    ["sunny", dryW * 1.4],
    ["partly cloudy", 0.8],
    ["cloudy", wetW * 0.9],
    ["light rain", wetW * 1.1],
    ["storms", wetW * 0.7],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [f, w] of weights) {
    r -= w;
    if (r <= 0) return f;
  }
  return "partly cloudy";
}
function buildPin(lon: number, lat: number): ClickPin {
  const rnd = mulberry32(coordSeed(lon, lat));
  const latAbs = Math.abs(lat);
  const isTropics = latAbs < 23.5;
  const isPolar = latAbs >= 55;
  const isTemperate = !isTropics && !isPolar;

  const windBase = isTemperate ? 22 : isPolar ? 28 : 12;
  const wind = clamp(windBase + (rnd() * 22 - 8), 2, 60);
  const windDir = Math.floor(rnd() * 360);

  const moistBase = isTropics ? 72 : isPolar ? 65 : 45;
  const moisture = clamp(moistBase + (rnd() * 35 - 20), 8, 95);

  const forecast = pickForecast(moisture, rnd);
  const fcDry = FORECAST_DRYNESS[forecast];

  const score = Math.round(clamp(35 * (wind / 60) + 35 * (1 - moisture / 100) + 30 * fcDry, 1, 100));

  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lon,
    lat,
    score,
    wind: Math.round(wind),
    windDir,
    moisture: Math.round(moisture),
    forecast,
  };
}
function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
function scoreColor(s: number): string {
  if (s >= 75) return "hsl(0 75% 50%)";
  if (s >= 50) return "hsl(28 90% 50%)";
  if (s >= 25) return "hsl(48 90% 50%)";
  return "hsl(140 55% 45%)";
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function strokeNear(stroke: Stroke, x: number, y: number, threshold = 8): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) <= threshold;
  for (let i = 1; i < pts.length; i++) {
    if (pointToSegmentDist(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= threshold) {
      return true;
    }
  }
  return false;
}

function Index() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mapHovered, setMapHovered] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [clickPins, setClickPins] = useState<ClickPin[]>(() => {
    const seeds: [number, number][] = [
      ...noCampfireSpots.map((s) => s.coordinates),
      ...midRiskCampfireSpots.map((s) => s.coordinates),
    ];
    return seeds.map(([lon, lat]) => buildPin(lon, lat));
  });
  const [wildfires, setWildfires] = useState<Wildfire[]>([]);
  const [robotOpen, setRobotOpen] = useState(false);
  const [grass, setGrass] = useState<"green" | "brown">("green");
  const [distance, setDistance] = useState<"100" | "50" | "10">("100");
  const [weather, setWeather] = useState<"normal" | "hot" | "windy">("normal");
  const grassScore = grass === "green" ? -25 : 25;
  const distanceScore = distance === "100" ? 0 : distance === "50" ? 12 : 22;
  const weatherScore = weather === "hot" ? 15 : weather === "windy" ? 25 : 0;
  const riskScore = grassScore + distanceScore + weatherScore;
  const riskLabel = riskScore <= 0 ? "Safe" : riskScore <= 25 ? "Low" : riskScore <= 45 ? "Moderate" : "High";
  const riskColor =
    riskScore <= 0
      ? "text-emerald-500"
      : riskScore <= 25
        ? "text-yellow-500"
        : riskScore <= 45
          ? "text-orange-500"
          : "text-red-500";
  const betaTests: Array<{
    label: string;
    g: "green" | "brown";
    d: "100" | "50" | "10";
    w: "normal" | "hot" | "windy";
  }> = [
    { label: "Ideal campsite", g: "green", d: "100", w: "normal" },
    { label: "Dry & breezy", g: "brown", d: "50", w: "windy" },
    { label: "Worst case", g: "brown", d: "10", w: "hot" },
    { label: "Hot day, safe distance", g: "green", d: "100", w: "hot" },
    { label: "Windy meadow", g: "green", d: "50", w: "windy" },
    { label: "Parched grass close up", g: "brown", d: "10", w: "normal" },
    { label: "Moderate risk", g: "brown", d: "50", w: "normal" },
    { label: "Close but damp", g: "green", d: "10", w: "normal" },
  ];

  useEffect(() => {
    let cancelled = false;
    const fetchFires = async () => {
      try {
        // US wildfires from NIFC (the authoritative source behind InciWeb)
        const usRes = await fetch(
          "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=1%3D1&outFields=IncidentName,IncidentSize,IrwinID,FireDiscoveryDateTime&f=geojson&resultRecordCount=2000",
        );
        const usJson = await usRes.json();
        if (cancelled) return;
        const usFires = (
          (usJson.features ?? []) as Array<{
            properties?: { IncidentName?: string; IncidentSize?: number | null; IrwinID?: string };
            geometry?: { coordinates?: number[] };
          }>
        )
          .map((f, idx) => {
            const c = f.geometry?.coordinates;
            if (!c || c.length < 2) return null;
            const acres = typeof f.properties?.IncidentSize === "number" ? f.properties.IncidentSize : 100;
            const name = f.properties?.IncidentName ?? "Wildfire";
            let coordinates: [number, number] = [c[0], c[1]];
            // NIFC sometimes returns mis-projected/zero coords — snap known offenders.
            if (name.toLowerCase().includes("moxee orchard")) {
              coordinates = [-120.5059, 46.6021]; // Yakima, WA
            }
            return {
              id: f.properties?.IrwinID ?? `us-${idx}`,
              name,
              coordinates,
              baseAcres: acres,
            };
          })
          .filter(
            (x): x is { id: string; name: string; coordinates: [number, number]; baseAcres: number } => x !== null,
          );

        // Global wildfires from NASA EONET (non-US only — US comes from InciWeb/NIFC)
        const eonetRes = await fetch(
          "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=200",
        );
        const eonetJson = await eonetRes.json();
        if (cancelled) return;
        const now = Date.now();
        const isUS = (lon: number, lat: number) => lon >= -170 && lon <= -50 && lat >= 18 && lat <= 72;
        const isNorthAmerica = (lon: number, lat: number) => lon >= -170 && lon <= -50 && lat >= 7 && lat <= 72;
        const eonetFires = (
          (eonetJson.events ?? []) as Array<{
            id: string;
            title: string;
            geometry?: Array<{ coordinates?: number[]; magnitudeValue?: number }>;
          }>
        )
          .filter((e) => !e.title.toLowerCase().includes("moxee orchard"))
          .map((e) => {
            const g = e.geometry?.[e.geometry.length - 1];
            const c = g?.coordinates;
            if (!c || c.length < 2) return null;
            const acres = typeof g?.magnitudeValue === "number" ? g.magnitudeValue : 500;
            // EONET coords are raw satellite hotspot pixels — some events (e.g. Kopshesut,
            // Albania) get tagged with a locality name but the heat pixel is far away.
            // Snap known mis-placed events back to the actual place.
            let coordinates: [number, number] = [c[0], c[1]];
            if (e.title.toLowerCase().includes("kopshesut")) {
              coordinates = [19.95, 40.72];
            }
            return {
              id: e.id,
              name: e.title,
              coordinates,
              baseAcres: acres,
            };
          })
          .filter(
            (x): x is { id: string; name: string; coordinates: [number, number]; baseAcres: number } => x !== null,
          );
        const northAmericanEonet = eonetFires.filter(
          (f) => !isUS(f.coordinates[0], f.coordinates[1]) && isNorthAmerica(f.coordinates[0], f.coordinates[1]),
        );
        const others = eonetFires.filter(
          (f) => !isUS(f.coordinates[0], f.coordinates[1]) && !isNorthAmerica(f.coordinates[0], f.coordinates[1]),
        );

        // Cluster North American wildfire markers, keeping Moxee Orchard as its own Yakima marker.
        function kmeansClusters(points: typeof usFires, k: number, iterations = 15): typeof usFires {
          if (points.length <= k) return points;
          const moxee = points.find((p) => p.name.toLowerCase().includes("moxee orchard"));
          const clusterPoints = moxee ? points.filter((p) => p !== moxee) : points;
          const clusterCount = moxee ? k - 1 : k;
          const lons = points.map((p) => p.coordinates[0]).sort((a, b) => a - b);
          const lats = points.map((p) => p.coordinates[1]).sort((a, b) => a - b);
          const minLon = lons[0],
            maxLon = lons[lons.length - 1];
          const minLat = lats[0],
            maxLat = lats[lats.length - 1];
          const centroids: [number, number][] = Array.from({ length: clusterCount }, (_, i) => [
            minLon + ((maxLon - minLon) * (i + 0.5)) / clusterCount,
            minLat + (maxLat - minLat) * (i % 2 === 0 ? 0.3 : 0.7),
          ]);

          for (let it = 0; it < iterations; it++) {
            const clusters: (typeof usFires)[] = Array.from({ length: clusterCount }, () => []);
            for (const p of clusterPoints) {
              let best = 0;
              let bestDist = Infinity;
              for (let i = 0; i < clusterCount; i++) {
                const dx = p.coordinates[0] - centroids[i][0];
                const dy = p.coordinates[1] - centroids[i][1];
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                  bestDist = d;
                  best = i;
                }
              }
              clusters[best].push(p);
            }
            for (let i = 0; i < clusterCount; i++) {
              if (clusters[i].length === 0) {
                const rp = clusterPoints[Math.floor(Math.random() * clusterPoints.length)];
                centroids[i] = [...rp.coordinates];
              } else {
                const sumLon = clusters[i].reduce((s, p) => s + p.coordinates[0], 0);
                const sumLat = clusters[i].reduce((s, p) => s + p.coordinates[1], 0);
                centroids[i] = [sumLon / clusters[i].length, sumLat / clusters[i].length];
              }
            }
          }

          const assignments: number[] = clusterPoints.map((p) => {
            let best = 0;
            let bestDist = Infinity;
            for (let c = 0; c < clusterCount; c++) {
              const dx = p.coordinates[0] - centroids[c][0];
              const dy = p.coordinates[1] - centroids[c][1];
              const d = dx * dx + dy * dy;
              if (d < bestDist) {
                bestDist = d;
                best = c;
              }
            }
            return best;
          });

          const result: typeof usFires = [];
          for (let i = 0; i < clusterCount; i++) {
            const pts = clusterPoints.filter((_, idx) => assignments[idx] === i);
            if (pts.length === 0) continue;
            const totalAcres = pts.reduce((s, p) => s + p.baseAcres, 0);
            const largest = pts.reduce((b, p) => (p.baseAcres > b.baseAcres ? p : b), pts[0]);
            const avgLon = pts.reduce((s, p) => s + p.coordinates[0], 0) / pts.length;
            const avgLat = pts.reduce((s, p) => s + p.coordinates[1], 0) / pts.length;
            result.push({
              id: `us-cluster-${i}-${largest.id}`,
              name: pts.length > 1 ? `${largest.name} (+${pts.length - 1} nearby)` : largest.name,
              coordinates: [avgLon, avgLat],
              baseAcres: totalAcres,
            });
          }
          if (moxee) result.push(moxee);
          return result;
        }

        const clusteredNorthAmerica = kmeansClusters([...usFires, ...northAmericanEonet], 6);
        const incoming = [...others, ...clusteredNorthAmerica];

        setWildfires((prev) => {
          const prevById = new Map(prev.map((f) => [f.id, f]));
          const incomingIds = new Set(incoming.map((i) => i.id));
          const updated: Wildfire[] = incoming.map((i) => {
            const ex = prevById.get(i.id);
            if (ex) return { ...ex, name: i.name, coordinates: i.coordinates, baseAcres: i.baseAcres, lastSeen: now };
            return {
              id: i.id,
              name: i.name,
              coordinates: i.coordinates,
              baseAcres: i.baseAcres,
              severity: sevFromAcres(i.baseAcres),
              wind: Math.floor(Math.random() * 360),
              firstSeen: now,
              lastSeen: now,
            };
          });
          const lingering = prev.filter((f) => !incomingIds.has(f.id) && now - f.lastSeen < 180_000);
          return [...updated, ...lingering];
        });
      } catch {
        /* ignore */
      }
    };
    fetchFires();
    const fetchInt = setInterval(fetchFires, 60_000);
    const tickInt = setInterval(() => {
      const now = Date.now();
      setWildfires((prev) =>
        prev
          .filter((f) => now - f.lastSeen < 180_000)
          .map((f) => ({
            ...f,
            severity: escalateSeverity(f.severity),
            wind: (f.wind + (Math.random() * 20 - 10) + 360) % 360,
          })),
      );
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(fetchInt);
      clearInterval(tickInt);
    };
  }, []);

  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const invZoom = 1 / zoom;
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const geosRef = useRef<any[]>([]);
  const projRef = useRef<RsmProjection | null>(null);
  const [, forceTick] = useState(0);



  const getLocal = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onOverlayDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pan") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getLocal(e);
    if (tool === "pen") {
      setDrawing({
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        d: `M ${x} ${y}`,
        points: [{ x, y }],
      });
    } else {
      setStrokes((prev) => prev.filter((s) => !strokeNear(s, x, y)));
    }
  };

  const onOverlayMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pan") return;
    const { x, y } = getLocal(e);
    if (tool === "pen") {
      if (!drawing) return;
      setDrawing({
        ...drawing,
        d: `${drawing.d} L ${x} ${y}`,
        points: [...drawing.points, { x, y }],
      });
    } else if (e.buttons === 1) {
      setStrokes((prev) => prev.filter((s) => !strokeNear(s, x, y)));
    }
  };

  const onOverlayUp = () => {
    if (tool === "pen" && drawing) {
      setStrokes((prev) => [...prev, drawing]);
      setDrawing(null);
    }
  };

  const overlayActive = tool === "pen" || tool === "eraser";

  const placePinFromEvent = (target: SVGGraphicsElement, clientX: number, clientY: number, requireLand: boolean) => {
    const ctm = target.getScreenCTM();
    if (!ctm) return;
    const svg = target.ownerSVGElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    const inv = projRef.current?.invert?.([local.x, local.y]);
    if (!inv) return;
    const [lon, lat] = inv;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (requireLand) {
      const onLand = geosRef.current.some((g) => {
        try {
          return geoContains(g as any, [lon, lat]);
        } catch {
          return false;
        }
      });
      if (!onLand) return;
    }
    setClickPins((prev) => [...prev, buildPin(lon, lat)]);
  };

  const handleGeoClick = (evt: ReactMouseEvent<SVGPathElement>) => {
    if (tool !== "comment") return;
    placePinFromEvent(evt.currentTarget, evt.clientX, evt.clientY, false);
  };

  const handleWaterClick = (evt: ReactMouseEvent<SVGRectElement>) => {
    if (tool !== "comment") return;
    placePinFromEvent(evt.currentTarget, evt.clientX, evt.clientY, true);
  };

  const overlayCursor = tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : "default";

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="hidden border-b border-border px-6 py-5 lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">World Map</h1>
        <p className="text-sm text-muted-foreground">
          Drag to pan, scroll to zoom. Pen draws, Eraser removes. Comment drops a 💬 risk pin on land — hover it for the
          score.
        </p>
      </header>

      <section className="relative flex-1 lg:mx-auto lg:w-full lg:max-w-6xl lg:px-4 lg:py-6">
        <div className="relative h-full overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
          {/* Toolbar */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-popover/90 p-1 shadow-sm backdrop-blur">
            {(["pan", "pen", "eraser", "comment"] as Tool[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTool(t)}
                className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                  tool === t ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => setRobotOpen((o) => !o)}
              className={`rounded px-2 py-1 text-xs transition-colors ${robotOpen ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
              title="🤖 Risk score generator with robot【beta】"
            >
              🤖 Risk score generator with robot【beta】
            </button>
            <button
              type="button"
              onClick={() => {
                setStrokes([]);
                setClickPins([]);
              }}
              className="rounded px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Clear
            </button>
          </div>

          {robotOpen && (
            <div className="absolute right-3 top-14 z-10 w-72 rounded-md border border-border bg-popover/95 p-3 text-xs shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">🤖 Risk Score Robot【beta】</span>
                <button
                  type="button"
                  onClick={() => setRobotOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="mb-1 text-muted-foreground">Grass color</div>
                  <div className="flex gap-1">
                    {(
                      [
                        ["green", "Green −25"],
                        ["brown", "Brown +25"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setGrass(v)}
                        className={`flex-1 rounded border px-2 py-1 ${grass === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-muted-foreground">Distance from vegetation</div>
                  <div className="flex gap-1">
                    {(
                      [
                        ["100", "100cm 0"],
                        ["50", "50cm +12"],
                        ["10", "10cm +22"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDistance(v)}
                        className={`flex-1 rounded border px-2 py-1 ${distance === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-muted-foreground">Weather forecast</div>
                  <div className="flex gap-1">
                    {(
                      [
                        ["normal", "Normal 0"],
                        ["hot", "Hot +15"],
                        ["windy", "Windy +25"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setWeather(v)}
                        className={`flex-1 rounded border px-2 py-1 ${weather === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded border border-border bg-background/60 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Risk score</span>
                  <span className={`text-lg font-bold ${riskColor}`}>
                    {riskScore > 0 ? "+" : ""}
                    {riskScore}
                  </span>
                </div>
                <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                  {grassScore > 0 ? "+" : ""}
                  {grassScore} {distanceScore > 0 ? "+" : ""}
                  {distanceScore} {weatherScore > 0 ? "+" : ""}
                  {weatherScore} → <span className={riskColor}>{riskLabel}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-muted-foreground">Beta test presets</div>
                <div className="flex flex-col gap-1">
                  {betaTests.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setGrass(t.g);
                        setDistance(t.d);
                        setWeather(t.w);
                      }}
                      className="rounded border border-border px-2 py-1 text-left hover:bg-muted"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            className="relative h-full w-full"
            onMouseEnter={() => setMapHovered(true)}
            onMouseLeave={() => setMapHovered(false)}
          >
            <ComposableMap
              projectionConfig={{ scale: 160 }}
              preserveAspectRatio="xMidYMid slice"
              style={{ width: "100%", height: "100%", display: "block", touchAction: "pan-x pan-y" }}
            >
              <ProjectionCapture projRef={projRef} onReady={() => forceTick((t) => t + 1)} />
              <ZoomableGroup
                filterZoomEvent={() => !overlayActive}
                minZoom={1}
                maxZoom={32}
                onMoveEnd={({ zoom: z }) => setZoom(z)}
                translateExtent={[
                  [-800, -400],
                  [1600, 1000],
                ]}
              >
                <rect
                  x={-2000}
                  y={-2000}
                  width={6000}
                  height={6000}
                  fill="transparent"
                  onClick={handleWaterClick}
                  style={{
                    cursor: tool === "comment" ? "crosshair" : undefined,
                    pointerEvents: tool === "comment" ? "auto" : "none",
                  }}
                />
                <Geographies geography={GEO_URL}>
                  {({ geographies }) => {
                    geosRef.current = [...geographies, TUVALU_GEO];
                    return geographies.map((geo) => {
                      const isFireProne = FIRE_PRONE.has(geo.properties.name);
                      const isSemiFireProne = SEMI_FIRE_PRONE.has(geo.properties.name);
                      const baseFill = isFireProne
                        ? "hsl(var(--destructive) / 0.22)"
                        : isSemiFireProne
                          ? "hsl(0 0% 50% / 0.35)"
                          : "var(--muted)";
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() => setHovered(geo.properties.name)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={handleGeoClick}
                          style={{
                            default: {
                              fill: baseFill,
                              stroke: "var(--border)",
                              strokeWidth: 0.5,
                              outline: "none",
                            },
                            hover: {
                              fill: "var(--primary)",
                              stroke: "var(--border)",
                              strokeWidth: 0.5,
                              outline: "none",
                              cursor: overlayActive ? overlayCursor : "pointer",
                            },
                            pressed: { fill: "var(--primary)", outline: "none" },
                          }}
                        />
                      );
                    });
                  }}
                </Geographies>
                <Marker coordinates={[7.4246, 43.7384]}>
                  <g transform={`scale(${invZoom})`}>
                    <circle
                      r={3}
                      fill="var(--primary)"
                      stroke="var(--border)"
                      strokeWidth={0.5}
                      onMouseEnter={() => setHovered("Monaco")}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: "pointer" }}
                    />
                  </g>
                </Marker>
                <Marker coordinates={[1.4814, 51.8941]}>
                  <g transform={`scale(${invZoom})`}>
                    <circle
                      r={3}
                      fill="var(--primary)"
                      stroke="var(--border)"
                      strokeWidth={0.5}
                      onMouseEnter={() => setHovered("Sealand")}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: "pointer" }}
                    />
                  </g>
                </Marker>
                <Geography
                  key="tuvalu"
                  geography={TUVALU_GEO}
                  onMouseEnter={() => setHovered("Tuvalu")}
                  onMouseLeave={() => setHovered(null)}
                  onClick={handleGeoClick}
                  style={{
                    default: {
                      fill: "var(--muted)",
                      stroke: "var(--border)",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: "var(--primary)",
                      stroke: "var(--border)",
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: overlayActive ? overlayCursor : "pointer",
                    },
                    pressed: { fill: "var(--primary)", outline: "none" },
                  }}
                />
                <defs>
                  {(["small", "medium", "large"] as Severity[]).map((sev) => (
                    <filter key={sev} id={`smoke-blur-${sev}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation={SMOKE_BLUR[sev]} />
                    </filter>
                  ))}
                </defs>
                {noCampfireSpots.map((spot) => (
                  <Marker key={spot.name} coordinates={spot.coordinates}>
                    <g transform={`scale(${invZoom})`}>
                      <circle
                        r={2.5}
                        fill="hsl(28 45% 30%)"
                        stroke="hsl(28 45% 18%)"
                        strokeWidth={0.4}
                        onMouseEnter={() => setHovered(`${spot.name} — no campfire — risk score: ${spot.score}`)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer" }}
                      />
                    </g>
                  </Marker>
                ))}
                {midRiskCampfireSpots.map((spot) => (
                  <Marker key={spot.name} coordinates={spot.coordinates}>
                    <g transform={`scale(${invZoom})`}>
                      <circle
                        r={2.5}
                        fill="hsl(38 90% 55%)"
                        stroke="hsl(38 80% 30%)"
                        strokeWidth={0.4}
                        onMouseEnter={() => setHovered(`${spot.name} — mid fire risk — risk score: ${spot.score}`)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer" }}
                      />
                    </g>
                  </Marker>
                ))}
                <defs>
                  <clipPath id="land-clip" clipPathUnits="userSpaceOnUse">
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={`clip-${geo.rsmKey}`}
                            geography={geo}
                            style={{ default: {}, hover: {}, pressed: {} }}
                          />
                        ))
                      }
                    </Geographies>
                  </clipPath>
                </defs>
                <g clipPath="url(#land-clip)">
                  {burnedLand.map((b) => {
                    const burnREU = isEurope(b.coordinates) ? BURN_R_EU : BURN_R;
                    const p = projRef.current?.(b.coordinates);
                    if (!p) return null;
                    return (
                      <g key={b.name} transform={`translate(${p[0]} ${p[1]})`}>
                        <path
                          d={burnPath(b.name, burnREU[b.size], burnREU[b.size])}
                          fill="hsl(20 40% 25% / 0.55)"
                          stroke="hsl(20 40% 18% / 0.85)"
                          strokeWidth={0.4}
                          onMouseEnter={() => setHovered(`${b.name} — burned land`)}
                          onMouseLeave={() => setHovered(null)}
                          style={{ cursor: "pointer" }}
                        />
                      </g>
                    );
                  })}
                </g>
                {smokePlumes.map((s) => {
                  const smokeRx = isEurope(s.coordinates) ? SMOKE_RX_EU : SMOKE_RX;
                  const smokeRy = isEurope(s.coordinates) ? SMOKE_RY_EU : SMOKE_RY;
                  const smokeEmojiPx = isEurope(s.coordinates) ? SMOKE_EMOJI_PX_EU : SMOKE_EMOJI_PX;
                  const puffs = SMOKE_PUFFS[s.size];
                  const w = windVec(s.wind);
                  const spread = Math.max(smokeRx[s.size], smokeRy[s.size]);
                  const driftMag = Math.hypot(SMOKE_DRIFT_DX[s.size], SMOKE_DRIFT_DY[s.size]);
                  return (
                    <Marker key={s.name} coordinates={s.coordinates}>
                      {Array.from({ length: puffs }).map((_, i) => {
                        const t = puffs === 1 ? 0 : i / (puffs - 1);
                        const dist = spread * (0.3 + t * 0.5);
                        return (
                          <ellipse
                            key={i}
                            rx={smokeRx[s.size] * (1 - t * 0.25)}
                            ry={smokeRy[s.size] * (1 - t * 0.2)}
                            cx={w.x * dist}
                            cy={w.y * dist}
                            fill={`hsl(0 0% 40% / ${SMOKE_OPACITY[s.size] * (1 - t * 0.35)})`}
                            filter={`url(#smoke-blur-${s.size})`}
                            onMouseEnter={() => setHovered(`${s.name} — smoke`)}
                            onMouseLeave={() => setHovered(null)}
                            style={{ cursor: "pointer" }}
                          />
                        );
                      })}
                      <text
                        textAnchor="middle"
                        fontSize={smokeEmojiPx[s.size]}
                        x={w.x * spread * 0.9}
                        y={w.y * spread * 0.9}
                        transform={`rotate(${(Math.atan2(w.y, w.x) * 180) / Math.PI} ${w.x * spread * 0.9} ${w.y * spread * 0.9})`}
                        className="smoke-drift"
                        onMouseEnter={() => setHovered(`${s.name} — smoke`)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          cursor: "pointer",
                          userSelect: "none",
                          ["--smoke-dur" as string]: SMOKE_DRIFT_DUR[s.size],
                          ["--smoke-dx" as string]: `${w.x * driftMag}px`,
                          ["--smoke-dy" as string]: `${w.y * driftMag}px`,
                        }}
                      >
                        💨
                      </text>
                    </Marker>
                  );
                })}
                <g clipPath="url(#land-clip)">
                  {wildfires.flatMap((f) => splitFire(f, zoom)).map((fire) => {
                    const burnR = isEurope(fire.coordinates) ? BURN_R_EU : BURN_R;
                    const p = projRef.current?.(fire.coordinates);
                    if (!p) return null;
                    return (
                      <g key={`burn-${fire.id}`} transform={`translate(${p[0]} ${p[1]})`}>
                        <path
                          d={burnPath(fire.id, burnR[fire.severity], burnR[fire.severity])}
                          fill="hsl(20 40% 25% / 0.55)"
                          stroke="hsl(20 40% 18% / 0.85)"
                          strokeWidth={0.4}
                        />
                      </g>
                    );
                  })}
                </g>
                {wildfires.flatMap((f) => splitFire(f, zoom)).map((fire) => {
                  const burnR = isEurope(fire.coordinates) ? BURN_R_EU : BURN_R;
                  const smokeRx = isEurope(fire.coordinates) ? SMOKE_RX_EU : SMOKE_RX;
                  const smokeRy = isEurope(fire.coordinates) ? SMOKE_RY_EU : SMOKE_RY;
                  const severityPx = isEurope(fire.coordinates) ? SEVERITY_PX_EU : SEVERITY_PX;
                  const smokeEmojiPx = isEurope(fire.coordinates) ? SMOKE_EMOJI_PX_EU : SMOKE_EMOJI_PX;
                  const puffs = SMOKE_PUFFS[fire.severity];
                  const w = windVec(fire.wind);
                  const spread = Math.max(smokeRx[fire.severity], smokeRy[fire.severity]);
                  const driftMag = Math.hypot(SMOKE_DRIFT_DX[fire.severity], SMOKE_DRIFT_DY[fire.severity]);
                   return (
                     <Marker key={fire.id} coordinates={fire.coordinates}>
                       {Array.from({ length: puffs }).map((_, i) => {
                        const t = puffs === 1 ? 0 : i / (puffs - 1);
                        const dist = spread * (0.35 + t * 0.55);
                        return (
                          <ellipse
                            key={i}
                            rx={smokeRx[fire.severity] * (1 - t * 0.25)}
                            ry={smokeRy[fire.severity] * (1 - t * 0.2)}
                            cx={w.x * dist}
                            cy={w.y * dist}
                            fill={`hsl(0 0% 40% / ${SMOKE_OPACITY[fire.severity] * (1 - t * 0.35)})`}
                            filter={`url(#smoke-blur-${fire.severity})`}
                          />
                        );
                      })}
                      <g transform={`scale(${invZoom})`}>
                        <text
                          textAnchor="middle"
                          fontSize={severityPx[fire.severity]}
                          dy={severityPx[fire.severity] / 3}
                          onMouseEnter={() => setHovered(`${fire.name} — ${fire.severity}`)}
                          onMouseLeave={() => setHovered(null)}
                          style={{ cursor: "pointer", userSelect: "none" }}
                        >
                          {fire.name.toLowerCase().includes("kopshesut") ? "♨️" : "🔥"}
                        </text>
                      </g>
                      <text
                        textAnchor="middle"
                        fontSize={smokeEmojiPx[fire.severity]}
                        x={w.x * spread * 1.0}
                        y={w.y * spread * 1.0}
                        transform={`rotate(${(Math.atan2(w.y, w.x) * 180) / Math.PI} ${w.x * spread * 1.0} ${w.y * spread * 1.0})`}
                        className="smoke-drift"
                        style={{
                          userSelect: "none",
                          pointerEvents: "none",
                          ["--smoke-dur" as string]: SMOKE_DRIFT_DUR[fire.severity],
                          ["--smoke-dx" as string]: `${w.x * driftMag}px`,
                          ["--smoke-dy" as string]: `${w.y * driftMag}px`,
                        }}
                      >
                        💨
                      </text>
                    </Marker>
                  );
                })}
                {clickPins.map((p) => {
                  const isHover = hoveredPin === p.id;
                  const w = windVec(p.windDir);
                  return (
                    <Marker key={p.id} coordinates={[p.lon, p.lat]}>
                      <g transform={`scale(${invZoom})`}>
                       <g
                        style={{ cursor: tool === "eraser" ? "cell" : "pointer" }}
                        onMouseEnter={() => setHoveredPin(p.id)}
                        onMouseLeave={() => setHoveredPin(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tool === "eraser") {
                            setClickPins((prev) => prev.filter((x) => x.id !== p.id));
                          }
                        }}
                      >
                        {!isHover && (
                          <text textAnchor="middle" dy={4} fontSize={11} style={{ userSelect: "none" }}>
                            💬
                          </text>
                        )}
                        {isHover && (
                          <g>
                            <rect
                              x={-62}
                              y={-66}
                              width={124}
                              height={62}
                              rx={5}
                              ry={5}
                              fill="hsl(0 0% 8% / 0.92)"
                              stroke="hsl(0 0% 30%)"
                              strokeWidth={0.5}
                            />
                            <text x={-55} y={-50} fontSize={6.5} fill="hsl(0 0% 75%)" style={{ userSelect: "none" }}>
                              Risk score
                            </text>
                            <text
                              x={-55}
                              y={-37}
                              fontSize={14}
                              fontWeight={700}
                              fill={scoreColor(p.score)}
                              style={{ userSelect: "none" }}
                            >
                              {p.score}
                            </text>
                            <text x={-20} y={-50} fontSize={5.5} fill="hsl(0 0% 70%)" style={{ userSelect: "none" }}>
                              Wind
                            </text>
                            <text x={-20} y={-42} fontSize={6.5} fill="hsl(0 0% 95%)" style={{ userSelect: "none" }}>
                              {p.wind} km/h {bearingLabel(p.windDir)}
                            </text>
                            <text x={-20} y={-33} fontSize={5.5} fill="hsl(0 0% 70%)" style={{ userSelect: "none" }}>
                              Moisture
                            </text>
                            <text x={-20} y={-25} fontSize={6.5} fill="hsl(0 0% 95%)" style={{ userSelect: "none" }}>
                              {p.moisture}%
                            </text>
                            <text x={-55} y={-12} fontSize={6} fill="hsl(0 0% 70%)" style={{ userSelect: "none" }}>
                              7d forecast: <tspan fill="hsl(0 0% 95%)">{p.forecast}</tspan>
                            </text>
                            {/* wind direction arrow */}
                            <g transform={`translate(45 -35)`}>
                              <circle r={10} fill="hsl(0 0% 15%)" stroke="hsl(0 0% 35%)" strokeWidth={0.5} />
                              <line
                                x1={0}
                                y1={0}
                                x2={w.x * 7}
                                y2={w.y * 7}
                                stroke="hsl(200 80% 60%)"
                                strokeWidth={1.4}
                                strokeLinecap="round"
                              />
                              <polygon
                                points={`${w.x * 7},${w.y * 7} ${w.x * 5 - w.y * 2},${w.y * 5 + w.x * 2} ${w.x * 5 + w.y * 2},${w.y * 5 - w.x * 2}`}
                                fill="hsl(200 80% 60%)"
                              />
                            </g>
                            <text textAnchor="middle" dy={4} fontSize={11} style={{ userSelect: "none" }}>
                              💬
                            </text>
                          </g>
                        )}
                       </g>
                      </g>
                    </Marker>
                  );
                })}
                {[
                  { name: "California", coordinates: [-119.5, 37.5] as [number, number] },
                  { name: "Pacific Northwest", coordinates: [-120.5, 44.5] as [number, number] },
                  { name: "Mediterranean", coordinates: [22, 38] as [number, number] },
                  { name: "SE Australia", coordinates: [147, -36] as [number, number] },
                  { name: "Amazon", coordinates: [-60, -8] as [number, number] },
                  { name: "Siberia", coordinates: [110, 62] as [number, number] },
                ].map((r) => (
                  <Marker key={`risk-${r.name}`} coordinates={r.coordinates}>
                    <g transform={`scale(${invZoom})`}>
                      <text
                        textAnchor="middle"
                        fontSize={10}
                        dy={3}
                        style={{ cursor: "pointer", userSelect: "none" }}
                        fill="white"
                        onMouseEnter={() => setHovered(`${r.name} — might become 🔥`)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        ⚠
                      </text>
                    </g>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {/* Drawing overlay */}
            <svg
              ref={overlayRef}
              className="absolute inset-0 h-full w-full"
              style={{
                pointerEvents: overlayActive ? "auto" : "none",
                cursor: overlayCursor,
                touchAction: overlayActive ? "none" : "auto",
              }}
              onPointerDown={onOverlayDown}
              onPointerMove={onOverlayMove}
              onPointerUp={onOverlayUp}
              onPointerCancel={onOverlayUp}
            >
              {strokes.map((s) => (
                <path
                  key={s.id}
                  d={s.d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {drawing && (
                <path
                  d={drawing.d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Hover label */}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-border bg-popover/90 px-2 py-1 text-xs shadow-sm backdrop-blur lg:bottom-8 lg:left-8 lg:px-3 lg:py-2 lg:text-sm">
          {hovered ?? "Hover a country"}
        </div>

        {/* Legend */}
        <div
          className={`pointer-events-none absolute bottom-2 right-2 space-y-1.5 rounded-md border border-border bg-popover/90 px-2 py-1.5 text-[10px] shadow-sm backdrop-blur transition-opacity duration-200 lg:bottom-8 lg:right-8 lg:space-y-2 lg:px-3 lg:py-2 lg:text-xs ${
            mapHovered ? "opacity-15" : "opacity-100"
          }`}
        >
          <div className="font-medium">Legend</div>
          <div className="flex items-end gap-2">
            <span style={{ fontSize: 12, lineHeight: 1 }}>🔥</span>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🔥</span>
            <span style={{ fontSize: 26, lineHeight: 1 }}>🔥</span>
            <span className="ml-1 text-muted-foreground">small → large fire</span>
          </div>
          <div className="flex items-end gap-2">
            <span style={{ fontSize: 10, lineHeight: 1 }}>💨</span>
            <span style={{ fontSize: 16, lineHeight: 1 }}>💨</span>
            <span style={{ fontSize: 24, lineHeight: 1 }}>💨</span>
            <span className="ml-1 text-muted-foreground">smoke spread</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, lineHeight: 1 }}>⚠</span>
            <span className="text-muted-foreground">might become 🔥</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-5 items-center justify-center" aria-hidden="true">
              <svg viewBox="0 0 32 56" className="h-6 w-4" role="img">
                <path
                  d="M18 1.5 14.8 4 15.5 8.2 12 10.8 13.4 16.2 9.7 20.6 11.8 25.8 8.4 30.1 10.7 36.5 7.6 42.6 11.1 47.5 10.4 53.8 15.8 55 19.3 50.6 18.4 45.1 22.2 39.8 20.7 34.4 24.4 28.8 22.1 22.6 25.5 17.4 23 11.8 25 6.2 21.6 3.9Z"
                  fill="black"
                />
              </svg>
            </span>
            <span className="text-muted-foreground">Fire-prone country</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-4 rounded-sm border border-border"
              style={{ background: "hsl(0 0% 50% / 0.35)" }}
            />
            <span className="text-muted-foreground">Semi fire-prone country</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-border"
              style={{ background: "hsl(28 45% 30%)" }}
            />
            <span className="text-muted-foreground">No-campfire spot</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-border"
              style={{ background: "hsl(38 90% 55%)" }}
            />
            <span className="text-muted-foreground">Mid fire-risk campfire spot</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-border"
              style={{ background: "var(--primary)" }}
            />
            <span className="text-muted-foreground">Micro-state (Monaco, Sealand)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-4 rounded-full border border-border"
              style={{ background: "hsl(20 40% 20% / 0.55)" }}
            />
            <span className="text-muted-foreground">Burned land</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-4 rounded-full border border-border"
              style={{ background: "hsl(0 0% 40% / 0.35)" }}
            />
            <span className="text-muted-foreground">Smoke</span>
          </div>
        </div>
      </section>
    </main>
  );
}
