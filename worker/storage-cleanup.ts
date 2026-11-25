// Deletion intent is committed in the SAME D1 transaction as unlinking an
// attachment (triggers). R2 is touched only after that commit succeeds.
export async function cleanupStorage(db: D1Database, bucket: R2Bucket, userId?: string) {
  const rows = await db.prepare(`SELECT q.object_key FROM storage_deletions q
    WHERE ${userId === undefined ? '1=1' : 'q.user_id=?'}
    AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.object_key=q.object_key)
    ORDER BY q.created_at,q.object_key LIMIT 100`).bind(...(userId === undefined ? [] : [userId])).all<{object_key:string}>();
  if (!rows.results.length) return 0;
  const keys=rows.results.map(row=>row.object_key);
  // A partial or uncertain R2 failure leaves ALL intents for idempotent retry.
  await bucket.delete(keys);
  await db.prepare('DELETE FROM storage_deletions WHERE object_key IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.object_key=storage_deletions.object_key)').bind(JSON.stringify(keys)).run();
  return keys.length;
}
