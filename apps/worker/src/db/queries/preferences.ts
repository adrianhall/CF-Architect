/**
 * apps/worker/src/db/queries/preferences.ts
 *
 * Query helpers for the `user_preferences` table.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { userPreferences } from "../schema.js";
import type { UserPreferencesRow } from "../schema.js";

export type { UserPreferencesRow };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DB = ReturnType<typeof drizzle>;

function db(d1: D1Database): DB {
  return drizzle(d1);
}

const DEFAULT_PREFERENCES = {
  theme: "system" as const,
  paletteStateJson: null,
  aiPanelEnabled: 1,
};

// ---------------------------------------------------------------------------
// getUserPreferences
// ---------------------------------------------------------------------------

/**
 * Returns the user's preferences, or sensible defaults if no row exists yet.
 * The defaults are **not** persisted — the row is created on the first PUT.
 */
export async function getUserPreferences(params: {
  d1: D1Database;
  userId: string;
}): Promise<UserPreferencesRow> {
  const { d1, userId } = params;
  const row = await db(d1)
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  if (row) return row;

  // Return defaults without persisting — avoids a write on every cold GET.
  return {
    userId,
    ...DEFAULT_PREFERENCES,
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// setUserPreferences
// ---------------------------------------------------------------------------

export interface SetUserPreferencesParams {
  d1: D1Database;
  userId: string;
  theme?: string;
  paletteStateJson?: string | null;
  aiPanelEnabled?: boolean;
}

export async function setUserPreferences(
  params: SetUserPreferencesParams,
): Promise<UserPreferencesRow> {
  const { d1, userId, theme, paletteStateJson, aiPanelEnabled } = params;
  const database = db(d1);
  const now = Date.now();

  // Fetch existing preferences (or defaults) to merge into.
  const existing = await getUserPreferences({ d1, userId });

  const updated: UserPreferencesRow = {
    userId,
    theme: theme ?? existing.theme,
    paletteStateJson: paletteStateJson !== undefined ? paletteStateJson : existing.paletteStateJson,
    aiPanelEnabled:
      aiPanelEnabled !== undefined ? (aiPanelEnabled ? 1 : 0) : existing.aiPanelEnabled,
    updatedAt: now,
  };

  await database
    .insert(userPreferences)
    .values(updated)
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        theme: updated.theme,
        paletteStateJson: updated.paletteStateJson,
        aiPanelEnabled: updated.aiPanelEnabled,
        updatedAt: now,
      },
    });

  return updated;
}
