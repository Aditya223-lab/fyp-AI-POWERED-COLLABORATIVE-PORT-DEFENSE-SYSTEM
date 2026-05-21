'use client';

import { useEffect, useRef, useState } from 'react';
import { SSE_URL } from '@/lib/api';
import type { ThreatEvent } from '@/types';

export type StreamStatus = 'connecting' | 'open' | 'closed';

export function useThreatStream(max = 30) {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [eventCount, setEventCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.addEventListener('hello', () => setStatus('open'));

    es.addEventListener('threat', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ThreatEvent;
        data.timestamp = new Date(data.timestamp);
        setThreats((prev) => [data, ...prev].slice(0, max));
        setEventCount((c) => c + 1);
      } catch {
        /* ignore malformed payloads */
      }
    });

    es.onerror = () => setStatus('closed');

    return () => {
      es.close();
      esRef.current = null;
      setStatus('closed');
    };
  }, [max]);

  return { threats, status, eventCount };
}
