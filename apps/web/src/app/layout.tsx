import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'National Legal Metrology AI Platform | DoCA SIH-26034',
  description: 'Package label scanning with Tesseract OCR and human review of uncertain readings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="light" suppressHydrationWarning><body>{children}</body></html>;
}
