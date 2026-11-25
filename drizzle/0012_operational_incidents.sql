CREATE TABLE `operational_incidents` (
	`code` text PRIMARY KEY NOT NULL,
	`first_at` integer NOT NULL,
	`last_at` integer NOT NULL,
	`observations` integer DEFAULT 1 NOT NULL
);
