import { getChatGPTUser } from "../app/chatgpt-auth";
import { RequestBodyError } from "./request-body";
export { readBytes } from "./request-body";

import { JournalError } from "../db/repository";

export async function requireUserId(request?: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new JournalError("Inicia sesión para acceder a tu bitácora.", 401);
  if (request && request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (request.headers.get("X-Bitacora-Request") !== "1" ||
        request.headers.get("Sec-Fetch-Site") === "cross-site" ||
        (origin !== null && origin !== new URL(request.url).origin)) {
      throw new JournalError("La solicitud de edición no es válida.", 403);
    }
  }
  return user.userId;
}

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: privateHeaders });
}

export function failure(error: unknown) {
  if (error instanceof JournalError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status);
  console.error("Journal request failed", error instanceof Error ? error.name : "unknown");
  return reply({ error: "No se pudo completar la solicitud. Vuelve a intentarlo." }, 500);
}

