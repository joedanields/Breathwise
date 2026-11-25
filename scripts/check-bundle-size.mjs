#!/usr/bin/env node
/**
 * Fails when the initial JS + CSS (everything index.html loads up front) exceeds
 * the gzip budget in docs/IMPLEMENTATION_PLAN.md Phase 8 / ARCHITECTURE.md §7.
 * Lazy chunks and fonts (loaded on demand) are not counted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 200 * 1024;
const DIST = 'dist';

let html;
try {
  html = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const assetPattern = /<(?:script[^>]*\ssrc|link[^>]*\shref)="\/?(assets\/[^"]+\.(?:js|css))"/g;
const assets = [...new Set([...html.matchAll(assetPattern)].map((match) => match[1]))];

if (assets.length === 0) {
  console.error('No initial JS/CSS assets found in dist/index.html.');
  process.exit(1);
}

let totalGzip = 0;
for (const asset of assets) {
  const gzipBytes = gzipSync(readFileSync(join(DIST, asset))).length;
  totalGzip += gzipBytes;
  console.log(`${(gzipBytes / 1024).toFixed(1).padStart(8)} KB  ${asset}`);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`Initial load: ${kb(totalGzip)} gzip (budget ${kb(BUDGET_BYTES)})`);

if (totalGzip > BUDGET_BYTES) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}
