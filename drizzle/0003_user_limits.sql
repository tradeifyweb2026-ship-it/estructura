CREATE TABLE `user_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`trades` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER quota_trades AFTER INSERT ON trades
WHEN (SELECT COUNT(*) FROM trades WHERE user_id=NEW.user_id) > COALESCE((SELECT trades FROM user_limits WHERE user_id=NEW.user_id),5000)
BEGIN SELECT RAISE(ABORT,'quota_trades'); END;

--> statement-breakpoint
CREATE TRIGGER quota_accounts AFTER INSERT ON accounts
WHEN (SELECT COUNT(*) FROM accounts WHERE user_id=NEW.user_id) > 100
BEGIN SELECT RAISE(ABORT,'quota_accounts'); END;

--> statement-breakpoint
CREATE TRIGGER quota_setups AFTER INSERT ON setups
WHEN (SELECT COUNT(*) FROM setups WHERE user_id=NEW.user_id) > 200
BEGIN SELECT RAISE(ABORT,'quota_setups'); END;
