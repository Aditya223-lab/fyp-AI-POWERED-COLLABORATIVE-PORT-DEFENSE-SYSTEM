'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import emailjs from '@emailjs/browser';
import toast from 'react-hot-toast';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

export default function ContactPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=' + encodeURIComponent('/contact'));
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-6 py-16 text-white/60">Loading…</div>
    );
  }
  if (!session?.user) return null;

  const emailjsConfigured = SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emailjsConfigured) {
      toast.error(
        'EmailJS is not configured. See docs/CONTACT_EMAILJS.md to set the three NEXT_PUBLIC_EMAILJS_* env vars.',
      );
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are both required.');
      return;
    }
    setSending(true);
    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          from_name: session!.user!.name || session!.user!.email || 'Anonymous',
          from_email: session!.user!.email || '',
          user_role: session!.user!.role,
          user_plan: session!.user!.plan,
          subject: subject.trim(),
          message: message.trim(),
        },
        { publicKey: PUBLIC_KEY },
      );
      toast.success('Message sent — thanks! We will get back to you soon.');
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('[contact] EmailJS send failed:', err);
      toast.error('Could not send. Please try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-2xl text-white">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
          <span className="text-gradient">Contact us</span>
        </h1>
        <p className="text-white/60">
          Send a message to the PortDefense team. You&apos;re signed in as{' '}
          <span className="text-white">{session.user.email}</span>.
        </p>
      </header>

      {!emailjsConfigured && (
        <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <strong>Heads up:</strong> EmailJS env vars are not set, so submitting
          this form will show an error toast. See{' '}
          <code className="bg-black/30 px-1 rounded">
            docs/CONTACT_EMAILJS.md
          </code>{' '}
          for the 5-minute setup.
        </div>
      )}

      <form onSubmit={onSubmit} className="glass rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">
              Your name
            </label>
            <input
              value={session.user.name || ''}
              readOnly
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white/80 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">
              Your email
            </label>
            <input
              value={session.user.email || ''}
              readOnly
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white/80 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="block text-xs uppercase tracking-wider text-white/50 mb-1">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            required
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-accent-cyan focus:outline-none"
            placeholder="What is this about?"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-xs uppercase tracking-wider text-white/50 mb-1">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={4000}
            required
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-accent-cyan focus:outline-none resize-y"
            placeholder="Tell us what's on your mind…"
          />
          <div className="mt-1 text-right text-xs text-white/40">
            {message.length} / 4000
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            Submissions are sent via EmailJS directly from your browser.
          </p>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </div>
  );
}
