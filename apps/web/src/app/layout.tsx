import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-interface', display: 'swap' });

export const metadata: Metadata = {
  title: 'Metrology | Know your label',
  description: 'Read packaging with PaddleOCR and Tesseract, review the evidence, and save your inspection report.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#17684e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="light" className={manrope.variable} suppressHydrationWarning><body>{children}</body></html>;
}
