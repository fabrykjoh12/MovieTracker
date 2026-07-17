import { Client } from "pg";

const configuredConnectionString = process.env.DATABASE_URL?.trim();

if (!configuredConnectionString) {
  throw new Error("DATABASE_URL is required to verify the deployed schema.");
}

const connectionUrl = new URL(configuredConnectionString);
if (
  ["prefer", "require", "verify-ca"].includes(
    connectionUrl.searchParams.get("sslmode") ?? "",
  )
) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}

const expectedTables = [
  "activities",
  "beta_invites",
  "episodes",
  "friendships",
  "media",
  "media_provider_ids",
  "pairwise_comparisons",
  "profiles",
  "provider_metadata_cache",
  "reviews",
  "room_candidates",
  "room_participants",
  "room_votes",
  "seasons",
  "shelf_collaborators",
  "shelf_items",
  "shelves",
  "user_media_states",
  "verdicts",
  "watch_events",
  "watch_rooms",
];
const ownerPolicies = [
  "user_media_states_owner",
  "watch_events_owner",
  "verdicts_owner",
  "pairwise_comparisons_owner",
];

const client = new Client({ connectionString: connectionUrl.toString() });

try {
  await client.connect();
  const tables = await client.query(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  `);
  const tableMap = new Map(
    tables.rows.map((row) => [row.table_name, row.rls_enabled]),
  );
  const missingTables = expectedTables.filter((table) => !tableMap.has(table));
  const unprotectedTables = expectedTables.filter(
    (table) => tableMap.get(table) !== true,
  );
  if (missingTables.length || unprotectedTables.length) {
    throw new Error(
      `RLS table verification failed. Missing: ${missingTables.join(", ") || "none"}. Unprotected: ${unprotectedTables.join(", ") || "none"}.`,
    );
  }

  const syncMarker = await client.query(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'library_initialized_at'
        and data_type = 'timestamp with time zone'
    ) as present
  `);
  if (!syncMarker.rows[0]?.present) {
    throw new Error(
      "The durable profile library initialization marker is missing.",
    );
  }

  const policies = await client.query(`
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
  `);
  const policyMap = new Map(policies.rows.map((row) => [row.policyname, row]));
  const invalidOwnerPolicies = ownerPolicies.filter((name) => {
    const policy = policyMap.get(name);
    return (
      !policy ||
      policy.cmd !== "ALL" ||
      !policy.qual?.includes("auth.user_id()") ||
      !policy.with_check?.includes("auth.user_id()")
    );
  });
  if (invalidOwnerPolicies.length) {
    throw new Error(
      `Owner policy verification failed: ${invalidOwnerPolicies.join(", ")}.`,
    );
  }

  const publicRoleGrants = await client.query(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('PUBLIC', 'anonymous')
  `);
  if (publicRoleGrants.rowCount) {
    throw new Error(
      `Unexpected anonymous table grants: ${publicRoleGrants.rows
        .map((row) => `${row.grantee}.${row.table_name}.${row.privilege_type}`)
        .join(", ")}.`,
    );
  }

  const protectedProviderGrants = await client.query(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and table_name in ('media_provider_ids', 'provider_metadata_cache')
  `);
  if (protectedProviderGrants.rowCount) {
    throw new Error(
      `Provider cache tables are exposed to authenticated browsers: ${protectedProviderGrants.rows
        .map((row) => `${row.table_name}.${row.privilege_type}`)
        .join(", ")}.`,
    );
  }

  const curatedProviderIds = await client.query(`
    select count(*)::integer as count
    from public.media_provider_ids
    where provider = 'tmdb'
      and media_id in (
        select id
        from public.media
        where metadata ->> 'catalog' = 'development'
      )
  `);
  if (curatedProviderIds.rows[0]?.count !== 14) {
    throw new Error(
      `Expected 14 curated TMDB provider mappings, found ${curatedProviderIds.rows[0]?.count ?? 0}.`,
    );
  }

  console.log(
    `Verified ${expectedTables.length} RLS-protected tables, ${policies.rowCount} policies, 14 curated provider mappings, and restricted provider caches; no anonymous table grants found.`,
  );
} finally {
  await client.end();
}
