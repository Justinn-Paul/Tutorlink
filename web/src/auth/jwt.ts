/** Decode JWT payload (middle segment) without external libraries. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Seconds since epoch from JWT `exp`, or null if missing/invalid. */
export function getJwtExp(token: string): number | null {
  const p = decodeJwtPayload(token);
  const exp = p?.exp;
  return typeof exp === "number" ? exp : null;
}

export function getEmailFromIdToken(idToken: string): string | null {
  const p = decodeJwtPayload(idToken);
  const email = p?.email;
  return typeof email === "string" ? email : null;
}
