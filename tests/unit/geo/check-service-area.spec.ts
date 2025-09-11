import { describe, it, expect, vi } from "vitest"
import { checkServiceArea, type CheckServiceAreaParams } from "@/lib/geo/check-service-area"

// Helpers to keep tests tiny and DRY
const baseParams = (over: Partial<CheckServiceAreaParams> = {}): CheckServiceAreaParams => ({
  deliverySelected: true,
  pickupSelected: false,
  siteAddress: "Faro, Portugal",
  ...over,
})

describe("checkServiceArea (server helper)", () => {
  it("skips when geofence disabled", async () => {
    const geocode = vi.fn()
    const res = await checkServiceArea(baseParams(), { enable: false, geocode })
    expect(res).toBeNull()
    expect(geocode).not.toHaveBeenCalled()
  })

  it("skips when neither delivery nor pickup selected", async () => {
    const geocode = vi.fn()
    const res = await checkServiceArea(
      baseParams({ deliverySelected: false, pickupSelected: false }),
      { enable: true, geocode }
    )
    expect(res).toBeNull()
    expect(geocode).not.toHaveBeenCalled()
  })

  it("requires site address when delivery or pickup selected", async () => {
    const geocode = vi.fn()
    const res = await checkServiceArea(
      baseParams({ siteAddress: "" }),
      { enable: true, geocode }
    )
    expect(res).toMatch(/enter the site address/i)
    expect(geocode).not.toHaveBeenCalled()
  })

  it("handles geocoder exceptions with friendly message", async () => {
    const geocode = vi.fn().mockRejectedValue(new Error("boom"))
    const res = await checkServiceArea(baseParams(), { enable: true, geocode })
    expect(res).toMatch(/temporarily unavailable/i)
  })

  it("returns friendly message when geocoder finds nothing", async () => {
    const geocode = vi.fn().mockResolvedValue(null)
    const res = await checkServiceArea(baseParams(), { enable: true, geocode })
    expect(res).toMatch(/could not locate/i)
  })

  it("returns null when address is inside service area", async () => {
    // Faro-ish → inside (<= -7.90 east cutoff)
    const geocode = vi.fn().mockResolvedValue({ lat: 37.02, lng: -7.92 })
    const res = await checkServiceArea(baseParams(), { enable: true, geocode })
    expect(res).toBeNull()
  })

  it("returns message when address is outside service area", async () => {
    // Olhão-ish → outside (> -7.90)
    const geocode = vi.fn().mockResolvedValue({ lat: 37.03, lng: -7.80 })
    const res = await checkServiceArea(baseParams(), { enable: true, geocode })
    expect(res).toMatch(/outside our current service area/i)
  })

  it("passes sensible geocoder options (PT bias & proximity)", async () => {
    const recorded: any[] = []
    const geocode = vi.fn().mockImplementation(async (_addr: string, opts: any) => {
      recorded.push(opts)
      return { lat: 37.02, lng: -7.92 } // inside
    })
    const res = await checkServiceArea(baseParams(), { enable: true, geocode })
    expect(res).toBeNull()
    // Assert we nudge geocoder correctly without locking to exact structure
    expect(recorded[0].country).toBe("pt")
    expect(recorded[0].language).toBe("pt")
    expect(recorded[0].limit).toBe(1)
    expect(recorded[0].proximity).toBeDefined()
  })
})
