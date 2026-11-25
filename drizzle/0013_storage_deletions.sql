CREATE TABLE `storage_deletions` (
	`object_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `storage_deletions_pending` ON `storage_deletions` (`created_at`,`object_key`);--> statement-breakpoint
CREATE INDEX `storage_deletions_owner` ON `storage_deletions` (`user_id`);--> statement-breakpoint
CREATE INDEX `attachments_object_key` ON `attachments` (`object_key`);
--> statement-breakpoint
CREATE TRIGGER attachments_queue_deleted AFTER DELETE ON attachments BEGIN
  INSERT INTO storage_deletions(object_key,user_id,created_at)
  VALUES(old.object_key,old.user_id,unixepoch()*1000) ON CONFLICT DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER attachments_queue_replaced AFTER UPDATE OF object_key ON attachments
WHEN old.object_key<>new.object_key BEGIN
  INSERT INTO storage_deletions(object_key,user_id,created_at)
  VALUES(old.object_key,old.user_id,unixepoch()*1000) ON CONFLICT DO NOTHING;
END;
