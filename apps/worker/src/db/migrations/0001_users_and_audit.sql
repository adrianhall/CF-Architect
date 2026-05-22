-- Migration 0001: users and admin_audit tables
--
-- Phase 02 — Identity, Access & Multi-User
--
-- users.id is the Cloudflare Access sub claim (stable across sessions).
-- admin_audit.target_id is NOT a foreign key intentionally: a deleted user's
-- audit rows must be preserved for compliance purposes.

CREATE TABLE users (
  id            TEXT    PRIMARY KEY,          -- Cloudflare Access sub claim
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT,
  avatar_url    TEXT,
  role          TEXT    NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin')),
  created_at    INTEGER NOT NULL,             -- Unix ms
  last_login_at INTEGER NOT NULL
);

CREATE TABLE admin_audit (
  id           TEXT    PRIMARY KEY,
  actor_id     TEXT    NOT NULL REFERENCES users(id),
  action       TEXT    NOT NULL              -- 'promote' | 'demote' | 'delete'
               CHECK (action IN ('promote', 'demote', 'delete')),
  target_id    TEXT    NOT NULL,
  payload_json TEXT,
  at           INTEGER NOT NULL              -- Unix ms
);
