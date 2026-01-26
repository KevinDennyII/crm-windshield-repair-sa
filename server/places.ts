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
  url.searchParams.set("fields", "address_components");
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

  return {
    street: streetNumber ? `${streetNumber} ${route}` : route,
    city,
    state,
    zip,
  };
}
