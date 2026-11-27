import type { ForkliftCategory, TruckType } from '@/types'

export interface ForkliftPreset extends Omit<TruckType, 'id'> {
  presetId: string
  category: ForkliftCategory
}

export const FORKLIFT_CATEGORY_NAMES: Record<ForkliftCategory, string> = {
  'pallet-truck': 'Pallet trucks',
  stacker: 'Stackers',
  'reach-truck': 'Reach trucks',
  'counterbalance-forklift': 'Counterbalance forklifts',
}

export const FORKLIFT_PRESETS: ForkliftPreset[] = [
  {
    presetId: 'jungheinrich-eje-116i',
    name: 'Jungheinrich EJE 116i',
    category: 'pallet-truck',
    manufacturer: 'Jungheinrich',
    model: 'EJE 116i',
    configuration: 'Standard 1,600 kg model; aisle width for a 1,000 × 1,200 mm pallet crossways.',
    sourceUrl: 'https://media.prod.shop.jungheinrichcloud.com/PCMSS/en/918a3d06dd804e5916606cc1f6e227f190338fdd.pdf',
    widthMm: 720,
    lengthMm: 1566,
    turningRadiusMm: 1363,
    minimumAisleWidthMm: 2170,
    loadCapacityKg: 1600,
    energyType: 'electric',
    batteryType: 'Lithium-ion',
    compatibleChargerTypes: [],
  },
  {
    presetId: 'jungheinrich-ejc-112i',
    name: 'Jungheinrich EJC 112i',
    category: 'stacker',
    manufacturer: 'Jungheinrich',
    model: 'EJC 112i',
    configuration: '1,200 kg model; supplier dimensions and outside turning radius. Aisle width not listed in this source.',
    sourceUrl: 'https://mateco-hungary.hu/en/pallet-trucks/ejc-112i',
    widthMm: 800,
    lengthMm: 1822,
    turningRadiusMm: 1409,
    minimumAisleWidthMm: null,
    loadCapacityKg: 1200,
    energyType: 'electric',
    batteryType: 'Lithium-ion',
    compatibleChargerTypes: [],
  },
  {
    presetId: 'toyota-rre120b',
    name: 'Toyota BT Reflex RRE120B',
    category: 'reach-truck',
    manufacturer: 'Toyota Material Handling',
    model: 'BT Reflex RRE120B',
    configuration: '1,200 kg basic model; aisle width for a 1,000 × 1,200 mm pallet crossways.',
    sourceUrl: 'https://media.toyota-forklifts.eu/published/21500_Original%20document_toyota%20mh.pdf',
    widthMm: 1120,
    lengthMm: 2364,
    turningRadiusMm: 1668,
    minimumAisleWidthMm: 2680,
    loadCapacityKg: 1200,
    energyType: 'electric',
    compatibleChargerTypes: [],
  },
  {
    presetId: 'linde-e16p-series-1251',
    name: 'Linde E16 P (series 1251)',
    category: 'counterbalance-forklift',
    manufacturer: 'Linde Material Handling',
    model: 'E16 P',
    configuration: 'Series 1251 standard configuration; aisle width for a 1,000 × 1,200 mm pallet crossways.',
    sourceUrl: 'https://www.linde-mh.com/media/Datasheets/EN_ds_e16_e20_p_1251_en_b_0825_view.pdf',
    widthMm: 1086,
    lengthMm: 2963,
    turningRadiusMm: 1693,
    minimumAisleWidthMm: 3389,
    loadCapacityKg: 1600,
    energyType: 'electric',
    compatibleChargerTypes: [],
  },
]
