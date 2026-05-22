import { describe, it, expect } from "vitest";
import { ok, err } from "./envelope.js";
import { ApiSuccessResponse, ApiErrorResponse, ErrorCode } from "@cf-architect/shared";
import { z } from "zod";

describe("ok()", () => {
  it("produces a valid ApiSuccessResponse shape", () => {
    const result = ok({ status: "ok" }, { requestId: "req_test" });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ status: "ok" });
    expect(result.meta).toEqual({ requestId: "req_test" });

    // Validate against the shared Zod schema
    const parsed = ApiSuccessResponse(z.object({ status: z.string() })).parse(result);
    expect(parsed.ok).toBe(true);
  });

  it("passes through arbitrary data shapes", () => {
    const data = { foo: 1, bar: [true, false], baz: { nested: "value" } };
    const result = ok(data, { requestId: "req_123" });
    expect(result.data).toEqual(data);
  });
});

describe("err()", () => {
  it("produces a valid ApiErrorResponse shape", () => {
    const result = err("NOT_FOUND", "Route not found");

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toBe("Route not found");
    expect(result.error.details).toBeUndefined();

    // Validate against the shared Zod schema
    const parsed = ApiErrorResponse.parse(result);
    expect(parsed.ok).toBe(false);
  });

  it("includes optional details when provided", () => {
    const details = { field: "email", issue: "invalid format" };
    const result = err("UNPROCESSABLE", "Validation failed", details);

    expect(result.error.details).toEqual(details);

    const parsed = ApiErrorResponse.parse(result);
    expect(parsed.error.details).toEqual(details);
  });

  it("includes optional meta when provided", () => {
    const result = err("INTERNAL", "Unexpected error", undefined, {
      requestId: "req_abc",
    });

    expect(result.meta?.requestId).toBe("req_abc");
  });

  it("produces a valid error for every ErrorCode value", () => {
    for (const code of ErrorCode.options) {
      const result = err(code, `Test: ${code}`);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(code);
      expect(() => ApiErrorResponse.parse(result)).not.toThrow();
    }
  });
});
