/**
 * apps/worker/src/routes/me.ts
 *
 * Current-user profile and preferences endpoints.
 *
 *   GET  /api/me                — current user + session expiry
 *   GET  /api/me/preferences    — user preferences (defaults if not set)
 *   PUT  /api/me/preferences    — update theme, paletteState, aiPanelEnabled
 */

import { Hono } from "hono";
import type { AuthVariables } from "@adrianhall/cloudflare-auth";
import { zValidator } from "@hono/zod-validator";
import { ok, err } from "../lib/envelope.js";
import { getUserPreferences, setUserPreferences } from "../db/queries/index.js";
import { UpdateUserPreferencesInput } from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bindings = { DB: D1Database };
type Variables = AuthVariables & {
  requestId: string;
  userId: string;
  userRole: "user" | "admin";
  userExp: number;
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const me = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/me
 *
 * Returns the authenticated user's profile plus `exp` (Unix seconds from
 * the JWT) so the SPA can show a session-expiry warning without reading the
 * HttpOnly CF_Authorization cookie directly.
 */
me.get("/api/me", (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const userExp = c.get("userExp");
  const email = c.get("userEmail");

  if (!userId || !email) {
    return c.json(err("UNAUTHENTICATED", "Not authenticated", undefined, { requestId }), 401);
  }

  return c.json(
    ok(
      {
        id: userId,
        email,
        // name and avatarUrl are enriched by upsertUser; read from context via
        // the user row. For now these come from the JWT which doesn't carry them —
        // Phase 05 wires in profile editing.
        name: null as string | null,
        avatarUrl: null as string | null,
        role: userRole,
        exp: userExp,
      },
      { requestId },
    ),
    200,
  );
});

/**
 * GET /api/me/preferences
 *
 * Returns user preferences; creates and returns defaults if no row exists yet.
 */
me.get("/api/me/preferences", async (c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  const userId = c.get("userId");

  if (!userId) {
    return c.json(err("UNAUTHENTICATED", "Not authenticated", undefined, { requestId }), 401);
  }

  const prefs = await getUserPreferences({ d1: c.env.DB, userId });

  return c.json(
    ok(
      {
        userId: prefs.userId,
        theme: prefs.theme,
        paletteStateJson: prefs.paletteStateJson,
        aiPanelEnabled: prefs.aiPanelEnabled === 1,
        updatedAt: prefs.updatedAt,
      },
      { requestId },
    ),
    200,
  );
});

/**
 * PUT /api/me/preferences
 *
 * Updates the user's preferences (partial — unspecified fields unchanged).
 * Body is validated against UpdateUserPreferencesInput.
 */
me.put(
  "/api/me/preferences",
  zValidator("json", UpdateUserPreferencesInput, (result, c) => {
    if (!result.success) {
      const requestId = c.get("requestId") ?? crypto.randomUUID();
      return c.json(
        err("UNPROCESSABLE", "Invalid preferences", result.error.flatten(), { requestId }),
        422,
      );
    }
  }),
  async (c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const userId = c.get("userId");

    if (!userId) {
      return c.json(err("UNAUTHENTICATED", "Not authenticated", undefined, { requestId }), 401);
    }

    const body = c.req.valid("json");
    const prefs = await setUserPreferences({
      d1: c.env.DB,
      userId,
      ...(body.theme !== undefined && { theme: body.theme }),
      ...(body.paletteStateJson !== undefined && { paletteStateJson: body.paletteStateJson }),
      ...(body.aiPanelEnabled !== undefined && { aiPanelEnabled: body.aiPanelEnabled }),
    });

    return c.json(
      ok(
        {
          userId: prefs.userId,
          theme: prefs.theme,
          paletteStateJson: prefs.paletteStateJson,
          aiPanelEnabled: prefs.aiPanelEnabled === 1,
          updatedAt: prefs.updatedAt,
        },
        { requestId },
      ),
      200,
    );
  },
);

export default me;
