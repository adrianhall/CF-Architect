-- Migration 0000: init
--
-- Phase 01 bootstrap migration. Establishes the Drizzle migrations
-- infrastructure without creating any application tables.
-- Application tables (users, diagrams, shares, etc.) are added in Phase 02+.

-- SQLite requires at least one statement; this is a no-op sentinel.
SELECT 1;
