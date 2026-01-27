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

// San Antonio downtown coordinates (center of the fee zones)
const SAN_ANTONIO_CENTER = {
  lat: 29.4241,
  lng: -98.4936
};

// Distance thresholds in miles and corresponding mobile fees
// Based on the zone map:
// - Inside Loop 1604 (~10 miles): $0
// - Green zone (~15 miles): $10
// - Blue zone (~25 miles): $20  
// - Purple zone (~35 miles): $25
// - Pink zone (~45 miles): $35
// - Red zone (>45 miles): $50
function calculateMobileFee(distanceMiles: number): number {
  if (distanceMiles <= 10) return 0;    // Inside 1604
  if (distanceMiles <= 15) return 10;   // Green zone
  if (distanceMiles <= 25) return 20;   // Blue zone
  if (distanceMiles <= 35) return 25;   // Purple zone
  if (distanceMiles <= 45) return 35;   // Pink zone
  return 50;                             // Red zone
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
    distanceMiles = calculateDistanceMiles(
      SAN_ANTONIO_CENTER.lat,
      SAN_ANTONIO_CENTER.lng,
      lat as number,
      lng as number
    );
    mobileFee = calculateMobileFee(distanceMiles);
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
