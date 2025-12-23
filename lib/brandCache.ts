export type CachedBrand = {
  owner_id: string;
  brand_name: string | null;
  logo_url: string | null;
  cached_at: number;
};

const STORAGE_KEY = 'bitora-brand-v1';

export function getCachedBrand(ownerId: string): CachedBrand | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBrand>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.owner_id !== ownerId) return null;
    return {
      owner_id: ownerId,
      brand_name: typeof parsed.brand_name === 'string' ? parsed.brand_name : null,
      logo_url: typeof parsed.logo_url === 'string' ? parsed.logo_url : null,
      cached_at: typeof parsed.cached_at === 'number' ? parsed.cached_at : Date.now(),
    };
  } catch {
    return null;
  }
}

export function setCachedBrand(ownerId: string, brandName: string | null, logoUrl: string | null) {
  if (typeof window === 'undefined') return;
  const payload: CachedBrand = {
    owner_id: ownerId,
    brand_name: brandName,
    logo_url: logoUrl,
    cached_at: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearCachedBrand() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
