CREATE TABLE journal_section_cache (
 user_id TEXT NOT NULL, cache_key TEXT NOT NULL, revision INTEGER NOT NULL,
 data TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,cache_key)
);
--> statement-breakpoint
CREATE INDEX journal_section_cache_owner_revision ON journal_section_cache(user_id,revision);
