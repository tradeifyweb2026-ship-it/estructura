CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`user_id` text NOT NULL,
	`trade_id` text NOT NULL,
	`slot` text NOT NULL,
	`object_key` text NOT NULL,
	`revision` text NOT NULL,
	PRIMARY KEY(`user_id`, `trade_id`, `slot`),
	FOREIGN KEY (`user_id`,`trade_id`) REFERENCES `trades`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`user_id` text NOT NULL,
	`week` text NOT NULL,
	`scope` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `week`, `scope`)
);
--> statement-breakpoint
CREATE TABLE `setups` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`opened_at` integer NOT NULL,
	`account_id` text,
	`setup_id` text,
	`import_key` text,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`account_id`) REFERENCES `accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`setup_id`) REFERENCES `setups`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trades_user_opened` ON `trades` (`user_id`,`opened_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `trades_user_import` ON `trades` (`user_id`,`import_key`);