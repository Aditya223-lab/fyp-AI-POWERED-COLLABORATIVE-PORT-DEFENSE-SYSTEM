import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { setUserPlan } from '@/lib/userStore';
import { completePayment, getPayment } from '@/lib/paymentStore';
import {
  ESEWA_PRODUCT_CODE,
  decodeEsewaCallback,
  lookupEsewaStatus,
  parseEsewaAmount,
  verifyEsewaCallbackSignature,
} from '@/lib/esewa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verifies the ?data= payload eSewa redirected back with. A payment only
// upgrades the account when ALL of these hold:
//   1. the callback signature is valid (HMAC with the merchant secret)
//   2. we initiated this transaction_uuid and it belongs to the session user
//   3. the paid amount matches the price we quoted at initiate time
//   4. eSewa's status API confirms COMPLETE (authoritative, server-to-server)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { data?: string } | null;
  if (!body?.data) {
    return NextResponse.json({ error: 'missing_data' }, { status: 400 });
  }

  const data = decodeEsewaCallback(body.data);
  if (!data?.transaction_uuid) {
    return NextResponse.json({ error: 'invalid_data' }, { status: 400 });
  }
  if (!verifyEsewaCallbackSignature(data)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  if (data.product_code !== ESEWA_PRODUCT_CODE) {
    return NextResponse.json({ error: 'product_code_mismatch' }, { status: 400 });
  }

  const record = getPayment(data.transaction_uuid);
  if (!record) {
    return NextResponse.json({ error: 'unknown_transaction' }, { status: 400 });
  }
  if (record.email !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'transaction_owner_mismatch' }, { status: 403 });
  }
  if (record.status === 'completed') {
    // Replay of an already-verified payment (e.g. page refresh), harmless.
    return NextResponse.json({ ok: true, status: 'COMPLETE', alreadyVerified: true });
  }

  const paidAmount = parseEsewaAmount(data.total_amount);
  if (!Number.isFinite(paidAmount) || paidAmount !== record.amountNpr) {
    return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
  }
  if (data.status !== 'COMPLETE') {
    return NextResponse.json({ ok: false, status: data.status ?? 'Unknown' });
  }

  // Never trust the redirect alone, confirm with eSewa directly.
  const lookup = await lookupEsewaStatus(data.transaction_uuid, record.amountNpr);
  if (lookup?.status !== 'COMPLETE') {
    return NextResponse.json(
      { error: 'esewa_status_check_failed', status: lookup?.status ?? 'unreachable' },
      { status: 502 },
    );
  }

  completePayment(data.transaction_uuid, data.transaction_code);
  setUserPlan(record.email, 'premium');
  return NextResponse.json({
    ok: true,
    status: 'COMPLETE',
    transaction_id: data.transaction_code,
    amount: record.amountNpr,
  });
}
