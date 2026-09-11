'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

interface Props {
  label: string;
  value: number;
  suffix?: string;
  accent?: 'cyan' | 'green' | 'purple' | 'yellow';
  delay?: number;
}

const accentMap = {
  cyan: 'from-accent-cyan/30 to-accent-blue/10 border-accent-cyan/30',
  green: 'from-accent-green/30 to-emerald-500/10 border-accent-green/30',
  purple: 'from-accent-purple/30 to-pink-500/10 border-accent-purple/30',
  yellow: 'from-accent-yellow/30 to-orange-500/10 border-accent-yellow/30',
};

export default function StatCard({
  label,
  value,
  suffix = '',
  accent = 'cyan',
  delay = 0,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      gsap.from(root.current, {
        y: 30,
        opacity: 0,
        duration: 0.7,
        delay,
        ease: 'power3.out',
      });

      const counter = { v: 0 };
      gsap.to(counter, {
        v: value,
        duration: 1.6,
        delay: delay + 0.2,
        ease: 'power2.out',
        onUpdate: () => {
          if (numRef.current) {
            numRef.current.textContent = Math.round(counter.v).toLocaleString();
          }
        },
      });
    },
    { scope: root, dependencies: [value, delay] },
  );

  return (
    <div
      ref={root}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accentMap[accent]} backdrop-blur-md p-6 card-hover`}
    >
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <p className="text-xs uppercase tracking-widest text-white/60 font-medium">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-bold text-white">
        <span ref={numRef}>0</span>
        <span className="text-white/50 text-2xl ml-1">{suffix}</span>
      </p>
    </div>
  );
}
