import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ['@metrology/core'],
  turbopack: { root },
  outputFileTracingRoot: root,
};
