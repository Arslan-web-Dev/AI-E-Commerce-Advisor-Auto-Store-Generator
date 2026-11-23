export interface DistrictBenchmark {
  district: string;
  division: string;
  population_total: number;
  population_urban: number;
  urbanization_rate: number;
  literacy_rate: number;
  commercial_rent_sqft_min: number;
  commercial_rent_sqft_max: number;
  commercial_rent_sqft_avg: number;
  purchasing_power_index: number;
  retail_density_score: number;
  primary_commercial_hubs: string[];
  economic_drivers: string[];
  [key: string]: unknown;
}

export const PUNJAB_DISTRICT_BENCHMARKS: DistrictBenchmark[] = [
  {
    district: 'Lahore',
    division: 'Lahore',
    population_total: 13004135,
    population_urban: 13004135,
    urbanization_rate: 100.0,
    literacy_rate: 78.5,
    commercial_rent_sqft_min: 120.0,
    commercial_rent_sqft_max: 450.0,
    commercial_rent_sqft_avg: 240.0,
    purchasing_power_index: 88.5,
    retail_density_score: 92.0,
    primary_commercial_hubs: ['Gulberg (MM Alam / Main Blvd)', 'DHA (Y / H / Z Blocks)', 'Mall Road', 'Johar Town / Emporium Hub', 'Liberty Market', 'Anarkali'],
    economic_drivers: ['Financial & Corporate Services', 'Retail & Hospitality', 'Textiles & Fashion', 'Tech & Logistics Hub']
  },
  {
    district: 'Rawalpindi',
    division: 'Rawalpindi',
    population_total: 5537045,
    population_urban: 3105000,
    urbanization_rate: 56.1,
    literacy_rate: 82.3,
    commercial_rent_sqft_min: 90.0,
    commercial_rent_sqft_max: 350.0,
    commercial_rent_sqft_avg: 195.0,
    purchasing_power_index: 82.0,
    retail_density_score: 80.5,
    primary_commercial_hubs: ['Saddar Commercial', 'Bahria Town Commercial Hubs', 'Murree Road', 'Raja Bazaar', 'Peshawar Road'],
    economic_drivers: ['Services & Government', 'Defense & Logistics', 'Wholesale Trading', 'Real Estate Development']
  },
  {
    district: 'Faisalabad',
    division: 'Faisalabad',
    population_total: 8838883,
    population_urban: 3691999,
    urbanization_rate: 41.8,
    literacy_rate: 70.1,
    commercial_rent_sqft_min: 70.0,
    commercial_rent_sqft_max: 280.0,
    commercial_rent_sqft_avg: 150.0,
    purchasing_power_index: 75.0,
    retail_density_score: 78.0,
    primary_commercial_hubs: ['D-Ground Peoples Colony', 'Clock Tower 8 Bazaars', 'Susan Road', 'Jaranwala Road Commercial', 'Sargodha Road Hub'],
    economic_drivers: ['Textile Manufacturing & Exports', 'Ginning & Milling', 'Agricultural Trade & Machinery', 'Fast Moving Consumer Goods']
  },
  {
    district: 'Multan',
    division: 'Multan',
    population_total: 5362305,
    population_urban: 2315000,
    urbanization_rate: 43.2,
    literacy_rate: 61.2,
    commercial_rent_sqft_min: 60.0,
    commercial_rent_sqft_max: 240.0,
    commercial_rent_sqft_avg: 130.0,
    purchasing_power_index: 68.0,
    retail_density_score: 69.5,
    primary_commercial_hubs: ['Cantonment Saddar', 'Gulgasht Colony Commercial', 'Bosan Road Hub', 'Hussain Agahi', 'Chowk Kachehri'],
    economic_drivers: ['Cotton & Mango Agro-Processing', 'Fertilizers & Chemicals', 'Regional Wholesale Hub for South Punjab']
  },
  {
    district: 'Gujranwala',
    division: 'Gujranwala',
    population_total: 5988110,
    population_urban: 3100000,
    urbanization_rate: 51.8,
    literacy_rate: 73.5,
    commercial_rent_sqft_min: 65.0,
    commercial_rent_sqft_max: 260.0,
    commercial_rent_sqft_avg: 140.0,
    purchasing_power_index: 74.0,
    retail_density_score: 76.0,
    primary_commercial_hubs: ['Satellite Town Market', 'Model Town Commercial', 'GT Road Commercial Belt', 'Rail Bazaar'],
    economic_drivers: ['Sanitary & Ceramics', 'Light Engineering & Cutlery', 'Electrical Appliances & Motors', 'Rice Processing']
  },
  {
    district: 'Sialkot',
    division: 'Gujranwala',
    population_total: 4499394,
    population_urban: 1520000,
    urbanization_rate: 33.8,
    literacy_rate: 74.8,
    commercial_rent_sqft_min: 70.0,
    commercial_rent_sqft_max: 270.0,
    commercial_rent_sqft_avg: 145.0,
    purchasing_power_index: 79.0,
    retail_density_score: 74.0,
    primary_commercial_hubs: ['Cantonment Mall Area', 'Kashmir Road Commercial', 'Paris Road', 'Defense Road'],
    economic_drivers: ['Surgical Instruments Export', 'Sports Goods Export', 'Leather Garments & Footwear', 'Light Aviation']
  },
  {
    district: 'Bahawalpur',
    division: 'Bahawalpur',
    population_total: 4284964,
    population_urban: 1280000,
    urbanization_rate: 29.9,
    literacy_rate: 53.4,
    commercial_rent_sqft_min: 45.0,
    commercial_rent_sqft_max: 180.0,
    commercial_rent_sqft_avg: 95.0,
    purchasing_power_index: 58.0,
    retail_density_score: 56.0,
    primary_commercial_hubs: ['Circular Road Bazaar', 'Model Town Commercial', 'Satellite Town', 'Farid Gate Market'],
    economic_drivers: ['Agriculture Trade (Cotton & Wheat)', 'Education Hub', 'Tourism & Handicrafts']
  },
  {
    district: 'Sargodha',
    division: 'Sargodha',
    population_total: 4595230,
    population_urban: 1480000,
    urbanization_rate: 32.2,
    literacy_rate: 65.8,
    commercial_rent_sqft_min: 50.0,
    commercial_rent_sqft_max: 200.0,
    commercial_rent_sqft_avg: 105.0,
    purchasing_power_index: 62.0,
    retail_density_score: 61.0,
    primary_commercial_hubs: ['Kutchery Bazaar', 'Satellite Town', 'University Road Hub', 'Fatima Jinnah Road'],
    economic_drivers: ['Citrus (Kinnow) Agro-Industry', 'Defense Services Base', 'Grain & Sugarcane Processing']
  },
  {
    district: 'Sahiwal',
    division: 'Sahiwal',
    population_total: 2881511,
    population_urban: 720000,
    urbanization_rate: 25.0,
    literacy_rate: 64.2,
    commercial_rent_sqft_min: 40.0,
    commercial_rent_sqft_max: 170.0,
    commercial_rent_sqft_avg: 90.0,
    purchasing_power_index: 60.0,
    retail_density_score: 58.0,
    primary_commercial_hubs: ['High Street Commercial', 'Liaquat Road', 'Fateh Sher Road', 'Farid Town'],
    economic_drivers: ['Dairy Processing & Livestock', 'Cotton & Tobacco Trading', 'Edible Oil Processing']
  },
  {
    district: 'Sheikhupura',
    division: 'Lahore',
    population_total: 4049861,
    population_urban: 1420000,
    urbanization_rate: 35.1,
    literacy_rate: 65.4,
    commercial_rent_sqft_min: 45.0,
    commercial_rent_sqft_max: 190.0,
    commercial_rent_sqft_avg: 100.0,
    purchasing_power_index: 64.0,
    retail_density_score: 62.0,
    primary_commercial_hubs: ['Main Bazaar', 'Housing Colony Commercial', 'Lahore-Sargodha Road Hub', 'Bhikhi Road'],
    economic_drivers: ['Industrial Processing (Rice & Paper)', 'Automotive Assembly', 'Proximity to Lahore Logistics']
  }
];
