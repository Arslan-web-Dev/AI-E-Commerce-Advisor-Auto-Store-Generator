import {
  CompetitorRecord,
  CompetitorQueryInput,
  ICompetitorProvider,
} from '../../../types/data-collection';

const CATEGORY_SAMPLE_NAMES: Record<string, string[]> = {
  'Grocery / General Stores': [
    'Al-Fatah Superstore',
    'Jalal Sons Grocery',
    'Green Valley Mart',
    'Imtiaz Mega Store',
    'Metro Cash & Carry Hub',
    'Rainbow Cash & Carry',
    'Esajees Grocery & Dry Fruits',
    'Hunza Harvest Grocers',
  ],
  'Clothing / Footwear': [
    'Khaadi Outlet',
    'Sapphire Retail Boutique',
    'J. Junaid Jamshed Store',
    'Alkaram Studio',
    'Generation Prêt Wear',
    'Gul Ahmed Ideas',
    'Bonanza Satrangi',
    'Outfitters Urban',
    'Bata Shoes Showroom',
    'Servis Footwear Outlet',
  ],
  'Mobile Phones / Accessories': [
    'Mobile Zone Franchise',
    'Samsung Smart Plaza',
    'Apple Premium Reseller (iStore)',
    'Orient Digital Showroom',
    'Anis Electronics Trading',
    'City Mobile & Accessories Hub',
    'Techno Mobile Outlet',
    'Mega Mobile Mart',
  ],
  'Restaurants / Cafes': [
    'Bundu Khan Restaurant',
    'Bar B.Q. Tonight',
    'Kababjees Restaurant',
    'Broadway Pizza',
    "Gloria Jean's Coffees",
    'Cafe Flo',
    'Howdy Restaurant',
    'United King Bakers',
  ],
  'Pharmacies / Medical Stores': [
    'Servaid Pharmacy',
    'D.Watson Chemist',
    'Green Cross Pharmacy',
    'Fazal Din Pharma Plus',
    'Clinix Pharmacy',
    'Nova Medicos',
    'Ferozsons Pharmacy',
    'Punjab Medical Store',
  ],
};

// Neutral generic sample names used when a category is not present in the map.
const FALLBACK_SAMPLE_NAMES: string[] = [
  'Prime General Store',
  'Apex Retail Outlet',
  'Urban Commercial Store',
  'Crossroads Trading',
  'Pioneer Speciality Hub',
];

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
    const names = CATEGORY_SAMPLE_NAMES[input.category] || FALLBACK_SAMPLE_NAMES;
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
        freshness: 'synthetic_demo',
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
          synthetic_demo: true,
        },
        retrieved_at: new Date().toISOString(),
      });
    }

    records.sort((a, b) => a.distance_km - b.distance_km);
    return records;
  }
}
