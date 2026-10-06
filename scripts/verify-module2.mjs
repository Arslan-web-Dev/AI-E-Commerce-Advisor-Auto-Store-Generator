import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('Module 2 Verification: Business Idea & Project Wizard');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Verify Deliverable Files Exist
console.log('1. Checking Module 2 File Deliverables...');

const requiredFiles = [
  'supabase/migrations/20261006000000_module2_projects_wizard_schema.sql',
  'src/types/project.ts',
  'src/lib/validation/project.ts',
  'src/components/wizard/BusinessIdeaWizard.tsx',
  'src/app/wizard/page.tsx',
  'src/app/wizard/[id]/page.tsx',
  'src/app/projects/page.tsx',
  'src/app/projects/[id]/page.tsx',
  'src/app/api/projects/route.ts',
  'src/app/api/projects/[id]/route.ts',
  'src/app/api/projects/[id]/submit/route.ts',
  'src/app/api/projects/upload/route.ts',
  'docs/module-2-business-idea.md',
  'docs/api.md',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
}

// 2. Verify Schema Integrity
console.log('\n2. Checking PostgreSQL Migration Schema...');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261006000000_module2_projects_wizard_schema.sql'),
  'utf-8'
);

assert(migrationSql.includes('create table if not exists public.projects'), 'Table public.projects defined');
assert(migrationSql.includes('create type public.project_status'), 'Type public.project_status enum defined');
assert(migrationSql.includes('create type public.business_scale'), 'Type public.business_scale enum defined');
assert(migrationSql.includes('owner_id'), 'owner_id foreign key defined');
assert(migrationSql.includes('alter table public.projects enable row level security'), 'RLS enabled on projects');
assert(migrationSql.includes('alter table public.projects force row level security'), 'RLS forced on projects');
assert(migrationSql.includes('create policy projects_owner_select'), 'Owner select RLS policy defined');
assert(migrationSql.includes('create policy projects_owner_insert'), 'Owner insert RLS policy defined');
assert(migrationSql.includes("status = 'draft'"), 'Draft-only modification rule enforced in RLS');

// 3. Verify Route Protection in Middleware
console.log('\n3. Checking Route Protection & Middleware...');
const middlewareCode = fs.readFileSync(
  path.join(rootDir, 'src/lib/supabase/middleware.ts'),
  'utf-8'
);

assert(middlewareCode.includes("pathname.startsWith('/wizard')"), 'Wizard path protected in middleware');
assert(middlewareCode.includes("pathname.startsWith('/projects')"), 'Projects path protected in middleware');

// 4. Verify API Route Handlers
console.log('\n4. Checking Server-Side API Handlers...');
const submitCode = fs.readFileSync(
  path.join(rootDir, 'src/app/api/projects/[id]/submit/route.ts'),
  'utf-8'
);
assert(submitCode.includes('from(\'feasibility_reports\')'), 'Submit route links to feasibility_reports');
assert(submitCode.includes("status: 'submitted'"), "Submit route transitions status to 'submitted'");
assert(submitCode.includes('validateCompleteProject'), 'Submit route enforces complete project validation');
assert(submitCode.includes('project.owner_id !== user.id'), 'Submit route verifies ownership');

const projectsCode = fs.readFileSync(
  path.join(rootDir, 'src/app/api/projects/route.ts'),
  'utf-8'
);
assert(projectsCode.includes('owner_id: user.id'), 'POST /api/projects binds authenticated user id');
assert(projectsCode.includes('query.eq(\'owner_id\', user.id)'), 'GET /api/projects scopes to user unless admin');

console.log('\n----------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed.`);
console.log('----------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Module 2 file, schema, and route checks PASSED!\n');
}
