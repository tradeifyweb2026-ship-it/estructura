CREATE TABLE `asset_aliases` (
	`user_id` text NOT NULL,
	`alias` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `alias`),
	FOREIGN KEY (`user_id`,`asset_id`) REFERENCES `asset_catalog`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_aliases_owner_asset` ON `asset_aliases` (`user_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `asset_catalog` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_catalog_owner_name` ON `asset_catalog` (`user_id`,`name_key`);--> statement-breakpoint
CREATE INDEX `asset_catalog_owner_recent` ON `asset_catalog` (`user_id`,`last_used_at`,`id`);
--> statement-breakpoint
CREATE TRIGGER asset_catalog_revision_insert AFTER INSERT ON asset_catalog BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES(new.user_id,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;

--> statement-breakpoint
CREATE TRIGGER asset_catalog_revision_update AFTER UPDATE ON asset_catalog BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES(new.user_id,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;

--> statement-breakpoint
CREATE TRIGGER asset_catalog_revision_delete AFTER DELETE ON asset_catalog WHEN EXISTS(SELECT 1 FROM users WHERE user_id=old.user_id) BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES(old.user_id,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;

--> statement-breakpoint
CREATE INDEX trades_owner_market ON trades(user_id,json_extract(data,'$.market.id'),opened_at);
