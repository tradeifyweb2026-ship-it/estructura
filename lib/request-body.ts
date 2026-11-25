// Framework-independent so the authentication gate can enforce the same limits
// before handing a request to Vinext. Never log the submitted body.
export class RequestBodyError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function readBytes(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new RequestBodyError('El archivo o solicitud supera el tamaño permitido.', 413);
  if (!request.body) throw new RequestBodyError('La solicitud está vacía.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestBodyError('El archivo o solicitud supera el tamaño permitido.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readJson(request: Request, limit: number, invalidStatus = 422): Promise<unknown> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw new RequestBodyError('Formato de solicitud incorrecto.', 415);
  const text = new TextDecoder().decode(await readBytes(request, limit));
  // Scan before JSON.parse, including unknown properties Zod would discard.
  // Quotes and escaped backslashes must not count as structural nesting.
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > 32) throw new RequestBodyError('La estructura de la solicitud es demasiado profunda.', 422);
    } else if (char === '}' || char === ']') depth--;
  }
  try { return JSON.parse(text); }
  catch { throw new RequestBodyError('La solicitud no contiene datos válidos.', invalidStatus); }
}
