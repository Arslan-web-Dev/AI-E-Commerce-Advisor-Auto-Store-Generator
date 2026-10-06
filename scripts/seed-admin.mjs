#!/usr/bin/env node

/**
 * Seed Administrator Bootstrap Workflow (SRS FR-1.5)
 * 
 * Safely provisions or reconciles the initial platform administrator account:
 * - Reads credentials strictly from environment variables (INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD).
 * - Uses Supabase Service Role client (server-side admin API).
 * - Enforces role = 'admin' and must_change_password = true in public.profiles.
 * - Idempotent and safe to re-run without creating duplicates.
 * - Confirms email automatically so administrator can sign in immediately.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

async function seedAdmin() {
  console.log('[Seed-Admin] Starting administrator bootstrap workflow...');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Seed-Admin] Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  if (!adminEmail || !adminPassword) {
    console.error('[Seed-Admin] Error: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be configured.');
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('[Seed-Admin] Error: INITIAL_ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Check if admin user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('[Seed-Admin] Failed to list auth users:', listError.message);
    process.exit(1);
  }

  let adminUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
  );

  if (!adminUser) {
    console.log(`[Seed-Admin] Creating new auth account for administrator...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Platform Administrator'
      }
    });

    if (createError) {
      console.error('[Seed-Admin] Error creating admin auth account:', createError.message);
      process.exit(1);
    }
    adminUser = createData.user;
    console.log(`[Seed-Admin] Auth account created successfully.`);
  } else {
    console.log(`[Seed-Admin] Existing auth account found for configured admin identity.`);
    // Optionally update password if requested
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
      email_confirm: true
    });
    if (updateAuthError) {
      console.error('[Seed-Admin] Warning updating admin password:', updateAuthError.message);
    }
  }

  // Ensure public.profiles record has role = 'admin' and must_change_password = true
  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('id, role, must_change_password')
    .eq('id', adminUser.id)
    .maybeSingle();

  if (profileFetchError) {
    console.error('[Seed-Admin] Error fetching admin profile:', profileFetchError.message);
    process.exit(1);
  }

  if (!profile) {
    console.log('[Seed-Admin] Creating admin profile record...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: adminUser.id,
        full_name: 'Platform Administrator',
        role: 'admin',
        must_change_password: true
      });

    if (insertError) {
      console.error('[Seed-Admin] Error inserting admin profile:', insertError.message);
      process.exit(1);
    }
  } else {
    console.log('[Seed-Admin] Updating profile role to admin and enforcing must_change_password...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        must_change_password: true
      })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error('[Seed-Admin] Error updating admin profile:', updateError.message);
      process.exit(1);
    }
  }

  console.log('[Seed-Admin] Bootstrap complete: Administrator account verified and secured.');
}

seedAdmin().catch((err) => {
  console.error('[Seed-Admin] Unexpected failure:', err);
  process.exit(1);
});
