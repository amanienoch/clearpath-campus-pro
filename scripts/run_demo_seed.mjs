import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envRaw = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = envRaw.match(/SUPABASE_URL\s*=\s*"?([^"\r\n]+)"?/)?.[1];
const SERVICE_ROLE = envRaw.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^"\r\n]+)"?/)?.[1];

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

const PROGRAMS = [
  "Computer Science",
  "Information Technology",
  "Software Engineering",
  "Business Information Systems",
  "Accounting",
  "Procurement",
  "Nursing",
  "Education",
];

const EAST_AFRICAN_FIRST = [
  "James", "Joseph", "Mercy", "Amina", "Khadija", "John", "Peter", "Grace", "Fatima", "Samson",
  "Daniel", "Patrick", "Esther", "Brian", "Mark", "Susan", "Lillian", "Mary", "Michael", "David",
  "Josephine", "Emmanuel", "Victor", "Irene", "Linda",
];

const EAST_AFRICAN_LAST = [
  "Njoroge", "Bana", "Okafor", "Eze", "Bello", "Adeyemi", "Johnson", "Yusuf", "Obi", "Okonkwo",
  "Mwangi", "Kagwa", "Kato", "Mkwawa", "Katosi", "Achieng", "Otieno", "Mugabe", "Ngugi", "Mugisha",
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function run() {
  console.log('Starting demo seed...');
  // Idempotency check
  const { data: existing } = await supabaseAdmin.from('profiles').select('id').ilike('matric_no','122%').limit(1);
  if (existing && existing.length > 0) {
    console.log('Demo seed appears to have already run. Aborting.');
    return;
  }

  let studentsCreated = 0;
  let obligations = { fees:0, loans:0, ict:0, hostel:0, sports:0 };
  let requestsCreated = 0;

  const now = new Date();
  for (let i=0;i<60;i++){
    const admission = (122000 + i).toString();
    const email = `${admission}@students.university.edu`;
    const name = `${rand(EAST_AFRICAN_FIRST)} ${rand(EAST_AFRICAN_LAST)}`;
    const program = rand(PROGRAMS);
    const year = (Math.floor(Math.random()*4)+1).toString();

    // create auth user or find
    let uid;
    try {
      const listResp = await supabaseAdmin.auth.admin.listUsers();
      const found = listResp.data?.users?.find(u => u.email?.toLowerCase()===email.toLowerCase());
      if (found) uid = found.id;
      else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password: admission, email_confirm: true, user_metadata: { name } });
        if (error) { console.error('createUser error', email, error.message); continue; }
        uid = created.user.id;
      }
    } catch(e){ console.error('auth error', e); continue; }

    await supabaseAdmin.from('profiles').upsert({ id: uid, name, email, matric_no: admission, program, faculty: 'Faculty of Science', level: year });
    await supabaseAdmin.from('user_roles').upsert({ user_id: uid, role: 'student' }, { onConflict: 'user_id,role' });
    studentsCreated++;

    if (Math.random() < 0.3) { const amounts=[3500,5000,12000,25000]; await supabaseAdmin.from('fee_balances').insert({ student_id: uid, item: 'Tuition arrears', amount_due: rand(amounts) }); obligations.fees++; }
    if (Math.random() < 0.25) { const books=['Database Systems','Java Programming','Operating Systems','Computer Networks']; await supabaseAdmin.from('library_loans').insert({ student_id: uid, book_title: rand(books), due_date: new Date(now.getTime()-Math.floor(Math.random()*20)*86400000).toISOString(), fine_amount: Math.random()<0.5?0:200, returned: Math.random()<0.5 }); obligations.loans++; }
    if (Math.random() < 0.1) { const assets=['Dell Latitude','HP EliteBook','Router','Projector']; await supabaseAdmin.from('ict_assets').insert({ student_id: uid, asset: rand(assets), replacement_cost: Math.floor(Math.random()*70000)+20000, returned: Math.random()<0.6 }); obligations.ict++; }
    if (Math.random() < 0.08) { const room = `H-${Math.floor(Math.random()*10)+1}${String.fromCharCode(65+Math.floor(Math.random()*6))}`; await supabaseAdmin.from('hostel_assignments').insert({ student_id: uid, room, damage_fee: Math.random()<0.3?Math.floor(Math.random()*5000)+1000:0, checked_out: Math.random()<0.3 }); obligations.hostel++; }
    if (Math.random() < 0.12) { const kits=['Football Kit','Basketball Jersey','Training Equipment']; await supabaseAdmin.from('sports_loans').insert({ student_id: uid, item: rand(kits), returned: Math.random()<0.5 }); obligations.sports++; }

    if (Math.random() < 0.4) {
      const clearanceId = `ECL-${now.getFullYear()}-${122000 + i}`;
      const { data: r } = await supabaseAdmin.from('clearance_requests').insert({ clearance_id: clearanceId, student_id: uid, student_name: name, matric_no: admission, program, faculty: 'Faculty of Science', level: year, email, reason: 'Graduation clearance', submitted_at: new Date(now.getTime()-Math.floor(Math.random()*30)*86400000).toISOString() }).select('id').single();
      if (r && r.id) {
        const randStatus = Math.random();
        if (randStatus < 0.6) { await supabaseAdmin.from('dept_reviews').update({ status: 'approved', remarks: 'Cleared', reviewed_by: 'System' }).eq('request_id', r.id); }
        else if (randStatus >= 0.85) { await supabaseAdmin.from('dept_reviews').update({ status: 'rejected', remarks: 'Outstanding issue', reviewed_by: 'System' }).eq('request_id', r.id).limit(1); }
        requestsCreated++;
      }
    }
  }

  await supabaseAdmin.from('activity_logs').insert({ actor: 'System', action: 'demo_seed', target: `created ${studentsCreated} students` });

  console.log('Done. Students created:', studentsCreated);
  console.log('Obligations:', obligations);
  console.log('Requests created:', requestsCreated);
}

run().catch(e=>{ console.error(e); process.exit(1); });
