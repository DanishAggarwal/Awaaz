/**
 * Geospatial Location Utilities for Awaaz Platform.
 * Uses OpenStreetMap Nominatim API for forward/reverse geocoding and search suggestions.
 */

export interface LocationSuggestion {
  address: string;
  latitude: number;
  longitude: number;
  source: "gps" | "search";
  raw?: any;
}

/**
 * Uses browser geolocation to fetch current GPS coordinates.
 */
export function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Unable to retrieve your location.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Please search for your location manually.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "GPS signal lost or position unavailable. Please search manually.";
        } else if (error.code === error.TIMEOUT) {
          message = "GPS request timed out. Please search manually.";
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * Reverse geocodes latitude/longitude coordinates into a human-readable street/landmark address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<LocationSuggestion> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Awaaz-Civic-App"
    }
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (data && data.display_name) {
    return {
      address: data.display_name,
      latitude: lat,
      longitude: lng,
      source: "gps",
      raw: data
    };
  }

  throw new Error("No address found for these coordinates.");
}

/**
 * Forward geocodes or searches for locations matching a query (autocomplete suggestions).
 */
export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  // We append countrycodes=in to restrict results to India for the Awaaz Platform!
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Awaaz-Civic-App"
    }
  });

  if (!response.ok) {
    throw new Error(`Location search failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      source: "search",
      raw: item
    }));
  }

  return [];
}
