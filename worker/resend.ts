export async function sendLoginCode(env: Cloudflare.Env, email: string, code: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.TRADEIFY_EMAIL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.TRADEIFY_EMAIL_FROM, to: [email], subject: "Código de acceso a Tradeify", text: "Tu código es " + code + ". Vence en 10 minutos." }),
  });
  if (!response.ok) throw new Error("No se pudo enviar el código.");
}
