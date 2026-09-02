// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

export type FcmSendResult =
  | { ok: true; messageId: string }
  | { ok: false; kind: "invalid-token" | "transient" | "permanent"; status: number; error: string };

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEquals(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function sanitizeError(status: number, body: unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
  return `FCM_${status}:${text.slice(0, 240).replace(/[\r\n]+/g, " ")}`;
}

function readServiceAccount(): ServiceAccount {
  const encoded = (Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON_B64") || "").trim();
  if (!encoded) throw new Error("FCM_SERVICE_ACCOUNT_NOT_CONFIGURED");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))));
  } catch {
    throw new Error("FCM_SERVICE_ACCOUNT_INVALID");
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("FCM_SERVICE_ACCOUNT_INVALID");
  }
  return parsed;
}

async function createAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: account.client_email,
    scope: FCM_SCOPE,
    aud: OAUTH_AUDIENCE,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  const response = await fetch(OAUTH_AUDIENCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.access_token !== "string") {
    throw new Error("FCM_OAUTH_FAILED");
  }
  return body.access_token;
}

function classifyFailure(status: number, body: unknown): "invalid-token" | "transient" | "permanent" {
  const serialized = JSON.stringify(body ?? {});
  if (status === 404 || /UNREGISTERED|registration-token-not-registered|token not registered/i.test(serialized)) return "invalid-token";
  if (status === 408 || status === 425 || status === 429 || status >= 500) return "transient";
  if (status === 400 && /INVALID_ARGUMENT/i.test(serialized) && /token/i.test(serialized)) return "invalid-token";
  return "permanent";
}

export async function sendFcmDataMessage(params: {
  token: string;
  data: Record<string, string>;
}): Promise<FcmSendResult> {
  const account = readServiceAccount();
  const expectedProjectId = (Deno.env.get("FIREBASE_PROJECT_ID") || "").trim();
  if (!expectedProjectId || account.project_id !== expectedProjectId) {
    throw new Error("FCM_PROJECT_MISMATCH");
  }
  const accessToken = await createAccessToken(account);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { token: params.token, data: params.data } }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok && typeof body.name === "string") return { ok: true, messageId: body.name };
  const kind = classifyFailure(response.status, body);
  return { ok: false, kind, status: response.status, error: sanitizeError(response.status, body) };
}

export function isWebhookSecretValid(received: string | null, expected: string): boolean {
  return constantTimeEquals(String(received || ""), expected);
}
