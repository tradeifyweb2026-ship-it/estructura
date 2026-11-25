CREATE TABLE `private_scripts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`vault_id` text NOT NULL,
	`metadata` text NOT NULL,
	`ciphertext` text NOT NULL,
	`cipher_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`,`vault_id`) REFERENCES `script_vaults`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "private_script_budget" CHECK("private_scripts"."cipher_bytes">0)
);
--> statement-breakpoint
CREATE INDEX `private_scripts_owner_updated` ON `private_scripts` (`user_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `script_vaults` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`envelope` text NOT NULL,
	`used_bytes` integer DEFAULT 0 NOT NULL,
	`quota_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "script_vault_budget" CHECK("script_vaults"."used_bytes">=0 AND "script_vaults"."quota_bytes">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `script_vaults_owner_id` ON `script_vaults` (`user_id`,`id`);
--> statement-breakpoint
CREATE TRIGGER private_scripts_quota_insert BEFORE INSERT ON private_scripts
WHEN (SELECT used_bytes+new.cipher_bytes>quota_bytes FROM script_vaults WHERE user_id=new.user_id AND id=new.vault_id)
BEGIN SELECT RAISE(ABORT,'script_quota'); END;
--> statement-breakpoint
CREATE TRIGGER private_scripts_quota_update BEFORE UPDATE OF cipher_bytes ON private_scripts
WHEN new.cipher_bytes>old.cipher_bytes AND (SELECT used_bytes+new.cipher_bytes-old.cipher_bytes>quota_bytes FROM script_vaults WHERE user_id=new.user_id AND id=new.vault_id)
BEGIN SELECT RAISE(ABORT,'script_quota'); END;
--> statement-breakpoint
CREATE TRIGGER private_scripts_usage_insert AFTER INSERT ON private_scripts BEGIN
UPDATE script_vaults SET used_bytes=used_bytes+new.cipher_bytes,revision=revision+1 WHERE user_id=new.user_id AND id=new.vault_id;
END;
--> statement-breakpoint
CREATE TRIGGER private_scripts_usage_update AFTER UPDATE ON private_scripts BEGIN
UPDATE script_vaults SET used_bytes=used_bytes+new.cipher_bytes-old.cipher_bytes,revision=revision+1 WHERE user_id=new.user_id AND id=new.vault_id;
END;
--> statement-breakpoint
CREATE TRIGGER private_scripts_usage_delete AFTER DELETE ON private_scripts BEGIN
UPDATE script_vaults SET used_bytes=used_bytes-old.cipher_bytes,revision=revision+1 WHERE user_id=old.user_id AND id=old.vault_id;
END;
