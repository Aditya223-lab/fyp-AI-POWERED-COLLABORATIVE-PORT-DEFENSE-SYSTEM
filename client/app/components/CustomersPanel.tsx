'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { orgAPI } from '@/lib/api';
import type { CustomerRecord, Organization } from '@/types';

interface Props {
  orgs: Organization[];
  // Called after any mutation that affects orgs — parent should re-fetch
  // from the backend, NOT trust optimistic local state.
  onOrgsChanged: () => void;
}

const planBadge: Record<string, string> = {
  premium: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40',
  free: 'bg-white/10 text-white/60 border-white/20',
};

export default function CustomersPanel({ orgs, onOrgsChanged }: Props) {
  const [users, setUsers] = useState<CustomerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState<'free' | 'premium'>('premium');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CustomerRecord[];
      setUsers(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load users');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upsert(email: string, plan: 'free' | 'premium') {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  }

  async function remove(email: string) {
    const res = await fetch(
      `/api/admin/users?email=${encodeURIComponent(email)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Email required');
      return;
    }
    setSubmitting(true);
    try {
      await upsert(newEmail.trim(), newPlan);
      toast.success(`${newEmail} → ${newPlan}`);
      setNewEmail('');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePlan(u: CustomerRecord) {
    const next = u.plan === 'premium' ? 'free' : 'premium';
    try {
      await upsert(u.email, next);
      toast.success(`${u.email} → ${next}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan');
    }
  }

  async function handleRemove(u: CustomerRecord) {
    try {
      await remove(u.email);
      // Backend orgs that referenced this owner are not auto-cleared — we
      // surface that in the UI by simply leaving ownerEmail intact. The admin
      // can reassign.
      toast.success(`Removed ${u.email}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove user');
    }
  }

  async function handleAssignOrg(email: string, orgId: string) {
    try {
      await orgAPI.setOwner(orgId, email || null);
      onOrgsChanged();
      toast.success('Org owner updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign org');
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">Customers</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Manage signed-up users. Mark someone Premium after Khalti confirms
            payment (or manually until Khalti is wired up).
          </p>
        </div>
        {users && (
          <span className="text-xs text-white/50">
            {users.length} user{users.length === 1 ? '' : 's'} ·{' '}
            {users.filter((u) => u.plan === 'premium').length} premium
          </span>
        )}
      </div>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 bg-white/[0.02]"
      >
        <input
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="user@example.com"
          type="email"
          className="col-span-12 sm:col-span-6 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
        />
        <select
          value={newPlan}
          onChange={(e) => setNewPlan(e.target.value as 'free' | 'premium')}
          className="col-span-6 sm:col-span-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm appearance-none"
        >
          <option value="free" className="bg-primary-dark">free</option>
          <option value="premium" className="bg-primary-dark">premium</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="col-span-6 sm:col-span-3 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : '+ Add / upgrade'}
        </button>
      </form>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          {error.includes('403')
            ? 'Forbidden — admin access required.'
            : `Failed to load: ${error}`}
        </div>
      )}

      <div className="divide-y divide-white/5">
        {users?.map((u) => {
          const ownedOrgs = orgs.filter(
            (o) => o.ownerEmail?.toLowerCase() === u.email.toLowerCase(),
          );
          return (
            <div
              key={u.email}
              className="px-6 py-4 grid grid-cols-12 gap-3 items-center hover:bg-white/5"
            >
              <div className="col-span-12 sm:col-span-4">
                <p className="font-medium truncate">{u.email}</p>
                {u.upgradedAt && (
                  <p className="text-[11px] text-white/40">
                    updated {new Date(u.upgradedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="col-span-3 sm:col-span-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${planBadge[u.plan]}`}
                >
                  {u.plan}
                </span>
              </div>
              <div className="col-span-9 sm:col-span-4">
                {u.plan === 'premium' ? (
                  <select
                    value=""
                    onChange={(e) =>
                      e.target.value && handleAssignOrg(u.email, e.target.value)
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs appearance-none"
                  >
                    <option value="" className="bg-primary-dark">
                      {ownedOrgs.length > 0
                        ? `owns: ${ownedOrgs.map((o) => o.name).join(', ')}`
                        : 'assign org…'}
                    </option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id} className="bg-primary-dark">
                        → {o.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-white/40">
                    upgrade to assign orgs
                  </span>
                )}
              </div>
              <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => handleTogglePlan(u)}
                  className="text-accent-cyan hover:underline"
                >
                  {u.plan === 'premium' ? 'Downgrade' : 'Upgrade'}
                </button>
                <button
                  onClick={() => handleRemove(u)}
                  className="text-red-300/70 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {users && users.length === 0 && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No customers yet. Add the first one above.
          </div>
        )}
        {!users && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            Loading customers…
          </div>
        )}
      </div>
    </div>
  );
}
