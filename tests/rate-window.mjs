// Miniflare's native limiter resets at a wall-clock minute boundary. Reserve
// enough time for the burst so a valid reset cannot look like a quota bypass.
// This changes only test scheduling, never the Worker's limit or bindings.
export async function reserveRateWindow() {
  const remaining = 60000 - Date.now() % 60000;
  if (remaining < 15000) await new Promise(resolve => setTimeout(resolve, remaining + 50));
}
