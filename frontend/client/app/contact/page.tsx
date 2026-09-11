'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { contactAPI, ApiError } from '@/lib/api';

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are both required.');
      return;
    }
    setSending(true);
    try {
      await contactAPI.send(subject.trim(), message.trim());
      toast.success('Message sent, thanks! We will get back to you soon.');
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('[contact] send failed:', err);
      if (err instanceof ApiError && err.status === 503) {
        toast.error('Contact mail is disabled on the server right now.');
      } else if (err instanceof ApiError && err.status === 401) {
        toast.error('Your session expired. Please sign in again.');
      } else {
        toast.error('Could not send. Please try again in a moment.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-2xl text-white">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
          <span className="text-gradient-animated">Contact us</span>
        </h1>
        <p className="text-white/60">
          Send a message to the PortDefense team. You&apos;re signed in as{' '}
          <span className="text-white">{session.user.email}</span>.
        </p>
      </header>

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
            Delivered securely through the PortDefense backend.
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
