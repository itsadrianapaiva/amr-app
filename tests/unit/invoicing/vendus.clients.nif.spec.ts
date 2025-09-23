import { describe, it, expect, vi } from "vitest";
import { resolveOrCreateClient } from "../../../lib/invoicing/vendors/vendus/clients";

function core(list: any[] = [], created?: any) {
  return {
    request: vi
      .fn()
      // GET /clients?fiscal_id=...
      .mockResolvedValueOnce(list)
      // POST /clients
      .mockResolvedValue(created || { id: 700 }),
    log: vi.fn(),
  } as any;
}

describe("resolveOrCreateClient with NIF", () => {
  it("picks exact NIF when multiple exist", async () => {
    const c = core([
      { id: 10, fiscal_id: "123456789", status: "active" },
      { id: 11, fiscal_id: "000000000", status: "active" },
    ]);
    const id = await resolveOrCreateClient(c, { fiscalId: "123456789", email: "x@y.z" }, "tests");
    expect(id).toBe(10);
  });

  it("creates a new client when none match", async () => {
    const c = core([], { id: 701 });
    const id = await resolveOrCreateClient(c, { fiscalId: "234567890", name: "Jane", email: "j@y.z" }, "tests");
    expect(id).toBe(701);
  });
});
