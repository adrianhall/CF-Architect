-- Migration 0002: user_preferences table
--
-- Phase 02 — Identity, Access & Multi-User
--
-- Stores per-user UI preferences (theme, palette state, AI panel toggle).
-- Cascades on user delete so orphaned preference rows are never left behind.

CREATE TABLE user_preferences (
  user_id            TEXT    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme              TEXT    NOT NULL DEFAULT 'system'
                     CHECK (theme IN ('system', 'light', 'dark', 'high-contrast')),
  palette_state_json TEXT,                   -- JSON: array of collapsed category IDs
  ai_panel_enabled   INTEGER NOT NULL DEFAULT 1,
  updated_at         INTEGER NOT NULL        -- Unix ms
);
