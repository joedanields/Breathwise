// Import first in every entry point (SPA main.tsx, Pages Function).
// Zod 4 JIT-compiles parsers with `new Function` and probes for it; the probe is a
// CSP `script-src` violation in browsers and Workers forbid eval. Jitless mode
// skips both, so `script-src` never needs 'unsafe-eval' (SECURITY.md §4).
import { z } from 'zod';

z.config({ jitless: true });
