'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { toast } from 'react-hot-toast';
import { orgAPI } from '@/lib/api';
import type { CustomerRecord, Organization } from '@/types';

const industries: Organization['industry'][] = [
  'finance',
  'healthcare',
  'education',
  'technology',
  'government',
  'other',
];

const statuses: Organization['status'][] = [
  'active',
  'warning',
  'critical',
  'offline',
];

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

interface Props {
  open: boolean;
  org: Organization | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOrgModal({ open, org, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState<Organization['industry']>('technology');
  const [status, setStatus] = useState<Organization['status']>('active');
  const [memberCount, setMemberCount] = useState(1);
  const [ipsText, setIpsText] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [premiumCustomers, setPremiumCustomers] = useState<CustomerRecord[]>([]);
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

  // Reset form to org's current values whenever the modal opens for a new org.
  useEffect(() => {
    if (!open || !org) return;
    setName(org.name);
    setIndustry(org.industry);
    setStatus(org.status);
    setMemberCount(org.memberCount);
    setIpsText(org.ipAddresses.join('\n'));
    setOwnerEmail(org.ownerEmail ?? '');
    setSubmitting(false);

    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((users: CustomerRecord[]) =>
        setPremiumCustomers(users.filter((u) => u.plan === 'premium')),
      )
      .catch(() => setPremiumCustomers([]));
  }, [open, org]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !org) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const tokens = ipsText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = tokens.filter((t) => !IP_REGEX.test(t));
    if (invalid.length > 0) {
      toast.error(`Invalid IP: ${invalid[0]}`);
      return;
    }

    setSubmitting(true);
    try {
      await orgAPI.update(org.id, {
        name: name.trim(),
        industry,
        status,
        memberCount,
        ownerEmail: ownerEmail || '', // empty string clears
        ipAddresses: tokens,
      });
      toast.success(`Updated ${name.trim()}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
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
          Edit · {org.id}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">
          Update <span className="text-gradient">{org.name}</span>
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Change any field below and save. Empty &quot;Owner&quot; clears the
          assignment.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-white/60">Organization name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Industry</label>
              <select
                value={industry}
                onChange={(e) =>
                  setIndustry(e.target.value as Organization['industry'])
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm appearance-none"
              >
                {industries.map((i) => (
                  <option key={i} value={i} className="bg-primary-dark">
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/60">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Organization['status'])
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm appearance-none"
              >
                {statuses.map((s) => (
                  <option key={s} value={s} className="bg-primary-dark">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Members</label>
              <input
                type="number"
                min={1}
                max={500}
                value={memberCount}
                onChange={(e) =>
                  setMemberCount(Math.max(1, Number(e.target.value)))
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Owner</label>
              <select
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm appearance-none"
              >
                <option value="" className="bg-primary-dark">
                  — unassigned —
                </option>
                {/* Always include current owner in case they're no longer premium */}
                {ownerEmail &&
                  !premiumCustomers.some((c) => c.email === ownerEmail) && (
                    <option value={ownerEmail} className="bg-primary-dark">
                      {ownerEmail} (current)
                    </option>
                  )}
                {premiumCustomers.map((c) => (
                  <option key={c.email} value={c.email} className="bg-primary-dark">
                    {c.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60">IP addresses</label>
            <textarea
              value={ipsText}
              onChange={(e) => setIpsText(e.target.value)}
              rows={4}
              placeholder={'10.0.0.5\n192.168.1.0/24'}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
            />
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
