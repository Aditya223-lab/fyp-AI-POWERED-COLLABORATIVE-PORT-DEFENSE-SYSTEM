import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Footer from '@/components/Footer';
import NavBar from '@/components/NavBar';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI-Powered Collaborative Port Defense System',
  description:
    'Real-time, privacy-preserving collaborative defense against port scanning attacks',
  keywords:
    'cybersecurity, port scanning, AI, federated learning, threat detection',
  authors: [{ name: 'AI Port Defense Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06101c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen">
        <Providers>
          <NavBar />
          <main className="pt-20">{children}</main>
          <Footer />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(10, 25, 41, 0.92)',
                backdropFilter: 'blur(12px)',
                color: '#fff',
                border: '1px solid rgba(34, 211, 238, 0.35)',
                boxShadow:
                  '0 0 24px rgba(34, 211, 238, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#34d399', secondary: '#06101c' },
              },
              error: {
                iconTheme: { primary: '#f43f5e', secondary: '#06101c' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
