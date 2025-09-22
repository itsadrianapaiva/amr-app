// Secret needed by signed-links tests
import { vi } from "vitest";
vi.stubEnv("INVOICING_LINK_SECRET", "test_secret_at_least_24_chars");

// JSX/React shim for .tsx tested in Node envs that import jsx-runtime implicitly
vi.mock("react", () => ({}));
vi.mock("react/jsx-runtime", () => ({
  jsx: () => null,
  jsxs: () => null,
  Fragment: "fragment",
}));
