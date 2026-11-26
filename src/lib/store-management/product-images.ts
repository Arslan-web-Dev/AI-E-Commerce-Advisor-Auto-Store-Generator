/** Product image URL validation for owner-managed catalogue writes. */

const MAX_IMAGES = 8;

export interface ImageValidation {
  ok: boolean;
  images: string[];
  error?: string;
}

/** Only absolute HTTPS URLs or same-app relative paths are accepted. */
export function validateProductImages(value: unknown): ImageValidation {
  if (value === undefined) return { ok: true, images: [] };
  if (!Array.isArray(value)) return { ok: false, images: [], error: 'images must be an array.' };
  if (value.length > MAX_IMAGES) {
    return { ok: false, images: [], error: `A product may have at most ${MAX_IMAGES} images.` };
  }

  const images: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > 500) {
      return { ok: false, images: [], error: 'Each image must be a URL no longer than 500 characters.' };
    }
    const url = item.trim();
    if (url.startsWith('/') && !url.startsWith('//')) {
      images.push(url);
      continue;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('insecure');
      images.push(parsed.toString());
    } catch {
      return { ok: false, images: [], error: 'Images must use HTTPS or a same-app relative path.' };
    }
  }
  return { ok: true, images: [...new Set(images)] };
}
