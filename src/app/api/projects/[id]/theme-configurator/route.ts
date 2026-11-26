import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateThemeConfiguration } from '@/lib/theme/generator';
import {
  getThemeProject,
  getThemeState,
  saveThemeConfiguration,
  saveWizardDraft,
  ThemePersistenceError,
} from '@/lib/theme/persistence';
import {
  assertValidAnswerDraft,
  assertValidAnswers,
  assertValidThemeConfiguration,
  type ThemeAnswers,
  type ThemeConfiguration,
} from '@/lib/theme/schema';

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof ThemePersistenceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Theme request failed.';
  const safeMessage = message.length <= 240 ? message : 'Theme request failed.';
  return NextResponse.json({ error: safeMessage }, { status: 400 });
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ThemePersistenceError('validation', `${label} must be an object.`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw new ThemePersistenceError('validation', 'Request contains unsupported properties.');
  }
}

function asAnswers(value: unknown): ThemeAnswers {
  assertValidAnswers(value);
  return value;
}

function asAnswerDraft(value: unknown): Partial<ThemeAnswers> {
  assertValidAnswerDraft(value);
  return value;
}

function asConfiguration(value: unknown): ThemeConfiguration {
  assertValidThemeConfiguration(value);
  return value;
}

export async function GET(_request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    const data = await getThemeState(supabase, projectId, user.id);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ThemePersistenceError('validation', 'Request body must be valid JSON.');
    }
    assertObject(body, 'Request body');
    const action = body.action;
    if (typeof action !== 'string') {
      throw new ThemePersistenceError('validation', 'A valid action is required.');
    }

    if (action === 'save_draft') {
      assertExactKeys(body, ['action', 'answers', 'step']);
      const step = body.step;
      if (!Number.isInteger(step) || (step as number) < 1 || (step as number) > 4) {
        throw new ThemePersistenceError('validation', 'Wizard step must be between 1 and 4.');
      }
      const data = await saveWizardDraft(
        supabase,
        projectId,
        user.id,
        asAnswerDraft(body.answers),
        step as number,
      );
      return NextResponse.json({ data });
    }

    if (action === 'generate') {
      assertExactKeys(body, ['action', 'answers']);
      const project = await getThemeProject(supabase, projectId, user.id);
      const data = await generateThemeConfiguration({
        storeName: project.name,
        storeCategory: project.category,
        answers: asAnswers(body.answers),
        ownerId: user.id,
      });
      return NextResponse.json({ data });
    }

    if (action === 'save') {
      assertExactKeys(body, ['action', 'answers', 'configuration']);
      const data = await saveThemeConfiguration(
        supabase,
        projectId,
        user.id,
        asAnswers(body.answers),
        asConfiguration(body.configuration),
      );
      return NextResponse.json({ data });
    }

    throw new ThemePersistenceError('validation', 'Unsupported theme configurator action.');
  } catch (error) {
    return errorResponse(error);
  }
}
