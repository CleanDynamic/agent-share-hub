/** The one JSON answer: a body, a status and the CORS headers for the request. */
export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

/** The one error shape. The message says what failed, never why the server failed. */
export function errorResponse(message: string, status: number, headers: Record<string, string> = {}): Response {
  return jsonResponse({ error: message }, status, headers);
}

/** The first problem a zod parse found, as `field: message`, for a 400 that names the field. */
export function fieldError(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  const field = issue && issue.path.length > 0 ? issue.path.map(String).join(".") : "body";
  return `${field}: ${issue?.message ?? "Invalid input"}`;
}

/** The token in `Authorization: Bearer <token>`, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Compares two secrets without stopping at the first character that differs. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
