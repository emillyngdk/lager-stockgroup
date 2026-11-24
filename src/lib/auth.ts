const enc = new TextEncoder();

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const COOKIE = "lager_session";

export async function sessionToken(password: string): Promise<string> {
  return hmac("lager-stockgroup-v1", password);
}

export async function validToken(token: string | undefined, password: string | undefined): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await sessionToken(password);
  return token.length === expected.length && token === expected;
}
