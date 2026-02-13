export const PRICING = {
  CALIBRATION_COST: 100,
  SUBCONTRACTOR_URETHANE_PER_PART: 15,
  SALES_TAX_PERCENT: 8.25,
  PROCESSING_FEE_RATE: 0.035,
  DEFAULT_URETHANE_PRICE: 25,
} as const;

export const LABOR_PRICING = {
  LEGACY_VEHICLE_CUTOFF_YEAR: 2016,
  LEGACY_ANY_GLASS_LABOR: 140,
  SEDAN_LABOR: 165,
  SUV_PICKUP_LABOR: 175,
  MINIVAN_LABOR: 175,
  CONVERTIBLE_LABOR: 195,
  DOOR_GLASS_LABOR: 90,
  QUARTER_GLASS_LABOR: 110,
  BACK_GLASS_LABOR: 140,
  BACK_GLASS_POWERSLIDE_LABOR: 175,
  VENT_GLASS_LABOR: 90,
  SUNROOF_LABOR: 175,
  DEFAULT_CALIBRATION_PRICE: 195,
  SUBCONTRACTOR_LABOR: 100,
  SUBCONTRACTOR_PREMIUM_LABOR: 125,
  DEALER_LABOR_MARKUP_RATE: 0.50,
  DEALER_LABOR_MINIMUM: 210,
  PART_PRICE_THRESHOLD_FOR_PREMIUM: 250,
} as const;

export const MOBILE_FEE = {
  ZONES: [
    { maxMilesOutside: 0, fee: 0, label: "Inside Loop 1604" },
    { maxMilesOutside: 5, fee: 10, label: "0-5 mi outside 1604" },
    { maxMilesOutside: 10, fee: 20, label: "5-10 mi outside 1604" },
    { maxMilesOutside: 15, fee: 25, label: "10-15 mi outside 1604" },
    { maxMilesOutside: 20, fee: 35, label: "15-20 mi outside 1604" },
    { maxMilesOutside: Infinity, fee: 50, label: "20+ mi outside 1604" },
  ],
} as const;

export const GLASS_TYPES_REQUIRING_URETHANE = [
  "windshield",
  "back_glass",
  "back_glass_powerslide",
  "quarter_glass",
] as const;

export const TIMEOUTS = {
  DEBOUNCE_ADDRESS_SEARCH_MS: 300,
  QUOTE_SMS_DELAY_MS: 900000,
  QUOTE_EMAIL_DELAY_MS: 600000,
  CONFIRMATION_SMS_DELAY_MS: 600000,
  CONFIRMATION_EMAIL_DELAY_MS: 300000,
} as const;
