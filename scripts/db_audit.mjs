import fs from 'fs';
import process from 'process';

const envRaw = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = envRaw.match(/SUPABASE_URL\s*=\s*"?([^"\r\n]+)"?/)?.[1];
const SERVICE_ROLE = envRaw.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^"\r\n]+)"?/)?.[1];

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const tables = [
  'profiles',
  'user_roles',
  'fee_balances',
  'library_loans',
  'ict_assets',
  'hostel_assignments',
  'sports_loans',
  'clearance_requests',
  'dept_reviews',
];

async function getCount(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=0`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: 'count=exact',
    },
  });
  const cr = res.headers.get('content-range');
  if (!cr) return { table, count: 'unknown' };
  const parts = cr.split('/');
  return { table, count: parts[1] };
}

async function main() {
  console.log('Supabase URL:', SUPABASE_URL);
  const results = {};
  for (const t of tables) {
    try {
      const r = await getCount(t);
      results[t] = r.count;
      console.log(`${t} -> ${r.count}`);
    } catch (e) {
      results[t] = `ERROR: ${e.message}`;
      console.log(`${t} -> ERROR: ${e.message}`);
    }
  }

  // role counts
  const roles = ['student', 'admin', 'department'];
  for (const role of roles) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/user_roles?select=role&role=eq.${role}&limit=0`;
      const res = await fetch(url, {
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, Prefer: 'count=exact' },
      });
      const cr = res.headers.get('content-range');
      const count = cr ? cr.split('/')[1] : 'unknown';
      console.log(`total ${role} -> ${count}`);
      results[`role_${role}`] = count;
    } catch (e) {
      console.log(`total ${role} -> ERROR: ${e.message}`);
      results[`role_${role}`] = `ERROR: ${e.message}`;
    }
  }

  // print JSON summary to stdout
  console.log('\nSUMMARY_JSON_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('SUMMARY_JSON_END');
}

main();
