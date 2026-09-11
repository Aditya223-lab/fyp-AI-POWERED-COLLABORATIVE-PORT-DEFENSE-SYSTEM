import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Plan } from '@/types/next-auth';

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'users.json');

// passwordHash format: scrypt$<salt-hex>$<hash-hex>
type Record = { plan: Plan; upgradedAt?: string; passwordHash?: string };
type Store = { [email: string]: Record };

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

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
  const key = email.toLowerCase();
  // Merge so an existing passwordHash survives plan changes.
  store[key] = { ...store[key], plan, upgradedAt: new Date().toISOString() };
  save(store);
}

export function setUserPassword(email: string, password: string) {
  const store = load();
  const key = email.toLowerCase();
  store[key] = {
    ...store[key],
    plan: store[key]?.plan ?? 'free',
    passwordHash: hashPassword(password),
  };
  save(store);
}

// Returns the customer's plan on success, null on unknown email / no
// password set / wrong password.
export function verifyUserCredentials(
  email: string,
  password: string,
): { email: string; plan: Plan } | null {
  const key = email.toLowerCase();
  const rec = load()[key];
  if (!rec?.passwordHash) return null;
  if (!verifyPassword(password, rec.passwordHash)) return null;
  return { email: key, plan: rec.plan };
}

export interface CustomerEntry {
  email: string;
  plan: Plan;
  upgradedAt?: string;
  hasPassword: boolean;
}

export function listUsers(): CustomerEntry[] {
  const store = load();
  return Object.entries(store)
    .map(([email, rec]) => ({
      email,
      plan: rec.plan,
      upgradedAt: rec.upgradedAt,
      hasPassword: Boolean(rec.passwordHash),
    }))
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
