import { addDays, blankJournal, inputDate, weekStart, type Journal, type Trade } from "./journal.ts";

const ACCOUNT_ID = "82b81847-3c35-4ad0-91fb-b403f003ff54";
const SETUPS = ["e0b43d4a-f87f-4536-a9cc-fa498ca9db81", "07ebd0cf-53b2-46b2-aa57-992059b98ac8", "80d8acae-9d82-49c8-a6d5-20eec84225c5"];
const metrics = [1.6, -1, 1.8, 2.7, -1, 0, 1.2, -1, -1, 2.45, 1.25, -1, 0.85, 1.9, -0.4, 0.95, 0, 2.1, 1.1, -1, 2.35, -1, 0.6, 2.3, -0.75, 1.8, -1, 2.4, 1.2, -0.7, 2.7, 0.8];
const rules = ["Identificar el setup antes de entrar", "Confirmar el stop loss y el tamaño", "Revisar el calendario de noticias"];

export function exampleJournal(today: string): Journal {
  const anchor = addDays(weekStart(today), 4);
  const monday = addDays(weekStart(anchor), -28);
  const trades: Trade[] = metrics.map((r, index): Trade => {
    const tradeDay = Math.floor(index / 1.3);
    const day = addDays(monday, tradeDay + Math.floor(tradeDay / 5) * 2);
    const repeats = index > 0 && Math.floor((index - 1) / 1.3) === tradeDay;
    const openHour = repeats || index % 7 === 4 ? "10" : "09";
    const minute = String(repeats ? 12 + index % 17 : 31 + index % 22).padStart(2, "0");
    const openedAt = inputDate(`${day}T${openHour}:${minute}`);
    const direction = index % 3 !== 2 ? "long" : "short";
    const sign = direction === "long" ? 1 : -1;
    const entry = 25100 + index * 19.75;
    const setupId = SETUPS[index % SETUPS.length];
    const loss = r < 0;
    return {
      id: "23ac4e52-a712-45f6-9870-" + String(index).padStart(12, "0"), version: 1,
      asset: "US100", accountId: ACCOUNT_ID, setupId, direction, openedAt, closedAt: openedAt + (9 + index % 19) * 60_000,
      entry, stop: entry - 20 * sign, target: entry + 60 * sign, exit: entry + 20 * r * sign, size: 1,
      pnlCents: Math.round(r * 5000), feesCents: 145, riskCents: 5000, riskPercent: 0.5, partials: [],
      before: { name: loss && index % 2 === 0 ? "FOMO" : index % 5 === 3 ? "Duda" : "Calma", intensity: loss ? 3 : 2 },
      during: { name: loss ? "Duda" : "Confianza", intensity: 2 },
      after: { name: loss ? "Frustración" : "Satisfacción", intensity: 3 },
      grade: loss ? index % 3 + 2 : 4 + index % 2, errors: loss ? [index % 2 ? "Entrada tardía" : "Cerré por miedo"] : [],
      notes: [{ kind: "text", checked: false, text: loss ? "Entré antes de confirmar el retroceso. La próxima vez esperaré el cierre." : "Esperé el retroceso y respeté el riesgo planeado." }],
      checklist: rules.map((text, i) => ({ text, checked: !loss || i !== 0 })),
    };
  }).filter((trade) => trade.openedAt <= inputDate(today + "T23:59")).reverse();
  return {
    ...blankJournal,
    accounts: [{ id: ACCOUNT_ID, version: 1, name: "Demo Nasdaq", type: "Demo", currency: "USD", startingBalanceCents: 1_000_000, archived: false }],
    setups: [
      { id: SETUPS[0], version: 1, name: "Ruptura + retroceso", description: "Cambio de estructura y pullback.", rules: "Esperar la confirmación del cierre.", color: "violeta", archived: false },
      { id: SETUPS[1], version: 1, name: "Barrido + IFVG", description: "Barrido de liquidez e inversión del FVG.", rules: "Confirmar la inversión antes de entrar.", color: "verde", archived: false },
      { id: SETUPS[2], version: 1, name: "Rechazo de nivel", description: "Reacción en un nivel previamente marcado.", rules: "Definir la invalidación antes de entrar.", color: "azul", archived: false },
    ],
    trades,
    plan: { rules, riskPercent: 0.5, dailyLossR: 2, weeklyTargetR: 5 },
  };
}
