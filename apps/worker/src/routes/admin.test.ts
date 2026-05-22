import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import { devAuthHeaders, seedUser } from "../../test/auth-helper.js";

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  it("returns 200 paginated list for admin users", async () => {
    const adminEmail = `admin-list-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email: adminEmail, role: "admin" });
    const headers = await devAuthHeaders(adminEmail);

    const res = await SELF.fetch("http://localhost/api/admin/users", { headers });
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { users: unknown[]; total: number; page: number; limit: number };
    }>();
    expect(body.ok).toBe(true);
    expect(typeof body.data.total).toBe("number");
    expect(Array.isArray(body.data.users)).toBe(true);
  });

  it("returns 403 for non-admin users", async () => {
    const userEmail = `nonAdmin-list-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email: userEmail, role: "user" });
    const headers = await devAuthHeaders(userEmail);

    const res = await SELF.fetch("http://localhost/api/admin/users", { headers });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/users/:id/role", () => {
  it("promotes a user to admin and writes an audit entry", async () => {
    const adminEmail = `admin-promote-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const targetEmail = `target-promote-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const admin = await seedUser({ email: adminEmail, role: "admin" });
    const target = await seedUser({ email: targetEmail, role: "user" });
    const headers = await devAuthHeaders(adminEmail, admin.sub);

    const res = await SELF.fetch(`http://localhost/api/admin/users/${target.sub}/role`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json<{ ok: boolean; data: { role: string } }>();
    expect(body.data.role).toBe("admin");

    // Verify audit entry exists
    const auditRes = await SELF.fetch("http://localhost/api/admin/audit", { headers });
    const auditBody = await auditRes.json<{
      ok: boolean;
      data: { entries: { action: string; targetId: string }[] };
    }>();
    expect(
      auditBody.data.entries.some((e) => e.action === "promote" && e.targetId === target.sub),
    ).toBe(true);
  });

  it("returns 403 when trying to change own role", async () => {
    const adminEmail = `admin-self-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const admin = await seedUser({ email: adminEmail, role: "admin" });
    const headers = await devAuthHeaders(adminEmail, admin.sub);

    const res = await SELF.fetch(`http://localhost/api/admin/users/${admin.sub}/role`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/users/:id", () => {
  it("deletes a user and returns 204", async () => {
    const adminEmail = `admin-del-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const targetEmail = `target-del-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const admin = await seedUser({ email: adminEmail, role: "admin" });
    const target = await seedUser({ email: targetEmail, role: "user" });
    const headers = await devAuthHeaders(adminEmail, admin.sub);

    const res = await SELF.fetch(`http://localhost/api/admin/users/${target.sub}`, {
      method: "DELETE",
      headers,
    });
    expect(res.status).toBe(204);
  });

  it("returns 403 when trying to delete own account", async () => {
    const adminEmail = `admin-del-self-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const admin = await seedUser({ email: adminEmail, role: "admin" });
    const headers = await devAuthHeaders(adminEmail, admin.sub);

    const res = await SELF.fetch(`http://localhost/api/admin/users/${admin.sub}`, {
      method: "DELETE",
      headers,
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit
// ---------------------------------------------------------------------------

describe("GET /api/admin/audit", () => {
  it("returns paginated audit entries for admins", async () => {
    const adminEmail = `admin-audit-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await seedUser({ email: adminEmail, role: "admin" });
    const headers = await devAuthHeaders(adminEmail);

    const res = await SELF.fetch("http://localhost/api/admin/audit", { headers });
    expect(res.status).toBe(200);

    const body = await res.json<{
      ok: boolean;
      data: { entries: unknown[]; total: number };
    }>();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data.entries)).toBe(true);
  });
});
