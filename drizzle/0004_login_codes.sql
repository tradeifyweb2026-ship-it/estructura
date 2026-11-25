CREATE TABLE `login_codes` (
	`email_hash` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_codes_expiry` ON `login_codes` (`expires_at`);