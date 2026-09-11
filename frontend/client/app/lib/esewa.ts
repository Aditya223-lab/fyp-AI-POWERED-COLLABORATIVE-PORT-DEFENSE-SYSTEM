import crypto from 'crypto';

// eSewa ePay v2. Defaults are the public UAT/sandbox environment so checkout
// works out of the box; override all four via .env.local for production.
// Docs: https://developer.esewa.com.np/pages/Epay
export const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
export const ESEWA_SECRET_KEY =
  process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q'; // published UAT key
export const ESEWA_FORM_URL =
  process.env.ESEWA_FORM_URL ||
  'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
export const ESEWA_STATUS_URL =
  process.env.ESEWA_STATUS_URL ||
  'https://rc.esewa.com.np/api/epay/transaction/status/';

// Premium price in NPR, server-side only; never trust a client-sent amount.
export const PREMIUM_PRICE_NPR = Number(process.env.PREMIUM_PRICE_NPR || 999);

export function esewaSign(message: string): string {
  return crypto
    .createHmac('sha256', ESEWA_SECRET_KEY)
    .update(message)
    .digest('base64');
}

export interface EsewaCallbackData {
  transaction_code?: string;
  status?: string;
  total_amount?: string | number;
  transaction_uuid?: string;
  product_code?: string;
  signed_field_names?: string;
  signature?: string;
}

// eSewa redirects to success_url with ?data=<base64 JSON>. The JSON carries
// its own signature over the fields listed in signed_field_names (in order).
export function decodeEsewaCallback(dataB64: string): EsewaCallbackData | null {
  try {
    return JSON.parse(
      Buffer.from(dataB64, 'base64').toString('utf-8'),
    ) as EsewaCallbackData;
  } catch {
    return null;
  }
}

export function verifyEsewaCallbackSignature(data: EsewaCallbackData): boolean {
  if (!data.signed_field_names || !data.signature) return false;
  const message = data.signed_field_names
    .split(',')
    .map((f) => `${f}=${(data as Record<string, unknown>)[f] ?? ''}`)
    .join(',');
  const expected = Buffer.from(esewaSign(message));
  const received = Buffer.from(data.signature);
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

// eSewa formats amounts with thousands separators in callbacks ("1,000.0").
export function parseEsewaAmount(v: string | number | undefined): number {
  if (v === undefined) return NaN;
  if (typeof v === 'number') return v;
  return parseFloat(v.replace(/,/g, ''));
}

// Server-to-server confirmation with eSewa, the authoritative check.
export async function lookupEsewaStatus(
  transactionUuid: string,
  totalAmount: number,
): Promise<{ status?: string; ref_id?: string } | null> {
  const url =
    `${ESEWA_STATUS_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}` +
    `&total_amount=${encodeURIComponent(totalAmount)}` +
    `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { status?: string; ref_id?: string };
  } catch {
    return null;
  }
}
