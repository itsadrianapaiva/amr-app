import { vi } from "vitest";

// Secrets needed by signed-links tests
vi.stubEnv("INVOICING_LINK_SECRET", "test_secret_at_least_24_chars");

// --- React shims ---
// Provide BOTH a module mock and a global React for classic JSX builds.
const ReactShim = {
  createElement: () => null,
  Fragment: "fragment",
};

// Mock "react" module (default + named exports)
vi.mock("react", () => ({
  default: ReactShim,
  createElement: ReactShim.createElement,
  Fragment: ReactShim.Fragment,
}));

// Mock the automatic runtime too, for files compiled with react-jsx
vi.mock("react/jsx-runtime", () => ({
  jsx: () => null,
  jsxs: () => null,
  Fragment: "fragment",
}));

// Also set a global so classic-transformed TSX that references global React won't crash
// (TypeScript "jsx": "react")
(globalThis as any).React = ReactShim;
