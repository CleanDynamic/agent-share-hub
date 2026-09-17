// =============================================================================
// buildgallery — secret scanner tests (EX-P07)
// =============================================================================
// Run with:
//   deno test supabase/functions/_shared/redact/
//
// Every secret here is fake and is BUILT AT RUN TIME from pieces, so no line
// of this file carries a string shaped like a real credential. That keeps the
// repository's own secret scanning quiet and keeps a copy-paste of a test from
// putting a plausible key into a chat.
//
// Each positive test asserts three things: the kind was reported once, the
// replacement marker is in the text, and NO FRAGMENT of the fake value
// survived — the scanner's whole contract is that nothing of a secret
// remains, so every test checks for the tail of the value as well as the head.
// =============================================================================

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";

import { redactSecrets } from "./index.ts";

/**
 * A body that is clearly fake and long enough for every minimum. Seeds never
 * contain a kind name, so a slice of the value can never be found inside the
 * [REDACTED:<kind>] marker by accident.
 */
const body = (seed: string, length: number): string => {
  let out = "";
  while (out.length < length) out += seed;
  return out.slice(0, length);
};

/** A fake JWT with the given payload; header and signature are fixed. */
const jwt = (payload: Record<string, unknown>): string => {
  const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify(payload))}.${body("SIGfake9", 43)}`;
};

const SERVICE_JWT = jwt({ iss: "supabase", ref: "zybdotagjwektucfdkri", role: "service_role", iat: 1, exp: 2 });
const ANON_JWT = jwt({ iss: "supabase", ref: "zybdotagjwektucfdkri", role: "anon", iat: 1, exp: 2 });

function assertNothingSurvives(text: string, secret: string) {
  // Head, tail and a middle slice: a prefix-keeping or suffix-keeping
  // redaction fails here even if the marker is present.
  const head = secret.slice(0, 8);
  const tail = secret.slice(-8);
  const mid = secret.slice(Math.floor(secret.length / 2) - 4, Math.floor(secret.length / 2) + 4);
  assert(!text.includes(head), `head of secret survived`);
  assert(!text.includes(tail), `tail of secret survived`);
  assert(!text.includes(mid), `middle of secret survived`);
}

function assertRedacted(kind: string, secret: string, surround = (s: string) => `key: ${s}\n`) {
  const input = surround(secret);
  const { text, findings } = redactSecrets(input);
  assertStringIncludes(text, `[REDACTED:${kind}]`);
  assertEquals(findings, [{ kind, count: 1 }]);
  assertNothingSurvives(text, secret);
}

// -----------------------------------------------------------------------------
// One positive test per kind
// -----------------------------------------------------------------------------

Deno.test("openai_key: sk-", () => {
  assertRedacted("openai_key", "sk-" + body("FAKEaaa0", 48));
});

Deno.test("openai_key: sk-proj-", () => {
  assertRedacted("openai_key", "sk-proj-" + body("FAKEbbb0_", 120));
});

Deno.test("anthropic_key: sk-ant-", () => {
  assertRedacted("anthropic_key", "sk-ant-api03-" + body("FAKEccc0-", 90));
});

Deno.test("github_token: ghp_, gho_ and github_pat_", () => {
  assertRedacted("github_token", "ghp_" + body("FAKEgh0", 36));
  assertRedacted("github_token", "gho_" + body("FAKEgo0", 36));
  assertRedacted("github_token", "github_pat_" + body("FAKEpat0_", 82));
});

Deno.test("aws_access_key: AKIA", () => {
  assertRedacted("aws_access_key", "AKIA" + body("FAKE0", 16));
});

Deno.test("google_api_key: AIza", () => {
  assertRedacted("google_api_key", "AIza" + body("FAKEddd0-", 35));
});

Deno.test("stripe_key: sk_live_, sk_test_ and rk_live_", () => {
  assertRedacted("stripe_key", "sk_live_" + body("FAKEeee0", 24));
  assertRedacted("stripe_key", "sk_test_" + body("FAKEeee0", 24));
  assertRedacted("stripe_key", "rk_live_" + body("FAKEeee0", 24));
});

Deno.test("slack_token: xox", () => {
  assertRedacted("slack_token", "xoxb-" + body("1234567890-FAKEfff", 50));
});

Deno.test("supabase_secret_key: sb_secret_", () => {
  assertRedacted("supabase_secret_key", "sb_secret_" + body("FAKEggg0_", 40));
});

Deno.test("service_role_jwt: a JWT whose payload carries role service_role", () => {
  assertRedacted("service_role_jwt", SERVICE_JWT, (s) => `SUPABASE_SERVICE_ROLE_KEY: ${s}\n`);
});

Deno.test("private_key_block: BEGIN through END inclusive", () => {
  const block =
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    `${body("MIIEfake0", 64)}\n${body("AQIDfake1", 64)}\n${body("BBBBfake2", 20)}=\n` +
    "-----END RSA PRIVATE KEY-----";
  const { text, findings } = redactSecrets(`here is my key\n${block}\ndone`);
  assertEquals(text, "here is my key\n[REDACTED:private_key_block]\ndone");
  assertEquals(findings, [{ kind: "private_key_block", count: 1 }]);
});

Deno.test("database_url: postgres, mysql and mongodb+srv with a password", () => {
  for (const url of [
    "postgres://app:FAKEpassw0rd@db.example.com:5432/app",
    "postgresql://app:FAKEpassw0rd@db.example.com/app",
    "mysql://root:FAKEpassw0rd@127.0.0.1/app",
    "mongodb+srv://app:FAKEpassw0rd@cluster0.example.mongodb.net/app?retryWrites=true",
  ]) {
    assertRedacted("database_url", url, (s) => `DATABASE_URL=${s}\n`);
  }
});

Deno.test("bearer_token: Authorization: Bearer followed by 20 or more characters", () => {
  const token = body("FAKEhhh0", 40);
  const { text, findings } = redactSecrets(`curl -H "Authorization: Bearer ${token}" https://api.example.com/v1`);
  assertEquals(text, 'curl -H "Authorization: Bearer [REDACTED:bearer_token]" https://api.example.com/v1');
  assertEquals(findings, [{ kind: "bearer_token", count: 1 }]);
});

Deno.test("generic_assignment: api_key=, apikey:, secret=, token=, password= with 16+ non-space characters", () => {
  const value = body("FAKEvalue0", 24);
  for (const name of ["api_key=", "apikey: ", "secret=", "token = ", "password: ", "OPENAI_API_KEY=", "DB_PASSWORD=", "access_token:"]) {
    const { text, findings } = redactSecrets(`${name}${value}\n`);
    assertEquals(text, `${name}[REDACTED:generic_assignment]\n`, name);
    assertEquals(findings, [{ kind: "generic_assignment", count: 1 }], name);
  }
});

// -----------------------------------------------------------------------------
// Counting and the unchanged path
// -----------------------------------------------------------------------------

Deno.test("nothing found: text is returned unchanged and findings is empty", () => {
  const input = "A plain conversation about a build.\n\n```ts\nconst answer = 42;\n```\n";
  const result = redactSecrets(input);
  assertEquals(result.text, input);
  assertEquals(result.findings, []);
});

Deno.test("findings carry kind and count only, with one entry per kind", () => {
  const a = "sk-" + body("FAKEone0", 48);
  const b = "sk-" + body("FAKEtwo0", 48);
  const c = "ghp_" + body("FAKEgh0", 36);
  // The GitHub token sits on the line after an OpenAI key: a wrap must never
  // swallow a line that begins another key.
  const { text, findings } = redactSecrets(`${a} and ${b}\n${c}`);
  assertEquals(findings, [
    { kind: "openai_key", count: 2 },
    { kind: "github_token", count: 1 },
  ]);
  for (const finding of findings) assertEquals(Object.keys(finding).sort(), ["count", "kind"]);
  assertEquals(text, "[REDACTED:openai_key] and [REDACTED:openai_key]\n[REDACTED:github_token]");
});

Deno.test("a service-role JWT after Bearer is reported once, as the JWT", () => {
  const { text, findings } = redactSecrets(`Authorization: Bearer ${SERVICE_JWT}`);
  assertEquals(text, "Authorization: Bearer [REDACTED:service_role_jwt]");
  assertEquals(findings, [{ kind: "service_role_jwt", count: 1 }]);
});

// -----------------------------------------------------------------------------
// A key split across a line break inside a code block
// -----------------------------------------------------------------------------

Deno.test("a key wrapped across a line break inside a code block is redacted whole", () => {
  const first = body("FAKEwrap0", 30);
  const second = body("FAKEtail0", 30);
  const input = "Here is my env:\n```\nOPENAI_API_KEY=sk-proj-" + first + "\n" + second + "\n```\n";
  const { text, findings } = redactSecrets(input);
  assertEquals(text, "Here is my env:\n```\nOPENAI_API_KEY=[REDACTED:openai_key]\n```\n");
  assertEquals(findings, [{ kind: "openai_key", count: 1 }]);
  assertNothingSurvives(text, first + second);
});

Deno.test("a wrap is not taken when the next line is more code", () => {
  const key = "sk-" + body("FAKEline0", 48);
  const input = "```\nconst key = \"" + key + "\"\nconst client = makeClient(key)\n```\n";
  const { text } = redactSecrets(input);
  assertEquals(text, "```\nconst key = \"[REDACTED:openai_key]\"\nconst client = makeClient(key)\n```\n");
});

// -----------------------------------------------------------------------------
// Negatives: long things that are not secrets
// -----------------------------------------------------------------------------

function assertUntouched(input: string) {
  const result = redactSecrets(input);
  assertEquals(result.findings, []);
  assertEquals(result.text, input);
}

Deno.test("negative: a git commit hash", () => {
  assertUntouched("Fixed in 830ac3a1f66bc80e2a0e43d6dda0399c1d2e3f4a and reverted in e2a0e43.");
});

Deno.test("negative: a UUID", () => {
  assertUntouched("import_id 6d0f4a2e-1c3b-4e5f-9a7b-8c9d0e1f2a3b, build 9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f");
});

Deno.test("negative: a URL without credentials", () => {
  assertUntouched(
    "See https://github.com/CleanDynamic/agent-share-hub/blob/main/src/lib/build/intake.ts#L351-L354 " +
      "and postgres://localhost:5432/app and https://zybdotagjwektucfdkri.supabase.co/functions/v1/mcp?limit=20&offset=40",
  );
});

Deno.test("negative: a base64 image", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  assertUntouched(`![pixel](data:image/png;base64,${png + png + png})`);
});

Deno.test("negative: a long import path", () => {
  assertUntouched(
    'import { materialiseProposal } from "../../../../src/lib/build/intake/materialise/proposal/writer/index.ts";\n' +
      'import token from "@/lib/auth/token/refresh/access-token-provider";\n',
  );
});

Deno.test("negative: ordinary code", () => {
  assertUntouched(
    "```ts\n" +
      "const token = await refreshAccessToken(session);\n" +
      "const password = process.env.DATABASE_PASSWORD;\n" +
      "const apiKey = getApiKeyForTenant(tenantId, { rotateIfExpired: true });\n" +
      "headers.Authorization = `Bearer ${token}`;\n" +
      "const secret: string | undefined = undefined;\n" +
      "const token = someVeryLongVariableName;\n" +
      "password = DEFAULT_LOCAL_PASSWORD_SETTING\n" +
      "const task-runner = 'task-1234567890abcdefghijklmnop';\n" +
      "```\n",
  );
});

Deno.test("negative: an anon-role JWT and a publishable key are public and stay", () => {
  assertUntouched(`SUPABASE_ANON_KEY=${ANON_JWT}\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_${body("FAKEpub0", 30)}\n`);
});

Deno.test("negative: placeholders and template references after a secret name", () => {
  assertUntouched("api_key=<your-api-key-here>\ntoken=${GITHUB_TOKEN_FROM_ENV}\npassword: {{ vault.db_password }}\n");
});
