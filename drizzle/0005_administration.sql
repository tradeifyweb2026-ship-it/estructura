CREATE TABLE `access_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`default_days` integer
);
--> statement-breakpoint
CREATE TABLE `admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_invitations` (
	`email` text PRIMARY KEY NOT NULL,
	`access_until` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_login` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`access_until` integer,
	`suspended_until` integer
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `last_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `device` text DEFAULT 'Dispositivo anterior' NOT NULL;