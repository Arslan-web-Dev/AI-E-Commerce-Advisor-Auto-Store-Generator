import {
  CompetitorRecord,
  CompetitorQueryInput,
  ICompetitorProvider,
} from '../../../types/data-collection';

const CATEGORY_SAMPLE_NAMES: Record<string, string[]> = {
  'Apparel & Fashion': [
    'Khaadi Flagship Store',
    'Sapphire Retail Boutique',
    'J. Junaid Jamshed Outlet',
    'Alkaram Studio',
    'Generation Prêt Wear',
    'Gul Ahmed Ideas',
    'Bonanza Satrangi',
    'Outfitters Urban',
    'Charcoal Menswear',
    'Ethnic by Outfitters',
  ],
  'Consumer Electronics': [
    'Haier Experience Mall',
    'Mega Tech Electronics',
    'Samsung Smart Plaza',
    'Apple Premium Reseller (iStore)',
    'Sony World Center',
    'HyperX Gaming & Audio Hub',
    'Orient Digital Showroom',
    'Anis Electronics Trading',
    'City Sound & Mobile Hub',
  ],
  'Cosmetics & Skincare': [
    'Conatural Organic Botanicals',
    'Saeed Ghani Herbal Remedies',
    'WB by Hemani Naturals',
    'The Body Shop Outlet',
    'Dermacos Skincare Lounge',
    'Luscious Cosmetics Studio',
    'Organic Bloom Herbals',
    'Pure Desi Essentials',
  ],
  'Grocery & Gourmet Food': [
    'Al-Fatah Gourmet Superstore',
    'Jalal Sons Artisan Pantry',
    'Esajees Gourmet & Dry Fruits',
    'Green Valley Premium Mart',
    'Imtiaz Mega Store',
    'Hunza Harvest Organic Outlet',
    'Metro Cash & Carry Hub',
    'Rainbow Cash & Carry',
  ],
  'Home Decor & Living': [
    'Habitt Furniture & Living',
    'Interwood Showroom',
    'Dolce Vita Gallery',
    'Kalamkaar Handcrafted Pottery',
    'Renaissance Interior Studio',
    'Chiniot Artisan Woodworks',
    'Modern Living Rugs & Lamps',
  ],
  'Other Niche Venture': [
    'Prime Niche Trading Outlet',
    'Apex Venture Boutique',
    'Urban Niche Store',
    'Crossroads Commercial Kiosk',
    'Pioneer Speciality Hub',
  ],
};

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export class DemoCompetitorProvider implements ICompetitorProvider {
  name = 'demo_competitors';
  provenance = 'synthetic_demo' as const;

  async getCompetitors(input: CompetitorQueryInput): Promise<CompetitorRecord[]> {
    const names = CATEGORY_SAMPLE_NAMES[input.category] || CATEGORY_SAMPLE_NAMES['Other Niche Venture'];
    const seed = simpleHash(`${input.category}-${input.city || 'default'}-${input.lat.toFixed(2)}`);

    const count = 6 + (seed % 6); // 6 to 11 competitors
    const records: CompetitorRecord[] = [];

    for (let i = 0; i < count; i++) {
      const nameIndex = (seed + i) % names.length;
      const baseName = names[nameIndex];
      const name = i > names.length - 1 ? `${baseName} (Branch ${i + 1})` : baseName;

      // Deterministic coordinate offset within radius
      const angle = ((seed * (i + 1) * 37) % 360) * (Math.PI / 180);
      const dist = 0.3 + ((seed + i * 47) % Math.round(input.radiusKm * 85)) / 100;
      const dLat = (dist / 111) * Math.cos(angle);
      const dLng = (dist / (111 * Math.cos((input.lat * Math.PI) / 180))) * Math.sin(angle);

      const lat = Math.round((input.lat + dLat) * 10000) / 10000;
      const lng = Math.round((input.lng + dLng) * 10000) / 10000;

      const rating = 3.8 + ((seed + i * 13) % 12) / 10;
      const reviewCount = 15 + ((seed + i * 83) % 450);
      const priceLevels = ['Budget', 'Moderate', 'Premium', 'Luxury'];
      const priceLevel = priceLevels[(seed + i) % priceLevels.length];

      records.push({
        project_id: '',
        name,
        category: input.category,
        provider: this.name,
        provenance: this.provenance,
        lat,
        lng,
        distance_km: Math.round(dist * 100) / 100,
        rating: Math.min(5.0, Math.round(rating * 10) / 10),
        review_count: reviewCount,
        price_level: priceLevel,
        address: `${input.city || 'Commercial Hub'}, Pakistan (Synthetic Benchmark Location)`,
        raw_data: {
          synthetic_seed: seed,
          simulation_mode: true,
        },
        retrieved_at: new Date().toISOString(),
      });
    }

    records.sort((a, b) => a.distance_km - b.distance_km);
    return records;
  }
}
