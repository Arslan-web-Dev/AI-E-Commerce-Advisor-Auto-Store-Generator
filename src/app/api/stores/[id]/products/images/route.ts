import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST multipart product image upload to the owner-controlled Storage bucket. */
export async function POST(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const productId = typeof formData?.get('productId') === 'string'
    ? String(formData.get('productId'))
    : null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
  }
  if (!MIME_EXTENSION[file.type]) {
    return NextResponse.json({ error: 'Only JPEG, PNG and WebP images are accepted.' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be between 1 byte and 5 MB.' }, { status: 400 });
  }

  if (productId) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!product) return NextResponse.json({ error: 'Product not found for this store.' }, { status: 404 });
  }

  const extension = MIME_EXTENSION[file.type];
  const path = `${storeId}/${productId ?? 'new'}_${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 });

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, url: publicUrl.publicUrl }, { status: 201 });
}
