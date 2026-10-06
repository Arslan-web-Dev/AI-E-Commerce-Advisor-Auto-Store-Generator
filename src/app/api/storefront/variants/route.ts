import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VARIANT_CATALOG, validateVariantId, getVariantsByType } from '@/lib/storefront/variant-catalog';

// GET — list the full variant catalog (authenticated)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const category = url.searchParams.get('category');

  let variants = VARIANT_CATALOG;

  if (type) {
    variants = variants.filter((v) => v.componentType === type);
  }

  if (category) {
    variants = variants.filter(
      (v) => v.supportedCategories.length === 0 || v.supportedCategories.includes(category)
    );
  }

  // Never expose internal fields like incompatibleWith to client — keep that server-side only
  const safe = variants.map(({ id, name, componentType, description, availability, 
    supportedCategories, pageSlots, requiredProps, optionalProps,
    responsiveBehavior, accessibilityNotes, themeTokens, requiresData, fallbackBehavior }) => ({
    id, name, componentType, description, availability,
    supportedCategories, pageSlots, requiredProps, optionalProps,
    responsiveBehavior, accessibilityNotes, themeTokens, requiresData, fallbackBehavior,
  }));

  return NextResponse.json({ data: safe, count: safe.length });
}
