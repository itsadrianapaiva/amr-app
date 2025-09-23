import { describe, it, expect } from "vitest";
import { resolveOrCreateClient } from "../../../lib/invoicing/vendors/vendus/clients";

function core(list: any[] = [], created?: any) {
  return {
    request: ((() => {
      let calls = 0;
      return async (...args: any[]) => {
        // 1st call = GET /clients?email=...
        if (calls++ === 0) return list;
        // 2nd call = POST /clients (when none)
        return created || { id: 800 };
      };
    })()) as any,
    log: () => {},
  } as any;
}

describe("resolveOrCreateClient with email only", () => {
  it("picks exact email when single match", async () => {
    const c = core([{ id: 55, email: "jane@example.com", status: "active" }]);
    const id = await resolveOrCreateClient(c, { email: "jane@example.com" }, "tests");
    expect(id).toBe(55);
  });

  it("creates when no email match exists", async () => {
    const c = core([], { id: 801 });
    const id = await resolveOrCreateClient(c, { email: "new@example.com", name: "New User" }, "tests");
    expect(id).toBe(801);
  });
});
