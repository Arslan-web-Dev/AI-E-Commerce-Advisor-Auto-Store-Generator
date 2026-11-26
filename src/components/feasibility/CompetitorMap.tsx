'use client';

import { useEffect, useRef, useState } from 'react';
import type { RentMapArea } from '@/lib/visualization/rent-map';
import {
  getLoadedLeaflet,
  loadLeaflet,
  type LeafletLayerGroup,
  type LeafletMap,
} from '@/lib/visualization/leaflet-loader';
import {
  formatMapNumber,
  getMapStatusMessage,
  isValidMapCoordinate,
  isValidMapRadius,
  sanitizeMapText,
  type MapStatus,
} from '@/lib/visualization/map-validation';
import {
  OSM_ATTRIBUTION_TEXT,
  OSM_ATTRIBUTION_URL,
  RENT_INTENSITY_BANDS,
} from '@/lib/visualization/module5-config';

interface Competitor {
  name: string;
  lat: number;
  lng: number;
  distance_km?: number;
  rating?: number;
  category?: string;
}

interface Props {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm?: number | null;
  competitors?: Competitor[];
  rentAreas?: RentMapArea[];
  height?: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

function buildPopup(title: string, rows: Array<[string, string]>): HTMLElement {
  const container = document.createElement('div');
  container.style.minWidth = '170px';
  container.style.fontFamily = 'sans-serif';
  container.style.fontSize = '12px';
  container.style.color = '#111827';

  const heading = document.createElement('strong');
  heading.textContent = sanitizeMapText(title);
  heading.style.display = 'block';
  heading.style.marginBottom = '6px';
  container.appendChild(heading);

  for (const [label, value] of rows) {
    const line = document.createElement('div');
    const key = document.createElement('span');
    key.textContent = `${label}: `;
    key.style.color = '#4b5563';
    const val = document.createElement('span');
    val.textContent = sanitizeMapText(value);
    line.append(key, val);
    container.appendChild(line);
  }
  return container;
}

function freshnessLabel(area: RentMapArea): string {
  const parts: string[] = [area.freshness];
  if (area.isStale) parts.push('stale');
  if (area.provenance === 'manual_estimate') parts.push('manual estimate');
  return parts.join(' · ');
}

function rentPopup(area: RentMapArea): HTMLElement {
  const range =
    area.rentMin != null && area.rentMax != null && area.rentMax > area.rentMin
      ? `${area.currency} ${area.rentMin.toFixed(0)}–${area.rentMax.toFixed(0)} / ft²`
      : 'Genuine range unavailable';
  return buildPopup(area.area || 'Unnamed area', [
    ['Sourced rent', `${area.currency} ${area.rentAvg.toFixed(0)} / ft²`],
    ['Observed range', range],
    ['Source', area.source],
    ['Provenance', area.provenance],
    ['Freshness', freshnessLabel(area)],
    ['Confidence', area.confidence],
    ['Recorded', area.retrievedAt ?? 'N/A'],
    ['Sample', area.sampleSize == null ? 'N/A' : String(area.sampleSize)],
    ['Geometry', 'Centroid marker; no boundary stored'],
  ]);
}

function competitorPopup(competitor: Competitor): HTMLElement {
  return buildPopup(competitor.name || 'Unnamed competitor', [
    ['Category', competitor.category || 'Uncategorised'],
    ['Distance', `${formatMapNumber(competitor.distance_km, 1)} km`],
    ['Rating', competitor.rating == null ? 'N/A' : `${competitor.rating}/5`],
  ]);
}

export default function CompetitorMap({
  centerLat,
  centerLng,
  radiusKm = null,
  competitors = [],
  rentAreas = [],
  height = '400px',
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const competitorLayerRef = useRef<LeafletLayerGroup | null>(null);
  const rentLayerRef = useRef<LeafletLayerGroup | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [showRent, setShowRent] = useState(true);

  const validCenter = isValidMapCoordinate(centerLat, centerLng);
  const validRadius = isValidMapRadius(radiusKm);
  const canRenderMap = validCenter && validRadius;

  useEffect(() => {
    if (!canRenderMap) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoadState((current) => (current === 'ready' ? current : 'loading'));
        return loadLeaflet();
      })
      .then(() => {
        if (!cancelled) setLoadState(getLoadedLeaflet() ? 'ready' : 'failed');
      })
      .catch(() => {
        if (!cancelled) setLoadState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [canRenderMap]);

  useEffect(() => {
    if (loadState !== 'ready' || !canRenderMap || !mapRef.current) return;
    const L = getLoadedLeaflet();
    if (!L) return;

    let map: LeafletMap | null = null;
    try {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;

      map = L.map(mapRef.current, { scrollWheelZoom: true }).setView(
        [Number(centerLat), Number(centerLng)],
        12
      );
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const centerIcon = L.divIcon({
        html: '<div style="background:#4edea3;width:18px;height:18px;border-radius:50%;border:3px solid #0b1326;box-shadow:0 0 10px #4edea3;"></div>',
        className: 'custom-map-center-pin',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([Number(centerLat), Number(centerLng)], { icon: centerIcon })
        .addTo(map)
        .bindPopup(buildPopup('Target location', [
          ['Role', 'Primary storefront centre'],
          ['Coordinates', `${formatMapNumber(Number(centerLat), 5)}, ${formatMapNumber(Number(centerLng), 5)}`],
        ]))
        .openPopup();

      L.circle([Number(centerLat), Number(centerLng)], {
        color: '#4edea3',
        fillColor: '#4edea3',
        fillOpacity: 0.12,
        radius: Number(radiusKm) * 1000,
        weight: 2,
        dashArray: '6, 5',
      }).addTo(map);

      competitorLayerRef.current = L.layerGroup().addTo(map);
      rentLayerRef.current = L.layerGroup().addTo(map);
    } catch (error) {
      map?.remove();
      mapInstanceRef.current = null;
      competitorLayerRef.current = null;
      rentLayerRef.current = null;
      void Promise.resolve().then(() => setLoadState('failed'));
      if (error instanceof Error) console.warn('Map initialization failed:', error.message);
    }

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      competitorLayerRef.current = null;
      rentLayerRef.current = null;
    };
  }, [loadState, canRenderMap, centerLat, centerLng, radiusKm]);

  useEffect(() => {
    const L = getLoadedLeaflet();
    const layer = competitorLayerRef.current;
    if (loadState !== 'ready' || !L || !layer) return;
    layer.clearLayers();
    for (const competitor of competitors) {
      if (!isValidMapCoordinate(competitor.lat, competitor.lng)) continue;
      const icon = L.divIcon({
        html: '<div style="background:#4cd7f6;width:14px;height:14px;border-radius:50%;border:2px solid #0b1326;box-shadow:0 0 8px #4cd7f6;"></div>',
        className: 'custom-map-competitor-pin',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([Number(competitor.lat), Number(competitor.lng)], { icon })
        .addTo(layer)
        .bindPopup(competitorPopup(competitor));
    }
    return () => {
      layer.clearLayers();
    };
  }, [competitors, loadState]);

  useEffect(() => {
    const L = getLoadedLeaflet();
    const layer = rentLayerRef.current;
    if (loadState !== 'ready' || !L || !layer) return;
    layer.clearLayers();
    if (!showRent) return;

    for (const area of rentAreas) {
      if (!isValidMapCoordinate(area.lat, area.lng)) continue;
      const color = area.intensityBand?.color ?? '#4cd7f6';
      const icon = L.divIcon({
        html: `<div style="background:${color};width:12px;height:12px;border-radius:3px;border:2px solid #0b1326;box-shadow:0 0 8px ${color};"></div>`,
        className: 'custom-map-rent-pin',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([area.lat, area.lng], { icon }).addTo(layer).bindPopup(rentPopup(area));
    }
    return () => {
      layer.clearLayers();
    };
  }, [rentAreas, showRent, loadState]);

  const status: MapStatus = !canRenderMap
    ? 'invalid'
    : loadState === 'failed'
      ? 'failed'
      : loadState !== 'ready'
        ? 'loading'
        : competitors.length === 0 && rentAreas.length === 0
          ? 'no-data'
          : 'ready';
  const statusMessage = getMapStatusMessage(status);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={mapRef}
        aria-label="Interactive OpenStreetMap showing the project radius, competitors and stored rent areas"
        role="region"
        style={{
          height,
          width: '100%',
          backgroundColor: '#0d1829',
          border: '1px solid #2d3449',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}
      />
      {!canRenderMap && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
            textAlign: 'center',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            color: '#fca5a5',
            backgroundColor: '#0d1829',
            borderRadius: '0.75rem',
          }}
        >
          {statusMessage}
        </div>
      )}
      {canRenderMap && status !== 'ready' && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 500,
            maxWidth: 'calc(100% - 20px)',
            fontSize: '0.72rem',
            backgroundColor: '#171f33ee',
            border: '1px solid #2d3449',
            color: status === 'failed' ? '#fca5a5' : '#dae2fd',
            padding: '6px 10px',
            borderRadius: '6px',
            lineHeight: 1.4,
          }}
        >
          {statusMessage}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 10,
          zIndex: 500,
          maxWidth: 'calc(100% - 20px)',
          fontSize: '0.68rem',
          backgroundColor: '#171f33ee',
          border: '1px solid #2d3449',
          color: '#dae2fd',
          padding: '6px 10px',
          borderRadius: '6px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          lineHeight: 1.4,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4edea3', display: 'inline-block' }} />
          Target site
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4cd7f6', display: 'inline-block' }} />
          Competitors ({competitors.length})
        </span>
        {rentAreas.length > 0 && (
          <button
            type="button"
            aria-pressed={showRent}
            onClick={() => setShowRent((visible) => !visible)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #4cd7f6',
              color: '#4cd7f6',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.68rem',
              cursor: 'pointer',
            }}
          >
            Rent areas ({rentAreas.length}): {showRent ? 'on' : 'off'}
          </button>
        )}
      </div>

      {rentAreas.length > 0 && showRent && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            bottom: 28,
            zIndex: 500,
            maxWidth: 'min(230px, calc(100% - 20px))',
            backgroundColor: '#171f33ee',
            border: '1px solid #2d3449',
            borderRadius: '6px',
            padding: '6px 8px',
            fontSize: '0.64rem',
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: '#dae2fd' }}>Rent / ft² (relative)</strong>
          {RENT_INTENSITY_BANDS.map((band) => (
            <div key={band.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 9, height: 9, backgroundColor: band.color, display: 'inline-block', borderRadius: '2px' }} />
              {band.label}
            </div>
          ))}
          <span style={{ opacity: 0.65 }}>Centroid markers only; no zone boundaries are stored.</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#0d1829',
          padding: '4px 8px',
          border: '1px solid #2d3449',
          borderTop: 'none',
          borderBottomLeftRadius: '0.75rem',
          borderBottomRightRadius: '0.75rem',
          fontSize: '0.68rem',
        }}
      >
        <a
          href={OSM_ATTRIBUTION_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#8ab4f8', textDecoration: 'underline' }}
        >
          {OSM_ATTRIBUTION_TEXT}
        </a>
      </div>
    </div>
  );
}
