import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { captureScope, JournalError } from "../../../db/repository";
import { attachments } from "../../../db/schema";
import { idSchema, SLOTS, type Slot } from "../../../lib/journal";
import { failure, privateHeaders, reply, requireUserId } from "../../../lib/server-http";

import {cleanupStorage} from "../../../worker/storage-cleanup";

export const dynamic = "force-dynamic";
async function context(request: Request) {
  const userId = await requireUserId(request);
  const params = new URL(request.url).searchParams;
  const tradeId = idSchema.safeParse(params.get("trade"));
  const slot = SLOTS.find((value) => value === params.get("slot"));
  if (!tradeId.success || !slot) throw new JournalError("Captura no válida.");
  if (!env.BUCKET) throw new JournalError("El almacenamiento de capturas no está disponible.", 503);
  const db = getDb();
  const where = and(captureScope(userId, tradeId.data), eq(attachments.slot, slot));
  return { userId, tradeId: tradeId.data, slot: slot as Slot, db, where, bucket: env.BUCKET };
}

export async function GET(request: Request) {
  try {
    const { db, where, bucket } = await context(request);
    const capture = await db.select().from(attachments).where(where).get();
    if (!capture) throw new JournalError("Captura no encontrada.", 404);
    const image = await bucket.get(capture.objectKey);
    if (!image) throw new JournalError("Captura no encontrada.", 404);
    return new Response(image.body, { headers: { ...privateHeaders, "Content-Type": image.httpMetadata?.contentType ?? "application/octet-stream", "Content-Length": String(image.size) } });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { db, where, bucket, userId } = await context(request);
    const revision = request.headers.get("X-Capture-Revision") ?? "";
    const deleted = await db.delete(attachments).where(and(where, eq(attachments.revision, revision))).returning({ objectKey: attachments.objectKey });
    if (!deleted.length) throw new JournalError("La captura cambió. Actualiza y vuelve a intentarlo.", 409);
    await cleanupStorage(env.DB!,bucket,userId).catch(() => console.error("Journal capture cleanup failed"));
    return reply({ removed: true });
  } catch (error) {
    return failure(error);
  }
}
