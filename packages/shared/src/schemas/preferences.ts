import { z } from "zod";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export const Theme = z.enum(["system", "light", "dark", "high-contrast"]);
export type Theme = z.infer<typeof Theme>;

// ---------------------------------------------------------------------------
// UserPreferences — persisted record
// ---------------------------------------------------------------------------

export const UserPreferences = z.object({
  userId: z.string(),
  theme: Theme,
  /**
   * JSON-serialised array of collapsed category IDs in the service palette.
   * Stored as a JSON string in D1; parsed to `string[] | null` here.
   */
  paletteStateJson: z.string().nullable(),
  aiPanelEnabled: z.boolean(),
  /** Unix milliseconds — last time preferences were updated. */
  updatedAt: z.number().int(),
});

export type UserPreferences = z.infer<typeof UserPreferences>;

// ---------------------------------------------------------------------------
// UpdateUserPreferencesInput — body for PUT /api/me/preferences
// ---------------------------------------------------------------------------

export const UpdateUserPreferencesInput = z.object({
  theme: Theme.optional(),
  paletteStateJson: z.string().nullable().optional(),
  aiPanelEnabled: z.boolean().optional(),
});

export type UpdateUserPreferencesInput = z.infer<typeof UpdateUserPreferencesInput>;
