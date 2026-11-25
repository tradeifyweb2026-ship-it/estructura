export type RestoreOutcome = { key: string; status: "added" | "skipped" };
export type RestoreResult = { imported: number; skipped: number; records: RestoreOutcome[] };
