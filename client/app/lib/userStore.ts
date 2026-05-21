import fs from 'fs';
import path from 'path';
import type { Plan } from '@/types/next-auth';

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'users.json');

type Record = { plan: Plan; upgradedAt?: string };
type Store = { [email: string]: Record };

function load(): Store {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

export function getUserPlan(email: string | null | undefined): Plan {
  if (!email) return 'free';
  return load()[email.toLowerCase()]?.plan ?? 'free';
}

export function setUserPlan(email: string, plan: Plan) {
  const store = load();
  store[email.toLowerCase()] = { plan, upgradedAt: new Date().toISOString() };
  save(store);
}

export interface CustomerEntry {
  email: string;
  plan: Plan;
  upgradedAt?: string;
}

export function listUsers(): CustomerEntry[] {
  const store = load();
  return Object.entries(store)
    .map(([email, rec]) => ({ email, plan: rec.plan, upgradedAt: rec.upgradedAt }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function deleteUser(email: string): boolean {
  const store = load();
  const key = email.toLowerCase();
  if (!(key in store)) return false;
  delete store[key];
  save(store);
  return true;
}
