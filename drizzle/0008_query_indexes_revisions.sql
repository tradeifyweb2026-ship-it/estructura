CREATE TABLE journal_revisions (user_id text PRIMARY KEY NOT NULL,version integer DEFAULT 0 NOT NULL);
--> statement-breakpoint
CREATE INDEX trades_user_event ON trades(user_id,coalesce(json_extract(data,'$.closedAt'),opened_at),id);
--> statement-breakpoint
CREATE INDEX trades_user_account_event ON trades(user_id,account_id,coalesce(json_extract(data,'$.closedAt'),opened_at),id);
--> statement-breakpoint
CREATE INDEX trades_user_account_closed ON trades(user_id,account_id,json_extract(data,'$.closedAt'),opened_at,id);
--> statement-breakpoint
CREATE INDEX trades_user_account_opened ON trades(user_id,account_id,opened_at,id);
--> statement-breakpoint
CREATE TRIGGER revision_trades_insert AFTER INSERT ON trades
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_trades_update AFTER UPDATE ON trades
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_trades_delete AFTER DELETE ON trades
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_accounts_insert AFTER INSERT ON accounts
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_accounts_update AFTER UPDATE ON accounts
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_accounts_delete AFTER DELETE ON accounts
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_setups_insert AFTER INSERT ON setups
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_setups_update AFTER UPDATE ON setups
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_setups_delete AFTER DELETE ON setups
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_plans_insert AFTER INSERT ON plans
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_plans_update AFTER UPDATE ON plans
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_plans_delete AFTER DELETE ON plans
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_reviews_insert AFTER INSERT ON reviews
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_reviews_update AFTER UPDATE ON reviews
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_reviews_delete AFTER DELETE ON reviews
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_attachments_insert AFTER INSERT ON attachments
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_attachments_update AFTER UPDATE ON attachments
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (NEW.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
--> statement-breakpoint
CREATE TRIGGER revision_attachments_delete AFTER DELETE ON attachments
BEGIN
 INSERT INTO journal_revisions(user_id,version) VALUES (OLD.user_id,1)
 ON CONFLICT(user_id) DO UPDATE SET version=version+1;
END;
