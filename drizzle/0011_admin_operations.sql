CREATE TABLE maintenance_state (
 id INTEGER PRIMARY KEY NOT NULL CONSTRAINT maintenance_singleton CHECK(id=1), version INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL DEFAULT '',
 started_at INTEGER,until_at INTEGER,updated_by TEXT,updated_at INTEGER
);
--> statement-breakpoint
INSERT INTO maintenance_state(id) VALUES (1);
--> statement-breakpoint
CREATE TABLE admin_alert_state (
 id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL CONSTRAINT admin_alert_status CHECK(status IN ('reviewed','resolved')),
 label TEXT NOT NULL, updated_by TEXT NOT NULL,updated_at INTEGER NOT NULL
);
