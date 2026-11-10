import { describe, expect, it } from "vitest";
import { parseZones, zoneRewrites } from "./zones.mjs";

describe("parseZones", () => {
  it("treats a missing or empty value as no zones", () => {
    expect(parseZones(undefined)).toEqual({ data: [], error: null });
    expect(parseZones("")).toEqual({ data: [], error: null });
    expect(parseZones(" , ")).toEqual({ data: [], error: null });
  });

  it("reads comma-separated path=origin pairs and trims them", () => {
    expect(parseZones(" demo=https://zone-demo.vercel.app , notes=https://zone-notes.vercel.app/ ")).toEqual({
      data: [
        { path: "demo", origin: "https://zone-demo.vercel.app" },
        { path: "notes", origin: "https://zone-notes.vercel.app" },
      ],
      error: null,
    });
  });

  it.each([
    ["demo", "not a path=origin pair"],
    ["=https://zone-demo.vercel.app", "not a path=origin pair"],
    ["Demo=https://zone-demo.vercel.app", "one lowercase segment"],
    ["demo/sub=https://zone-demo.vercel.app", "one lowercase segment"],
    ["_next=https://zone-demo.vercel.app", "one lowercase segment"],
    ["demo=http://zone-demo.vercel.app", "https URL"],
    ["demo=zone-demo.vercel.app", "https URL"],
    ["demo=https://zone-demo.vercel.app/demo", "path, query or hash"],
    ["demo=https://zone-demo.vercel.app?x=1", "path, query or hash"],
    ["demo=https://a.vercel.app,demo=https://b.vercel.app", "listed twice"],
  ])("refuses %s", (value, message) => {
    const result = parseZones(value);
    expect(result.data).toBeNull();
    expect(result.error).toContain(message);
  });
});

describe("zoneRewrites", () => {
  it("sends a zone's root and everything under it to the zone's own basePath", () => {
    expect(zoneRewrites([{ path: "demo", origin: "https://zone-demo.vercel.app" }])).toEqual([
      { source: "/demo", destination: "https://zone-demo.vercel.app/demo" },
      { source: "/demo/:path+", destination: "https://zone-demo.vercel.app/demo/:path+" },
    ]);
  });

  it("writes nothing when there are no zones", () => {
    expect(zoneRewrites([])).toEqual([]);
  });
});
