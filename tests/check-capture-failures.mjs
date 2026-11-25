import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const routeUrl = new URL("../app/api/capturas/route.ts", import.meta.url).href;
const moduleSource = {
  "cloudflare:workers": "export const env = { BUCKET: { put: (...args) => globalThis.captureFixture.bucket.put(...args), delete: (...args) => globalThis.captureFixture.bucket.delete(...args) } };",
  "../../../db": "export const getDb = () => globalThis.captureFixture.db;",
  "../../../db/repository": `
    export class JournalError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
    export const captureScope = () => undefined;
    export const ownedTrade = async () => true;
  `,
  "../../../lib/server-http": `
    export const requireUserId = async () => "fixture-user";
    export const readBytes = async (request) => new Uint8Array(await request.arrayBuffer());
    export const privateHeaders = { "Cache-Control": "private, no-store" };
    export const reply = (body) => Response.json(body);
    export const failure = (error) => Response.json({ error: "Fixture failure" }, { status: error.status ?? 500 });
  `,
};

// Substitute infrastructure to exercise legacy cleanup failure without changing any real data.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === routeUrl) {
      if (moduleSource[specifier]) return { url: "data:text/javascript," + encodeURIComponent(moduleSource[specifier]), shortCircuit: true };
      if (specifier === "../../../db/schema" || specifier === "../../../lib/journal") {
        return { url: new URL(specifier + ".ts", context.parentURL).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
});

const route = await import(routeUrl);
assert.equal(route.PUT, undefined, "La ruta no debe exportar PUT");

try {
  let deletedObjects = 0;
  const query = {
    where() { return this; },
    async returning() { throw new Error("D1 unavailable"); },
  };
  globalThis.captureFixture = {
    db: { delete: () => query },
    bucket: { async delete() { deletedObjects++; } },
  };
  const response = await route.DELETE(new Request("https://tradeify.example.test/api/capturas?trade=11111111-1111-4111-8111-111111111111&slot=before", {
    method: "DELETE", headers: { "X-Capture-Revision": "fixture-revision" },
  }));
  assert.equal(response.status, 500);
  assert.equal(deletedObjects, 0, "No se borra R2 sin confirmación del borrado D1");
  console.log("check-capture-failures: sin PUT; limpieza legacy conserva R2 ante fallo D1.");
} finally {
  hooks.deregister();
  delete globalThis.captureFixture;
}
