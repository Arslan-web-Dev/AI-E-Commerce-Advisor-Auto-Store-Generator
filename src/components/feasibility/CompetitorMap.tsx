'use client';

import { useEffect, useRef, useState } from 'react';

interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  remove(): void;
}

interface LeafletLayer {
  addTo(map: LeafletMap): this;
}

interface LeafletMarker extends LeafletLayer {
  bindPopup(html: string): this;
  openPopup(): this;
}

interface LeafletIconOptions {
  html: string;
  className?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
}

interface LeafletStatic {
  map(el: HTMLElement): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
  divIcon(options: LeafletIconOptions): unknown;
  marker(latlng: [number, number], options: { icon: unknown }): LeafletMarker;
  circle(latlng: [number, number], options: Record<string, unknown>): LeafletLayer;
}

declare global {
  interface Window {
    L?: LeafletStatic;
  }
}

interface Competitor {
  name: string;
  lat: number;
  lng: number;
  distance_km?: number;
  rating?: number;
  category?: string;
}

interface Props {
  centerLat: number;
  centerLng: number;
  radiusKm?: number;
  competitors?: Competitor[];
  height?: string;
}

export default function CompetitorMap({ centerLat, centerLng, radiusKm = 10, competitors = [], height = '400px' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load Leaflet script dynamically from CDN if not already on page
    const existingScript = document.getElementById('leaflet-cdn-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'leaflet-cdn-script';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else if (window.L) {
      const timer = setTimeout(() => setMapLoaded(true), 0);
      return () => clearTimeout(timer);
    } else {
      existingScript.addEventListener('load', () => setMapLoaded(true));
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const L = window.L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapRef.current).setView([centerLat, centerLng], 12);
      mapInstanceRef.current = map;

      // OSM tile layer with attribution
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Center marker (User project location)
      const centerIcon = L.divIcon({
        html: `<div style="background:#4edea3;width:18px;height:18px;border-radius:50%;border:3px solid #0b1326;box-shadow:0 0 10px #4edea3;"></div>`,
        className: 'custom-map-center-pin',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([centerLat, centerLng], { icon: centerIcon })
        .addTo(map)
        .bindPopup('<b>Target Location</b><br/>Primary Storefront Center')
        .openPopup();

      // Radius boundary circle
      L.circle([centerLat, centerLng], {
        color: '#4edea3',
        fillColor: '#4edea3',
        fillOpacity: 0.12,
        radius: radiusKm * 1000,
        weight: 2,
        dashArray: '6, 5',
      }).addTo(map);

      // Competitor markers
      const compIcon = L.divIcon({
        html: `<div style="background:#4cd7f6;width:14px;height:14px;border-radius:50%;border:2px solid #0b1326;box-shadow:0 0 8px #4cd7f6;"></div>`,
        className: 'custom-map-comp-pin',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      for (const c of competitors) {
        if (!c.lat || !c.lng) continue;
        const popup = `
          <div style="min-width:140px;font-family:sans-serif;font-size:12px;color:#111;">
            <b style="color:#0b1326;font-size:13px;">${c.name}</b><br/>
            ${c.category ? `<span style="color:#666;">${c.category}</span><br/>` : ''}
            ${c.distance_km != null ? `<span>Distance: <b>${c.distance_km.toFixed(1)} km</b></span><br/>` : ''}
            ${c.rating != null ? `<span style="color:#d97706;">★ ${c.rating}/5</span>` : ''}
          </div>`;
        L.marker([c.lat, c.lng], { icon: compIcon }).addTo(map).bindPopup(popup);
      }
    } catch (e) {
      console.warn('Map initialization:', e);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded, centerLat, centerLng, radiusKm, competitors]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div
        ref={mapRef}
        style={{
          height,
          width: '100%',
          backgroundColor: '#0d1829',
          border: '1px solid #2d3449',
          borderRadius: '0.75rem',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 500,
          fontSize: '0.72rem',
          backgroundColor: '#171f33ee',
          border: '1px solid #2d3449',
          color: '#dae2fd',
          padding: '4px 10px',
          borderRadius: '6px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4edea3', display: 'inline-block' }} />
          Target Site
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4cd7f6', display: 'inline-block' }} />
          Competitor ({competitors.length})
        </span>
      </div>
    </div>
  );
}
