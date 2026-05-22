import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requireAdmin } from "./require-admin.js";

function makeApp(role: string | undefined) {
  const app = new Hono();
  app.use("*", (c, next) => {
    if (role !== undefined) c.set("userRole", role as "user" | "admin");
    return next();
  });
  app.get("/admin", requireAdmin, (c) => c.json({ ok: true }));
  return app;
}

describe("requireAdmin middleware", () => {
  it("passes through when userRole is admin", async () => {
    const res = await makeApp("admin").request("http://localhost/admin");
    expect(res.status).toBe(200);
  });

  it("returns 403 FORBIDDEN when userRole is user", async () => {
    const res = await makeApp("user").request("http://localhost/admin");
    expect(res.status).toBe(403);
    const body = await res.json<{ ok: boolean; error: { code: string } }>();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 FORBIDDEN when userRole is undefined", async () => {
    const res = await makeApp(undefined).request("http://localhost/admin");
    expect(res.status).toBe(403);
  });
});
