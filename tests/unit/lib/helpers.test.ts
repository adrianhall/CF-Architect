import { describe, it, expect } from "vitest";
import { generateId, nowISO, jsonResponse, parseIntParam } from "@lib/helpers";

describe("generateId", () => {
  it("returns a valid UUID v4 format", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns unique values on successive calls", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

describe("nowISO", () => {
  it("returns an ISO 8601 datetime string", () => {
    const iso = nowISO();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns approximately the current time", () => {
    const before = Date.now();
    const iso = nowISO();
    const after = Date.now();
    const ts = new Date(iso).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe("jsonResponse", () => {
  it("sets the Content-Type header to application/json", () => {
    const res = jsonResponse({ hello: "world" });
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("serializes the body as JSON", async () => {
    const data = { count: 42, items: ["a", "b"] };
    const res = jsonResponse(data);
    const body = await res.json();
    expect(body).toEqual(data);
  });

  it("defaults to HTTP status 200", () => {
    const res = jsonResponse({});
    expect(res.status).toBe(200);
  });

  it("accepts a custom HTTP status code", () => {
    const res = jsonResponse({ error: "not found" }, 404);
    expect(res.status).toBe(404);
  });
});

describe("parseIntParam", () => {
  it("returns fallback when value is null", () => {
    expect(parseIntParam(null, 1)).toBe(1);
  });

  it("returns parsed integer for a valid numeric string", () => {
    expect(parseIntParam("42", 1)).toBe(42);
  });

  it("returns fallback for a non-numeric string", () => {
    expect(parseIntParam("abc", 20)).toBe(20);
  });

  it("returns fallback for an empty string", () => {
    expect(parseIntParam("", 10)).toBe(10);
  });

  it("returns 0 for the string '0' (not the fallback)", () => {
    expect(parseIntParam("0", 20)).toBe(0);
  });

  it("truncates decimal strings via parseInt behaviour", () => {
    expect(parseIntParam("3.7", 1)).toBe(3);
  });

  it("parses leading digits from a mixed string", () => {
    expect(parseIntParam("42abc", 1)).toBe(42);
  });
});
