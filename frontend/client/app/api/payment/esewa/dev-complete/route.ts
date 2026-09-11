import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { setUserPlan } from '@/lib/userStore';
import { createPayment, completePayment } from '@/lib/paymentStore';
import { PREMIUM_PRICE_NPR } from '@/lib/esewa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DEV ONLY, simulates a completed eSewa payment so the Premium upgrade flow
// can be demoed when eSewa's UAT sandbox is misbehaving (the reCAPTCHA on its
// /auth page hangs, or the form endpoint returns random 400s). It runs the same
// upgrade logic as a real verified payment (records a completed payment + sets
// the account to premium) but skips eSewa entirely.
//
// Hard-disabled in production builds: returns 404 so the route effectively does
// not exist once NODE_ENV === 'production'.
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const email = session.user.email;
  const transactionUuid = crypto.randomUUID();
  const transactionCode = `DEV-${transactionUuid.slice(0, 8).toUpperCase()}`;

  // Mirror the real flow: record the intent, mark it complete, upgrade the plan.
  createPayment(transactionUuid, email, PREMIUM_PRICE_NPR);
  completePayment(transactionUuid, transactionCode);
  setUserPlan(email, 'premium');

  return NextResponse.json({
    ok: true,
    status: 'COMPLETE',
    transaction_id: transactionCode,
    amount: PREMIUM_PRICE_NPR,
    dev: true,
  });
}
