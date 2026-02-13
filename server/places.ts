const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

interface PlacePrediction {
  place_id: string;
  description: string;
}

interface AutocompleteResponse {
  predictions: PlacePrediction[];
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface PlaceDetailsResponse {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  mobileFee?: number;
  distanceMiles?: number;
}

const SAN_ANTONIO_CENTER = {
  lat: 29.4241,
  lng: -98.4936
};

const LOOP_1604_COORDS = [
  { lat: 29.4832502, lng: -98.7089665 },
  { lat: 29.4458855, lng: -98.7113697 },
  { lat: 29.4231611, lng: -98.7099965 },
  { lat: 29.4085071, lng: -98.7093098 },
  { lat: 29.3971413, lng: -98.7024434 },
  { lat: 29.3818853, lng: -98.7007267 },
  { lat: 29.3579496, lng: -98.6911137 },
  { lat: 29.3414905, lng: -98.6918003 },
  { lat: 29.3268248, lng: -98.6859639 },
  { lat: 29.3103607, lng: -98.6763508 },
  { lat: 29.2932952, lng: -98.6677678 },
  { lat: 29.2801198, lng: -98.6667378 },
  { lat: 29.2582569, lng: -98.6660511 },
  { lat: 29.2507685, lng: -98.6629612 },
  { lat: 29.2414822, lng: -98.6629612 },
  { lat: 29.2354906, lng: -98.6609013 },
  { lat: 29.2297982, lng: -98.6492283 },
  { lat: 29.2262029, lng: -98.638242 },
  { lat: 29.2265025, lng: -98.6227925 },
  { lat: 29.230697, lng: -98.6114628 },
  { lat: 29.2324946, lng: -98.5942967 },
  { lat: 29.2339926, lng: -98.5651143 },
  { lat: 29.2297982, lng: -98.5630543 },
  { lat: 29.2235063, lng: -98.5565312 },
  { lat: 29.2172139, lng: -98.5455449 },
  { lat: 29.2148168, lng: -98.5276921 },
  { lat: 29.2130188, lng: -98.5088093 },
  { lat: 29.2142175, lng: -98.4981663 },
  { lat: 29.2202103, lng: -98.4830601 },
  { lat: 29.2202103, lng: -98.4696705 },
  { lat: 29.2208096, lng: -98.4415181 },
  { lat: 29.22051, lng: -98.4308751 },
  { lat: 29.2172139, lng: -98.4099324 },
  { lat: 29.2190118, lng: -98.3896763 },
  { lat: 29.2190118, lng: -98.3598072 },
  { lat: 29.2250044, lng: -98.3529408 },
  { lat: 29.2339926, lng: -98.3536274 },
  { lat: 29.2447775, lng: -98.3488209 },
  { lat: 29.2483721, lng: -98.334058 },
  { lat: 29.2516672, lng: -98.3282216 },
  { lat: 29.260054, lng: -98.3213551 },
  { lat: 29.2666432, lng: -98.3059056 },
  { lat: 29.298984, lng: -98.2743199 },
  { lat: 29.3031756, lng: -98.2612736 },
  { lat: 29.3109595, lng: -98.260587 },
  { lat: 29.3247295, lng: -98.2626469 },
  { lat: 29.3355048, lng: -98.2537205 },
  { lat: 29.3456804, lng: -98.2516606 },
  { lat: 29.3636348, lng: -98.2434208 },
  { lat: 29.3905605, lng: -98.239301 },
  { lat: 29.4138904, lng: -98.2530339 },
  { lat: 29.4491742, lng: -98.2853062 },
  { lat: 29.4802615, lng: -98.2976658 },
  { lat: 29.4874342, lng: -98.291486 },
  { lat: 29.513132, lng: -98.2873661 },
  { lat: 29.5364337, lng: -98.3017857 },
  { lat: 29.5483812, lng: -98.3182652 },
  { lat: 29.5662998, lng: -98.3313115 },
  { lat: 29.6027246, lng: -98.3608372 },
  { lat: 29.5997394, lng: -98.4301884 },
  { lat: 29.6086946, lng: -98.4617741 },
  { lat: 29.6098885, lng: -98.518079 },
  { lat: 29.6027246, lng: -98.5331852 },
  { lat: 29.6003364, lng: -98.5579045 },
  { lat: 29.5895893, lng: -98.5922367 },
  { lat: 29.5848124, lng: -98.6334355 },
  { lat: 29.5776467, lng: -98.6430485 },
  { lat: 29.5477839, lng: -98.6718876 },
  { lat: 29.4832502, lng: -98.7089665 },
];

function isPointInsideLoop1604(lat: number, lng: number): boolean {
  let inside = false;
  const n = LOOP_1604_COORDS.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = LOOP_1604_COORDS[i].lat, yi = LOOP_1604_COORDS[i].lng;
    const xj = LOOP_1604_COORDS[j].lat, yj = LOOP_1604_COORDS[j].lng;
    if ((yi > lng) !== (yj > lng) && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegmentMiles(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const MILES_PER_DEG_LAT = 69.0;
  const MILES_PER_DEG_LNG = 69.0 * Math.cos((pLat * Math.PI) / 180);

  const px = (pLat - aLat) * MILES_PER_DEG_LAT;
  const py = (pLng - aLng) * MILES_PER_DEG_LNG;
  const bx = (bLat - aLat) * MILES_PER_DEG_LAT;
  const by = (bLng - aLng) * MILES_PER_DEG_LNG;

  const dot = px * bx + py * by;
  const lenSq = bx * bx + by * by;
  let t = lenSq > 0 ? dot / lenSq : 0;
  t = Math.max(0, Math.min(1, t));

  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceOutsideLoop1604(lat: number, lng: number): number {
  let minDist = Infinity;
  const n = LOOP_1604_COORDS.length;
  for (let i = 0; i < n - 1; i++) {
    const a = LOOP_1604_COORDS[i];
    const b = LOOP_1604_COORDS[i + 1];
    const d = distanceToSegmentMiles(lat, lng, a.lat, a.lng, b.lat, b.lng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function calculateMobileFee(lat: number, lng: number): { fee: number; distanceMiles: number } {
  if (isPointInsideLoop1604(lat, lng)) {
    const distFromCenter = calculateDistanceMiles(SAN_ANTONIO_CENTER.lat, SAN_ANTONIO_CENTER.lng, lat, lng);
    return { fee: 0, distanceMiles: distFromCenter };
  }
  const distOutside = distanceOutsideLoop1604(lat, lng);
  const distFromCenter = calculateDistanceMiles(SAN_ANTONIO_CENTER.lat, SAN_ANTONIO_CENTER.lng, lat, lng);
  let fee: number;
  if (distOutside <= 5) fee = 10;
  else if (distOutside <= 10) fee = 20;
  else if (distOutside <= 15) fee = 25;
  else if (distOutside <= 20) fee = 35;
  else fee = 50;
  return { fee, distanceMiles: distFromCenter };
}

function calculateDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPlacesConfigured(): boolean {
  return Boolean(GOOGLE_PLACES_API_KEY);
}

export async function getAutocomplete(input: string): Promise<AutocompleteResponse> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", input);
  url.searchParams.set("types", "address");
  url.searchParams.set("components", "country:us");
  url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Places API error:", data.status, data.error_message);
    throw new Error(`Places API error: ${data.status}`);
  }

  return {
    predictions: (data.predictions || []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
    })),
  };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "address_components,geometry");
  url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== "OK") {
    console.error("Place details error:", data.status, data.error_message);
    throw new Error(`Place details error: ${data.status}`);
  }

  const components: AddressComponent[] = data.result?.address_components || [];
  
  let streetNumber = "";
  let route = "";
  let city = "";
  let state = "";
  let zip = "";

  for (const component of components) {
    if (component.types.includes("street_number")) {
      streetNumber = component.long_name;
    } else if (component.types.includes("route")) {
      route = component.long_name;
    } else if (component.types.includes("locality")) {
      city = component.long_name;
    } else if (!city && component.types.includes("postal_town")) {
      city = component.long_name;
    } else if (!city && component.types.includes("sublocality")) {
      city = component.long_name;
    } else if (!city && component.types.includes("administrative_area_level_2")) {
      city = component.long_name;
    } else if (component.types.includes("administrative_area_level_1")) {
      state = component.short_name;
    } else if (component.types.includes("postal_code")) {
      zip = component.long_name;
    }
  }

  // Get coordinates and calculate mobile fee
  const location = data.result?.geometry?.location;
  let lat: number | undefined;
  let lng: number | undefined;
  let distanceMiles: number | undefined;
  let mobileFee: number | undefined;

  if (location?.lat !== undefined && location?.lng !== undefined) {
    lat = location.lat;
    lng = location.lng;
    const result = calculateMobileFee(lat as number, lng as number);
    mobileFee = result.fee;
    distanceMiles = result.distanceMiles;
  }

  return {
    street: streetNumber ? `${streetNumber} ${route}` : route,
    city,
    state,
    zip,
    lat,
    lng,
    distanceMiles: distanceMiles ? Math.round(distanceMiles * 10) / 10 : undefined,
    mobileFee,
  };
}
