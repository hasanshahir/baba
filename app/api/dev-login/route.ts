import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only session bootstrap. This network cannot reach the project's GoTrue
// auth service (login/signup hang), so for demos we mint a valid Supabase JWT
// locally with the project's JWT secret and set the session cookie ourselves.
// RLS still enforces data access; disabled in production.
//
// Usage (browser): /api/dev-login?secret=<RAG_TEST_SECRET>

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000042";
const DEMO_EMAIL = "demo@guftagu.test";
const WEEK = 7 * 24 * 3600;

function b64url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}

async function signHs256(signingInput: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  return Buffer.from(sig).toString("base64url");
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  }
  const secretParam = req.nextUrl.searchParams.get("secret");
  if (!process.env.RAG_TEST_SECRET || secretParam !== process.env.RAG_TEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json({ error: "SUPABASE_JWT_SECRET not set" }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: `${SUPABASE_URL}/auth/v1`,
      sub: DEMO_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: DEMO_EMAIL,
      phone: "",
      is_anonymous: false,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { company_name: "Karachi Electronics Store" },
      exp: now + WEEK,
      iat: now,
    })
  );
  const access_token = `${header}.${payload}.${await signHs256(`${header}.${payload}`, jwtSecret)}`;

  const session = {
    access_token,
    token_type: "bearer",
    expires_in: WEEK,
    expires_at: now + WEEK,
    refresh_token: "dev-refresh-token",
    user: {
      id: DEMO_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: DEMO_EMAIL,
    },
  };

  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  // @supabase/ssr base64url cookie encoding = "base64-" prefix + base64url(JSON).
  res.cookies.set(
    `sb-${ref}-auth-token`,
    "base64-" + b64url(JSON.stringify(session)),
    {
      path: "/",
      sameSite: "lax",
      maxAge: WEEK,
    }
  );
  return res;
}
