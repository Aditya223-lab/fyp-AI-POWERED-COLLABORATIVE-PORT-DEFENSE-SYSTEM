'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { toast } from 'react-hot-toast';
import { targetAPI } from '@/lib/api';
import type { MonitorTarget } from '@/types';

interface Props {
  open: boolean;
  target: MonitorTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

/** The URL for a website, the IP or hostname for a computer. */
function currentAddress(t: MonitorTarget): string {
  if (t.type === 'WEBSITE') return t.url ?? t.hostname ?? t.ipAddress;
  return t.hostname ?? t.ipAddress;
}

export default function EditTargetModal({ open, target, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ports, setPorts] = useState('');
  const [interval, setIntervalSeconds] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (open && panelRef.current) {
        gsap.from(panelRef.current, {
          y: 20,
          opacity: 0,
          duration: 0.3,
          ease: 'power3.out',
        });
      }
    },
    { dependencies: [open] },
  );

  useEffect(() => {
    if (!open || !target) return;
    setName(target.name);
    setAddress(currentAddress(target));
    setPorts(target.ports);
    setIntervalSeconds(target.checkIntervalSeconds);
    setSubmitting(false);
  }, [open, target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!name.trim() || !address.trim() || !ports.trim()) {
      toast.error('Name, address and ports are required');
      return;
    }
    setSubmitting(true);
    try {
      await targetAPI.update(target.id, {
        name: name.trim(),
        address: address.trim(),
        ports: ports.trim(),
        checkIntervalSeconds: interval,
      });
      toast.success(`Updated ${name.trim()}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update target');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-primary-dark/95 backdrop-blur-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>

        <p className="text-xs uppercase tracking-widest text-accent-yellow font-medium">
          Edit · {target.id}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">
          Update <span className="text-gradient">{target.name}</span>
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Change what is monitored and how often. The next check runs
          immediately after you save.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-white/60">Target name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">
              {target.type === 'WEBSITE' ? 'Website URL' : 'IP address or hostname'}
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                target.type === 'WEBSITE' ? 'https://example.com' : '203.0.113.7'
              }
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Ports</label>
            <input
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              placeholder="22,80,443 or 1-1024"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Check interval</label>
            <select
              value={interval}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
            >
              <option value={15}>every 15 seconds</option>
              <option value={30}>every 30 seconds</option>
              <option value={60}>every minute</option>
              <option value={300}>every 5 minutes</option>
              <option value={900}>every 15 minutes</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/70 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
