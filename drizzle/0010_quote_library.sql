CREATE TABLE quote_state (
 user_id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL DEFAULT 0,
 preferences TEXT NOT NULL DEFAULT '{}', sequence INTEGER NOT NULL DEFAULT 0, cycle INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE quote_deliveries (
 user_id TEXT NOT NULL, delivery_key TEXT NOT NULL, quote_id INTEGER NOT NULL,
 cycle INTEGER NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL,
 category TEXT NOT NULL, snapshot TEXT NOT NULL,
 PRIMARY KEY(user_id,delivery_key)
);
--> statement-breakpoint
CREATE INDEX quote_deliveries_owner_cycle ON quote_deliveries(user_id,cycle,quote_id);
--> statement-breakpoint
CREATE INDEX quote_deliveries_owner_date ON quote_deliveries(user_id,created_at,delivery_key);
--> statement-breakpoint
CREATE TABLE quote_favorites (
 user_id TEXT NOT NULL,quote_id INTEGER NOT NULL,created_at INTEGER NOT NULL,snapshot TEXT NOT NULL,
 PRIMARY KEY(user_id,quote_id)
);
