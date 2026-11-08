// Must be the first import in main.tsx: parts of the Solana stack expect
// Node globals (Buffer/global) that browsers don't provide.

import { Buffer } from "buffer"

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer; global?: unknown }

if (!g.Buffer) g.Buffer = Buffer
if (!g.global) g.global = globalThis
