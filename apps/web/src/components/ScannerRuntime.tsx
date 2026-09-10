'use client';

import { useEffect } from 'react';
import { initializeScanner } from '../lib/scanner-runtime';

// Keep the proven scanner controllers during the framework migration. The
// server renders real JSX; this boundary owns camera, canvas and DOM events.
export default function ScannerRuntime({ apiUrl }: { apiUrl: string }) {
  useEffect(() => initializeScanner(apiUrl), [apiUrl]);
  return null;
}
