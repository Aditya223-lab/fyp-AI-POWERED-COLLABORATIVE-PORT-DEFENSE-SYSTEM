import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'payments.json');

export interface PaymentRecord {
  email: string;
  amountNpr: number;
  gateway: 'esewa';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  transactionCode?: string;
}

type Store = { [transactionUuid: string]: PaymentRecord };

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

export function createPayment(
  transactionUuid: string,
  email: string,
  amountNpr: number,
) {
  const store = load();
  store[transactionUuid] = {
    email: email.toLowerCase(),
    amountNpr,
    gateway: 'esewa',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  save(store);
}

export function getPayment(transactionUuid: string): PaymentRecord | null {
  return load()[transactionUuid] ?? null;
}

export function completePayment(
  transactionUuid: string,
  transactionCode?: string,
): boolean {
  const store = load();
  const rec = store[transactionUuid];
  if (!rec) return false;
  rec.status = 'completed';
  rec.completedAt = new Date().toISOString();
  if (transactionCode) rec.transactionCode = transactionCode;
  save(store);
  return true;
}
