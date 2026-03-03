-- 0001_auth_overhaul.sql
-- Removes the predictable seed user and all associated data, then adds an
-- is_admin flag to the users table. The first real user to authenticate
-- after this migration will be granted admin status by the application.

DELETE FROM `share_links` WHERE `created_by` = '00000000-0000-0000-0000-000000000000';
--> statement-breakpoint
DELETE FROM `diagrams` WHERE `owner_id` = '00000000-0000-0000-0000-000000000000';
--> statement-breakpoint
DELETE FROM `users` WHERE `id` = '00000000-0000-0000-0000-000000000000';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `is_admin` integer NOT NULL DEFAULT 0;
