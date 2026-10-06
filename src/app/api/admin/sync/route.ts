import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Server-side RBAC check: verify user role in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only verified system administrators can execute GitHub configuration sync.' },
        { status: 403 }
      );
    }

    const githubToken = process.env.GITHUB_SYNC_TOKEN;
    const githubRepo = process.env.GITHUB_SYNC_REPO; // format: owner/repo
    const githubBranch = process.env.GITHUB_SYNC_BRANCH || 'main';

    if (!githubToken || !githubRepo) {
      return NextResponse.json(
        {
          error: 'GitHub Sync not configured on server. Please set GITHUB_SYNC_TOKEN and GITHUB_SYNC_REPO environment variables.',
          configured: false,
        },
        { status: 422 }
      );
    }

    // Fetch approved system configuration items from system_config and rent_cache summary
    const adminSupabase = createAdminClient();
    const { data: configRows, error: configError } = await adminSupabase
      .from('system_config')
      .select('config_key, description, payload, updated_at');

    if (configError) {
      console.error('[Config Fetch Error]:', configError.message);
    }

    // Rent cache aggregated snapshot (city, area, rent_per_sqft_pkr, sample_size)
    const { data: rentRows } = await adminSupabase
      .from('rent_cache')
      .select('city, area, rent_per_sqft_pkr, sample_size, scraped_at')
      .limit(100);

    const timestamp = new Date().toISOString();
    const exportedKeys = (configRows || []).map((r) => r.config_key);
    exportedKeys.push('rent_cache_snapshot');

    // Strict non-PII sanitization
    const exportPayload = {
      system: 'AI-Powered E-Commerce Feasibility Advisor',
      schema_version: '2.0',
      exported_at: timestamp,
      configuration: {
        items: (configRows || []).reduce<Record<string, unknown>>((acc, row) => {
          acc[row.config_key] = {
            description: row.description,
            data: row.payload,
            updated_at: row.updated_at,
          };
          return acc;
        }, {}),
        rent_cache_snapshot: rentRows || [],
      },
    };

    const filePath = `config/system-config-${timestamp.replace(/[:.]/g, '-')}.json`;
    const latestFilePath = `config/latest-system-config.json`;
    const contentEncoded = Buffer.from(JSON.stringify(exportPayload, null, 2)).toString('base64');
    const commitMessage = `chore(config): automated system configuration sync at ${timestamp} [FR-1.6]`;

    // 1. Check if latest-system-config.json already exists to obtain its sha for update
    let latestSha: string | undefined;
    try {
      const getFileRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/contents/${latestFilePath}?ref=${githubBranch}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'FeasibilityAdvisor-Sync/2.0',
          },
        }
      );
      if (getFileRes.ok) {
        const fileJson = await getFileRes.json();
        latestSha = fileJson.sha;
      }
    } catch {
      // file might not exist yet
    }

    // 2. Put file to GitHub REST API
    const githubApiUrl = `https://api.github.com/repos/${githubRepo}/contents/${latestFilePath}`;
    const pushResponse = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'FeasibilityAdvisor-Sync/2.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: contentEncoded,
        branch: githubBranch,
        ...(latestSha ? { sha: latestSha } : {}),
      }),
    });

    const pushResult = await pushResponse.json();

    if (!pushResponse.ok) {
      const errorMessage = pushResult.message || `GitHub API error (HTTP ${pushResponse.status})`;
      // Record failure audit log
      await adminSupabase.from('config_sync_audit_log').insert({
        actor_id: user.id,
        repository: githubRepo,
        branch: githubBranch,
        status: 'failed',
        exported_keys: exportedKeys,
        error_message: errorMessage,
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          repository: githubRepo,
        },
        { status: 502 }
      );
    }

    const commitSha = pushResult.commit?.sha || pushResult.content?.sha;

    // Record successful audit log
    await adminSupabase.from('config_sync_audit_log').insert({
      actor_id: user.id,
      repository: githubRepo,
      branch: githubBranch,
      commit_sha: commitSha,
      status: 'success',
      exported_keys: exportedKeys,
    });

    return NextResponse.json({
      success: true,
      repository: githubRepo,
      branch: githubBranch,
      commit_sha: commitSha,
      timestamp,
      exported_keys: exportedKeys,
      message: 'System configuration synced to GitHub repository successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
