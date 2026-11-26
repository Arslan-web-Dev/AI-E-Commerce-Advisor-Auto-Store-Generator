import { LEAFLET_LOAD_TIMEOUT_MS, OSM_TILE_URL } from './module5-config';

/** Minimal Leaflet surface used by the feasibility map. */
export interface LeafletLayer {
  addTo(container: LeafletMap | LeafletLayerGroup): this;
  remove(): this;
}

export interface LeafletMap {
  setView(center: [number, number], zoom: number): this;
  remove(): void;
}

export type LeafletPopupContent = string | HTMLElement;

export interface LeafletMarker extends LeafletLayer {
  bindPopup(content: LeafletPopupContent): this;
  openPopup(): this;
}

export interface LeafletLayerGroup extends LeafletLayer {
  clearLayers(): this;
  addLayer(layer: LeafletLayer): this;
}

export interface LeafletIconOptions {
  html: string;
  className?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
}

export interface LeafletStatic {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
  divIcon(options: LeafletIconOptions): unknown;
  marker(latlng: [number, number], options: { icon: unknown }): LeafletMarker;
  circle(latlng: [number, number], options: Record<string, unknown>): LeafletLayer;
  layerGroup(): LeafletLayerGroup;
}

interface WindowWithLeaflet extends Window {
  L?: LeafletStatic;
}

const SCRIPT_ID = 'leaflet-cdn-script';
const STYLESHEET_ID = 'leaflet-css';
const SCRIPT_SRC = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const STYLESHEET_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let loadPromise: Promise<LeafletStatic> | null = null;

function windowWithLeaflet(): WindowWithLeaflet | null {
  return typeof window === 'undefined' ? null : (window as WindowWithLeaflet);
}

function ensureStylesheet(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLESHEET_ID)) return;
  const link = document.createElement('link');
  link.id = STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = STYLESHEET_HREF;
  link.crossOrigin = '';
  document.head.appendChild(link);
}

function createScript(): HTMLScriptElement {
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.crossOrigin = '';
  script.async = true;
  document.head.appendChild(script);
  return script;
}

function getUsableScript(): HTMLScriptElement {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing && existing.dataset.failed === 'true') {
    existing.remove();
    return createScript();
  }
  return existing ?? createScript();
}

/** Returns the already loaded Leaflet global without initiating another load. */
export function getLoadedLeaflet(): LeafletStatic | null {
  return windowWithLeaflet()?.L ?? null;
}

/**
 * One shared, cancellable-safe loader. Strict Mode remounts reuse the same
 * promise instead of adding duplicate script listeners or map instances.
 */
export function loadLeaflet(timeoutMs = LEAFLET_LOAD_TIMEOUT_MS): Promise<LeafletStatic> {
  const w = windowWithLeaflet();
  if (!w || typeof document === 'undefined') {
    return Promise.reject(new Error('Leaflet can only be loaded in a browser.'));
  }
  if (w.L) return Promise.resolve(w.L);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<LeafletStatic>((resolve, reject) => {
    ensureStylesheet();
    const script = getUsableScript();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
      if (timer) clearTimeout(timer);
    };

    const fail = (message: string) => {
      script.dataset.failed = 'true';
      cleanup();
      reject(new Error(message));
    };

    const succeed = () => {
      if (w.L) {
        cleanup();
        resolve(w.L);
      } else {
        fail('Leaflet script loaded without a usable global.');
      }
    };

    timer = setTimeout(() => fail('Leaflet map provider timed out.'), timeoutMs);
    script.onload = succeed;
    script.onerror = () => fail('Leaflet map provider script failed to load.');

    // The script may have completed between a previous failure and this call.
    if (w.L) succeed();
  }).catch((error: unknown) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export { OSM_TILE_URL };
