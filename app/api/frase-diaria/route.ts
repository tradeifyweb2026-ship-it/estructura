import { eq, lt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { dailyQuoteProgress } from "../../../db/schema";
import { dayKey, weekday } from "../../../lib/journal";
import { failure, reply, requireUserId } from "../../../lib/server-http";
import {eligibleQuotes as quotes} from '../../../lib/quote-catalog';

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const day = dayKey(Date.now());
    if (weekday(day) >= 5) return reply({ day, quote: null });

    // Advance at most once per day; retries return the same assigned quote.
    const [progress] = await getDb().insert(dailyQuoteProgress)
      .values({ userId, day, position: 0 })
      .onConflictDoUpdate({
        target: dailyQuoteProgress.userId,
        set: { day, position: sql`${dailyQuoteProgress.position} + 1` },
        setWhere: lt(dailyQuoteProgress.day, day),
      })
      .returning({ position: dailyQuoteProgress.position });
    const current=progress??await getDb().select({position:dailyQuoteProgress.position,day:dailyQuoteProgress.day}).from(dailyQuoteProgress).where(eq(dailyQuoteProgress.userId,userId)).get();
    return reply({day,quote:current&&(!("day" in current)||current.day===day)?quotes[current.position%quotes.length]:null});
  } catch (error) {
    return failure(error);
  }
}
