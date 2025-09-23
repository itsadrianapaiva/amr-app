// Vitest shim for Next.js's "server-only" virtual module.
// This file lets unit tests import server files that include `import "server-only";`
// without Vite trying to resolve a real package.

// Intentionally empty. The presence of this module is all we need.
export {}; // no-op export to make TypeScript happy
