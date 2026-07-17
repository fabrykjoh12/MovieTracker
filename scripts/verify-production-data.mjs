import {
  NeonPostgrestClient,
  fetchWithToken,
} from "@neondatabase/postgrest-js";
import pg from "pg";

const { Client } = pg;
const createEphemeralAccounts =
  process.env.ACCEPTANCE_CREATE_EPHEMERAL?.trim().toLowerCase() === "true";
const requiredVariables = createEphemeralAccounts
  ? ["VITE_NEON_AUTH_URL", "VITE_NEON_DATA_API_URL", "DATABASE_URL"]
  : [
      "VITE_NEON_AUTH_URL",
      "VITE_NEON_DATA_API_URL",
      "ACCEPTANCE_ACCOUNT_A_EMAIL",
      "ACCEPTANCE_ACCOUNT_A_PASSWORD",
      "ACCEPTANCE_ACCOUNT_B_EMAIL",
      "ACCEPTANCE_ACCOUNT_B_PASSWORD",
    ];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);
if (missingVariables.length) {
  throw new Error(
    `Production acceptance requires these local-only variables: ${missingVariables.join(", ")}.`,
  );
}

const authUrl = process.env.VITE_NEON_AUTH_URL;
const dataApiUrl = process.env.VITE_NEON_DATA_API_URL;
const acceptanceOrigin =
  process.env.ACCEPTANCE_ORIGIN?.trim() || "https://fabrykjoh12.github.io";
const acceptanceCallbackUrl = `${acceptanceOrigin}/MovieTracker/`;
const runId = crypto.randomUUID();
const timestamp = new Date().toISOString();
const temporaryAccounts = [];

function failureMessage(error, fallback) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertResult(result, action) {
  if (result.error) {
    throw new Error(
      `${action}: ${failureMessage(result.error, "request failed")}`,
    );
  }
  return result.data;
}

function createDataClient(token) {
  return new NeonPostgrestClient({
    dataApiUrl,
    options: {
      global: { fetch: fetchWithToken(async () => token) },
    },
  });
}

function authEndpoint(path) {
  return `${authUrl.replace(/\/$/, "")}${path}`;
}

function cookieHeader(headers) {
  const setCookies = headers.getSetCookie?.() ?? [];
  const cookies = setCookies.length
    ? setCookies
    : [headers.get("set-cookie")].filter(Boolean);
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

function isJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

async function jwtFromAuthResponse(response, cookies) {
  const responseJwt = response.headers.get("set-auth-jwt");
  if (isJwt(responseJwt)) return responseJwt;
  if (!cookies) return null;
  const tokenResponse = await fetch(authEndpoint("/token"), {
    headers: { Cookie: cookies, Origin: acceptanceOrigin },
  });
  const payload = await tokenResponse.json().catch(() => ({}));
  return tokenResponse.ok && isJwt(payload.token) ? payload.token : null;
}

async function authRequest(path, body, label) {
  const response = await fetch(authEndpoint(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: acceptanceOrigin,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${label}: ${failureMessage(data, response.statusText || "authentication failed")}`,
    );
  }
  const cookies = cookieHeader(response.headers);
  const token = await jwtFromAuthResponse(response, cookies);
  return { data, cookies, token };
}

function authenticatedIdentity(result, extra = {}) {
  if (!result.data?.user?.id || !isJwt(result.token)) {
    return null;
  }
  return {
    client: createDataClient(result.token),
    userId: result.data.user.id,
    cookies: result.cookies,
    ...extra,
  };
}

async function authenticatedClient(email, password, label) {
  const signIn = await authRequest(
    "/sign-in/email",
    {
      email,
      password,
      rememberMe: false,
      callbackURL: acceptanceCallbackUrl,
    },
    `${label} sign-in failed`,
  );
  const identity = authenticatedIdentity(signIn);
  if (identity) return identity;
  throw new Error(`${label} did not receive a valid Data API JWT.`);
}

async function temporaryClient(label) {
  const email = `movietracker-${label.toLowerCase().replaceAll(" ", "-")}-${runId}@example.com`;
  const password = `Cinema-${crypto.randomUUID()}-9a!`;
  temporaryAccounts.push({ email, password });
  const signUp = await authRequest(
    "/sign-up/email",
    {
      email,
      password,
      name: `MovieTracker ${label}`,
      callbackURL: acceptanceCallbackUrl,
    },
    `${label} creation failed`,
  );
  const identity = authenticatedIdentity(signUp, {
    email,
    password,
  });
  if (identity) return identity;
  return {
    ...(await authenticatedClient(email, password, label)),
    email,
    password,
  };
}

async function deleteTemporaryUsers() {
  if (!temporaryAccounts.length) return 0;
  const emails = temporaryAccounts.map((account) => account.email);
  const database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  try {
    const deleted = await database.query(
      'delete from neon_auth."user" where email = any($1::text[]) returning id',
      [emails],
    );
    const remaining = await database.query(
      'select count(*)::integer as count from neon_auth."user" where email = any($1::text[])',
      [emails],
    );
    assert(
      remaining.rows[0].count === 0,
      "Temporary Neon Auth users remain after cleanup.",
    );
    if (deleted.rows.length) {
      const profiles = await database.query(
        "select count(*)::integer as count from public.profiles where id = any($1::uuid[])",
        [deleted.rows.map((row) => row.id)],
      );
      assert(
        profiles.rows[0].count === 0,
        "Temporary profile rows remain after Auth cleanup.",
      );
    }
    return deleted.rowCount ?? 0;
  } finally {
    await database.end();
  }
}

async function signOutIdentity(identity) {
  if (!identity?.cookies) return;
  await fetch(authEndpoint("/sign-out"), {
    method: "POST",
    headers: {
      Cookie: identity.cookies,
      Origin: acceptanceOrigin,
    },
  });
}

async function maybeSingle(query, action) {
  return assertResult(await query.maybeSingle(), action) ?? null;
}

async function selectRows(query, action) {
  return assertResult(await query, action) ?? [];
}

function mutableState(row) {
  return {
    user_id: row.user_id,
    media_id: row.media_id,
    status: row.status,
    progress_season: row.progress_season,
    progress_episode: row.progress_episode,
    intent: row.intent,
    saved_at: row.saved_at,
  };
}

function mutableVerdict(row) {
  return {
    user_id: row.user_id,
    media_id: row.media_id,
    season_id: row.season_id,
    episode_id: row.episode_id,
    kind: row.kind,
    normalized: row.normalized,
    qualities: row.qualities,
    tags: row.tags,
    personal_rank: row.personal_rank,
    recorded_at: row.recorded_at,
  };
}

async function restoreState(client, createdId, original) {
  if (!createdId) return;
  if (original) {
    assertResult(
      await client
        .from("user_media_states")
        .update(mutableState(original))
        .eq("id", createdId),
      "Restoring Account A's library state",
    );
    return;
  }
  assertResult(
    await client.from("user_media_states").delete().eq("id", createdId),
    "Removing the acceptance library state",
  );
}

async function restoreVerdict(client, createdId, original) {
  if (!createdId) return;
  if (original) {
    assertResult(
      await client
        .from("verdicts")
        .update(mutableVerdict(original))
        .eq("id", createdId),
      "Restoring Account A's Verdict",
    );
    return;
  }
  assertResult(
    await client.from("verdicts").delete().eq("id", createdId),
    "Removing the acceptance Verdict",
  );
}

let accountA;
let secondDevice;
let accountB;
let stateId;
let verdictId;
let originalState;
let originalVerdict;
let cleanupPassed = false;
let temporaryUsersDeleted = 0;

try {
  accountA = createEphemeralAccounts
    ? await temporaryClient("Account A")
    : await authenticatedClient(
        process.env.ACCEPTANCE_ACCOUNT_A_EMAIL,
        process.env.ACCEPTANCE_ACCOUNT_A_PASSWORD,
        "Account A",
      );
  accountB = createEphemeralAccounts
    ? await temporaryClient("Account B")
    : await authenticatedClient(
        process.env.ACCEPTANCE_ACCOUNT_B_EMAIL,
        process.env.ACCEPTANCE_ACCOUNT_B_PASSWORD,
        "Account B",
      );
  assert(
    accountA.userId !== accountB.userId,
    "The two acceptance credentials resolve to the same Auth user.",
  );

  const catalog = await selectRows(
    accountA.client.from("media").select("id,title").limit(100),
    "Loading the shared catalog",
  );
  const existingStates = await selectRows(
    accountA.client
      .from("user_media_states")
      .select("media_id")
      .eq("user_id", accountA.userId),
    "Loading Account A's current library",
  );
  const existingMediaIds = new Set(existingStates.map((row) => row.media_id));
  const target =
    catalog.find((row) => !existingMediaIds.has(row.id)) ?? catalog[0];
  const forbiddenInsertTarget = catalog.find(
    (row) => row.id !== target?.id && !existingMediaIds.has(row.id),
  );
  assert(target, "The catalog has no title available for acceptance testing.");
  assert(
    forbiddenInsertTarget,
    "The catalog needs a second unused title for the RLS insert check.",
  );

  originalState = await maybeSingle(
    accountA.client
      .from("user_media_states")
      .select("*")
      .eq("user_id", accountA.userId)
      .eq("media_id", target.id),
    "Snapshotting Account A's library state",
  );
  originalVerdict = await maybeSingle(
    accountA.client
      .from("verdicts")
      .select("*")
      .eq("user_id", accountA.userId)
      .eq("media_id", target.id)
      .is("season_id", null)
      .is("episode_id", null),
    "Snapshotting Account A's Verdict",
  );

  const stateValues = {
    user_id: accountA.userId,
    media_id: target.id,
    status: "up-next",
    progress_season: 1,
    progress_episode: 1,
    intent: { queuePosition: 0, acceptanceRunId: runId },
    saved_at: timestamp,
  };
  const stateResult = originalState
    ? await accountA.client
        .from("user_media_states")
        .update(stateValues)
        .eq("id", originalState.id)
        .select("*")
        .single()
    : await accountA.client
        .from("user_media_states")
        .insert(stateValues)
        .select("*")
        .single();
  const writtenState = assertResult(
    stateResult,
    "Writing Account A's queue and episode progress",
  );
  stateId = writtenState.id;

  const verdictValues = {
    user_id: accountA.userId,
    media_id: target.id,
    season_id: null,
    episode_id: null,
    kind: "loved",
    normalized: 0.9,
    qualities: ["Atmosphere", "Performances"],
    tags: ["Strong ending"],
    personal_rank: null,
    recorded_at: timestamp,
  };
  const verdictResult = originalVerdict
    ? await accountA.client
        .from("verdicts")
        .update(verdictValues)
        .eq("id", originalVerdict.id)
        .select("*")
        .single()
    : await accountA.client
        .from("verdicts")
        .insert(verdictValues)
        .select("*")
        .single();
  verdictId = assertResult(verdictResult, "Writing Account A's Verdict").id;

  const eventResult = await accountA.client.from("watch_events").insert({
    user_id: accountA.userId,
    media_id: target.id,
    event_type: "episode",
    watched_at: timestamp,
    metadata: {
      clientEventId: `acceptance-${runId}`,
      acceptanceRunId: runId,
      season: 1,
      episode: 1,
    },
  });
  assertResult(eventResult, "Writing Account A's watch event");

  secondDevice = await authenticatedClient(
    createEphemeralAccounts
      ? accountA.email
      : process.env.ACCEPTANCE_ACCOUNT_A_EMAIL,
    createEphemeralAccounts
      ? accountA.password
      : process.env.ACCEPTANCE_ACCOUNT_A_PASSWORD,
    "Account A's second client",
  );
  const [secondState, secondVerdict, secondEvents] = await Promise.all([
    maybeSingle(
      secondDevice.client
        .from("user_media_states")
        .select("*")
        .eq("id", stateId),
      "Loading progress on Account A's second client",
    ),
    maybeSingle(
      secondDevice.client.from("verdicts").select("*").eq("id", verdictId),
      "Loading the Verdict on Account A's second client",
    ),
    selectRows(
      secondDevice.client
        .from("watch_events")
        .select("id")
        .eq("user_id", accountA.userId)
        .contains("metadata", { acceptanceRunId: runId }),
      "Loading the watch event on Account A's second client",
    ),
  ]);
  assert(
    secondState?.status === "up-next" &&
      secondState.progress_season === 1 &&
      secondState.progress_episode === 1 &&
      secondState.intent?.queuePosition === 0,
    "The second client did not hydrate Account A's queue and progress.",
  );
  assert(
    secondVerdict?.kind === "loved" &&
      secondVerdict.qualities.includes("Atmosphere"),
    "The second client did not hydrate Account A's Verdict.",
  );
  assert(
    secondEvents.length === 1,
    "The second client did not hydrate Account A's watch event.",
  );

  const [foreignStates, foreignVerdicts, foreignEvents] = await Promise.all([
    selectRows(
      accountB.client
        .from("user_media_states")
        .select("id")
        .eq("user_id", accountA.userId),
      "Checking Account B's library visibility",
    ),
    selectRows(
      accountB.client
        .from("verdicts")
        .select("id")
        .eq("user_id", accountA.userId),
      "Checking Account B's Verdict visibility",
    ),
    selectRows(
      accountB.client
        .from("watch_events")
        .select("id")
        .eq("user_id", accountA.userId),
      "Checking Account B's history visibility",
    ),
  ]);
  assert(
    foreignStates.length + foreignVerdicts.length + foreignEvents.length === 0,
    "Account B can read Account A's private rows.",
  );

  const foreignUpdate = await accountB.client
    .from("user_media_states")
    .update({ status: "archived" })
    .eq("id", stateId)
    .select("id");
  assert(
    !foreignUpdate.error && (foreignUpdate.data?.length ?? 0) === 0,
    "Account B changed Account A's library row.",
  );

  const forbiddenInsert = await accountB.client
    .from("user_media_states")
    .insert({
      user_id: accountA.userId,
      media_id: forbiddenInsertTarget.id,
      status: "planned",
      intent: { acceptanceRunId: runId },
      saved_at: timestamp,
    });
  assert(
    Boolean(forbiddenInsert.error) &&
      (forbiddenInsert.error.code === "42501" ||
        /row.level security/i.test(forbiddenInsert.error.message ?? "")),
    "Account B's forged Account A insert was not rejected by RLS.",
  );

  const unchanged = await maybeSingle(
    secondDevice.client.from("user_media_states").select("*").eq("id", stateId),
    "Confirming Account A's row remained unchanged",
  );
  assert(
    unchanged?.status === "up-next",
    "Account A's row changed during Account B's blocked mutation.",
  );

  console.log("Production Neon acceptance passed:");
  console.log(
    "- Account A wrote queue, episode progress, history, and Verdict data.",
  );
  console.log("- A separate authenticated client hydrated the same state.");
  console.log("- Account B read zero Account A owner rows.");
  console.log(
    "- Account B's update affected zero rows and forged insert was rejected.",
  );
} finally {
  if (accountA?.client) {
    try {
      assertResult(
        await accountA.client
          .from("watch_events")
          .delete()
          .eq("user_id", accountA.userId)
          .contains("metadata", { acceptanceRunId: runId }),
        "Removing acceptance watch events",
      );
      assertResult(
        await accountA.client
          .from("user_media_states")
          .delete()
          .eq("user_id", accountA.userId)
          .contains("intent", { acceptanceRunId: runId })
          .neq("id", stateId ?? "00000000-0000-0000-0000-000000000000"),
        "Removing acceptance library rows",
      );
      await restoreVerdict(accountA.client, verdictId, originalVerdict);
      await restoreState(accountA.client, stateId, originalState);
      cleanupPassed = true;
    } catch (error) {
      console.error(
        `Acceptance cleanup failed: ${failureMessage(error, "unknown error")}`,
      );
    }
  }
  await Promise.allSettled(
    [accountA, secondDevice, accountB]
      .filter(Boolean)
      .map((identity) => signOutIdentity(identity)),
  );
  if (createEphemeralAccounts) {
    try {
      temporaryUsersDeleted = await deleteTemporaryUsers();
    } catch (error) {
      console.error(
        `Temporary Auth cleanup failed: ${failureMessage(error, "unknown error")}`,
      );
      process.exitCode = 1;
    }
  }
  if (accountA && !cleanupPassed) process.exitCode = 1;
}

if (cleanupPassed) {
  console.log(
    "- Acceptance rows were removed and prior Account A data was restored.",
  );
}
if (
  createEphemeralAccounts &&
  temporaryUsersDeleted === temporaryAccounts.length
) {
  console.log(
    "- Both temporary Neon Auth users and their cascaded profiles were deleted and verified absent.",
  );
}
