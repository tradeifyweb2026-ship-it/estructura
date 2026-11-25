CREATE TABLE `public_trade_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trade_id` text NOT NULL,
	`account_id` text,
	`token_hash` text NOT NULL,
	`snapshot` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`trade_id`) REFERENCES `trades`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`account_id`) REFERENCES `accounts`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "public_shares_lifetime" CHECK("public_trade_shares"."expires_at"="public_trade_shares"."created_at"+2592000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_shares_token` ON `public_trade_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `public_shares_owner_trade` ON `public_trade_shares` (`user_id`,`trade_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `public_shares_owner_expiry` ON `public_trade_shares` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `public_shares_expiry` ON `public_trade_shares` (`expires_at`,`id`);--> statement-breakpoint
CREATE TRIGGER public_shares_quota_insert BEFORE INSERT ON public_trade_shares
WHEN (SELECT count(*) FROM public_trade_shares WHERE user_id=new.user_id AND expires_at>new.created_at)>=100
BEGIN SELECT RAISE(ABORT,'public_share_quota'); END;
--> statement-breakpoint
CREATE TRIGGER public_shares_frozen BEFORE UPDATE ON public_trade_shares
BEGIN SELECT RAISE(ABORT,'public_share_frozen'); END;
