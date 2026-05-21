import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import Footer from '@/components/Footer';
import NavBar from '@/components/NavBar';
import Providers from '@/components/Providers';
import './globals.css';

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
    <html lang="en">
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
                background: '#132f4c',
                color: '#fff',
                border: '1px solid #22d3ee',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
