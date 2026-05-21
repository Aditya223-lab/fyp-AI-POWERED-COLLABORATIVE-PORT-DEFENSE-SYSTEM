'use client';

import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { ThreatEvent, Severity } from '@/types';

interface Props {
  threats: ThreatEvent[];
}

const sevHex: Record<Severity, string> = {
  low: '#34d399',
  medium: '#facc15',
  high: '#fb923c',
  critical: '#f87171',
};

const sevRadius: Record<Severity, number> = {
  low: 5,
  medium: 6,
  high: 7,
  critical: 9,
};

export default function AttackMap({ threats }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(root.current, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
      });
    },
    { scope: root },
  );

  const withLocation = threats.filter((t) => t.location);

  return (
    <div
      ref={root}
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-primary-dark/40"
      style={{ height: 460 }}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        scrollWheelZoom={false}
        worldCopyJump
        style={{ height: '100%', width: '100%', background: '#06101c' }}
        attributionControl={false}
      >  
      //map api integration and usages for visualizing the attack origins and targets on a global map, with different colors and sizes based on severity, and popups for more details on each attack event.  
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
        />

        {withLocation.map((t) => {
          const color = sevHex[t.severity];
          return (
            <CircleMarker
              key={t.id}
              center={[t.location!.lat, t.location!.lng]}
              radius={sevRadius[t.severity]}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: t.severity === 'critical' ? 0.85 : 0.6,
                weight: 1.5,
                opacity: 0.9,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                className="!bg-primary-dark !text-white !border !border-white/10 !rounded-md !px-2 !py-1 !text-xs"
              >
                <span className="font-mono">{t.sourceIP}</span> · :
                {t.targetPort}
              </Tooltip>
              <Popup className="attack-popup">
                <div className="text-xs space-y-1 font-sans">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="font-bold uppercase tracking-wider">
                      {t.severity}
                    </span>
                    {t.isZeroDay && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">
                        0-DAY
                      </span>
                    )}
                  </div>
                  <div className="font-mono pt-1">
                    {t.sourceIP} → :{t.targetPort}
                  </div>
                  <div className="text-gray-600">
                    {t.organizationName} · {t.scanType.toUpperCase()}
                  </div>
                  <div className="text-gray-600">
                    {t.location?.country} · conf {Math.round(t.confidence * 100)}%
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="absolute top-3 left-3 z-[400] px-3 py-2 rounded-lg bg-primary-dark/80 backdrop-blur border border-white/10 text-xs pointer-events-none">
        <div className="text-white/70 font-semibold mb-1.5 uppercase tracking-wider text-[10px]">
          Live origins
        </div>
        <div className="flex gap-3">
          {(['low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: sevHex[s] }}
              />
              <span className="capitalize text-white/70">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[400] px-2 py-1 rounded bg-primary-dark/80 backdrop-blur border border-white/10 text-[10px] text-white/50 pointer-events-none">
        © OpenStreetMap · CartoDB
      </div>
    </div>
  );
}
