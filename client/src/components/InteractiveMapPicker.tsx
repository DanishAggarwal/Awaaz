import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { Compass, Plus, Minus, Search, MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getIssues } from "../api";
import { reverseGeocode, searchLocations, getCurrentLocation, LocationSuggestion } from "../utils/location";

// Define a custom icon for the main interactive centered pin using SVG
const mainPinIcon = L.divIcon({
  html: `
    <div class="flex flex-col items-center justify-center -translate-y-5">
      <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="#5A5A40" stroke="#FAF9F6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-lg scale-110 hover:scale-125 transition-transform">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="3" fill="#FAF9F6"/>
      </svg>
      <div class="w-3 h-3 bg-black/25 rounded-full blur-[2px] -mt-1.5 animate-pulse"></div>
    </div>
  `,
  className: "custom-main-pin",
  iconSize: [38, 38],
  iconAnchor: [19, 38]
});

// Define custom icons for secondary (nearby) issues
const nearbyPinIcon = L.divIcon({
  html: `
    <div class="flex flex-col items-center justify-center -translate-y-3.5 opacity-80 hover:opacity-100 transition-opacity">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#A37B5C" stroke="#FAF9F6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="2.5" fill="#FAF9F6"/>
      </svg>
      <div class="w-2 h-2 bg-black/20 rounded-full blur-[1px] -mt-1"></div>
    </div>
  `,
  className: "custom-nearby-pin",
  iconSize: [28, 28],
  iconAnchor: [14, 28]
});

interface InteractiveMapPickerProps {
  initialCoords: { latitude: number; longitude: number } | null;
  initialAddress: string;
  onChange: (lat: number, lng: number, address: string) => void;
  onNearbyCountChange?: (count: number) => void;
  joinedGroups?: any[];
}

// Distance helper (within 2.5km)
function distanceBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

export default function InteractiveMapPicker({
  initialCoords,
  initialAddress,
  onChange,
  onNearbyCountChange,
  joinedGroups = []
}: InteractiveMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mainMarkerRef = useRef<L.Marker | null>(null);
  const nearbyMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  // Default coordinate is Bangalore City Hall (12.9716, 77.5946)
  const defaultCoords = { lat: 12.9716, lng: 77.5946 };

  // Local state
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    if (initialCoords) {
      return { lat: initialCoords.latitude, lng: initialCoords.longitude };
    }
    return defaultCoords;
  });
  const [address, setAddress] = useState(initialAddress || "Locating...");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isDetectingGPS, setIsDetectingGPS] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [nearbyIssues, setNearbyIssues] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Address lookup cache to minimize Nominatim API calls
  const reverseGeocodeCache = useRef<Record<string, string>>({});

  // Debouncing geocode requests to prevent API spamming
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all authorized issues (public and joined group issues) once on mount to map nearby reports
  useEffect(() => {
    async function fetchAllAuthorizedIssues() {
      try {
        const [pubRes, grpRes] = await Promise.all([
          getIssues({ scope: "public" }).catch(() => ({ data: { issues: [] } })),
          getIssues({ scope: "my-groups" }).catch(() => ({ data: { issues: [] } }))
        ]);

        const combined = [
          ...(pubRes?.data?.issues || []),
          ...(grpRes?.data?.issues || [])
        ];

        // De-duplicate issues
        const unique = combined.filter((issue, idx, self) =>
          self.findIndex(i => i.id === issue.id) === idx
        );

        setAllIssues(unique);
      } catch (err) {
        console.error("InteractiveMapPicker: Error loading issues map overlays:", err);
      }
    }
    fetchAllAuthorizedIssues();
  }, []);

  // Filter nearby issues in-memory (within 2.5km) whenever coordinates change
  const recalculateNearbyIssues = useCallback((currentLat: number, currentLng: number, issueList: any[]) => {
    const nearby = issueList.filter(issue => {
      const loc = issue.location || {};
      const lat = typeof loc.latitude === "number" ? loc.latitude : parseFloat(loc.latitude);
      const lng = typeof loc.longitude === "number" ? loc.longitude : parseFloat(loc.longitude);

      if (isNaN(lat) || isNaN(lng)) return false;

      const dist = distanceBetweenPoints(currentLat, currentLng, lat, lng);
      return dist <= 2500; // 2.5 km limit
    });

    setNearbyIssues(nearby);
    if (onNearbyCountChange) {
      onNearbyCountChange(nearby.length);
    }
    return nearby;
  }, [onNearbyCountChange]);

  // Update nearby markers on the map
  const updateNearbyMarkersOnMap = useCallback((nearbyList: any[]) => {
    if (!mapInstanceRef.current || !nearbyMarkersLayerRef.current) return;

    // Clear old markers from layer
    nearbyMarkersLayerRef.current.clearLayers();

    // Add new markers
    nearbyList.forEach(issue => {
      const loc = issue.location || {};
      const lat = typeof loc.latitude === "number" ? loc.latitude : parseFloat(loc.latitude);
      const lng = typeof loc.longitude === "number" ? loc.longitude : parseFloat(loc.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      const marker = L.marker([lat, lng], { icon: nearbyPinIcon });
      
      // Bind descriptive popup for citizen awareness
      marker.bindPopup(`
        <div class="font-sans text-xs p-1 space-y-1">
          <div class="font-bold text-[#1A1A1A]">${issue.title || "Reported Issue"}</div>
          <div class="flex items-center gap-1.5 text-[10px] text-[#7A756D] capitalize">
            <span class="bg-amber-100/70 border border-amber-200 px-1 py-0.2 rounded-sm font-semibold">${issue.category}</span>
            <span>•</span>
            <span class="text-emerald-700 font-semibold">${issue.status}</span>
          </div>
          <div class="text-[10px] text-[#5A5A40] leading-relaxed max-w-[180px] line-clamp-2">${issue.summary || issue.description || ""}</div>
        </div>
      `);

      nearbyMarkersLayerRef.current?.addLayer(marker);
    });
  }, []);

  // Sync nearby issues when coordinate state or issue list changes
  useEffect(() => {
    const nearby = recalculateNearbyIssues(coords.lat, coords.lng, allIssues);
    updateNearbyMarkersOnMap(nearby);
  }, [coords, allIssues, recalculateNearbyIssues, updateNearbyMarkersOnMap]);

  // Handle geocoding with debounce & cache
  const triggerDebouncedReverseGeocode = useCallback((lat: number, lng: number) => {
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    setIsGeocoding(true);
    setErrorMessage(null);

    geocodeTimeoutRef.current = setTimeout(async () => {
      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      
      // Check memory cache first
      if (reverseGeocodeCache.current[cacheKey]) {
        const cachedAddress = reverseGeocodeCache.current[cacheKey];
        setAddress(cachedAddress);
        onChange(lat, lng, cachedAddress);
        setIsGeocoding(false);
        return;
      }

      try {
        const res = await reverseGeocode(lat, lng);
        if (res && res.address) {
          reverseGeocodeCache.current[cacheKey] = res.address;
          setAddress(res.address);
          onChange(lat, lng, res.address);
        }
      } catch (err: any) {
        console.error("Map reverse geocode failed:", err);
        const fallbackAddress = `Sector Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
        setAddress(fallbackAddress);
        onChange(lat, lng, fallbackAddress);
      } finally {
        setIsGeocoding(false);
      }
    }, 600); // 600ms debounce
  }, [onChange]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create the map instance
    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 15,
      zoomControl: false, // Customized buttons
      attributionControl: true
    });

    // Add OpenStreetMap high quality tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    // Create a layer group specifically for nearby issue markers
    const nearbyLayer = L.layerGroup().addTo(map);
    nearbyMarkersLayerRef.current = nearbyLayer;

    // Create the main center interactive pin
    const mainMarker = L.marker([coords.lat, coords.lng], {
      icon: mainPinIcon,
      draggable: true
    }).addTo(map);
    mainMarkerRef.current = mainMarker;

    // INTERACTION A: User drags the map, pin stays centered
    map.on("move", () => {
      const center = map.getCenter();
      mainMarker.setLatLng(center);
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      const currentLat = center.lat;
      const currentLng = center.lng;
      setCoords({ lat: currentLat, lng: currentLng });
      triggerDebouncedReverseGeocode(currentLat, currentLng);
    });

    // INTERACTION B: User drags the pin directly, map centers on drag end
    mainMarker.on("drag", () => {
      const markerLatLng = mainMarker.getLatLng();
      setCoords({ lat: markerLatLng.lat, lng: markerLatLng.lng });
    });

    mainMarker.on("dragend", () => {
      const markerLatLng = mainMarker.getLatLng();
      map.setView(markerLatLng, map.getZoom());
      triggerDebouncedReverseGeocode(markerLatLng.lat, markerLatLng.lng);
    });

    mapInstanceRef.current = map;

    // Perform initial address fetch
    triggerDebouncedReverseGeocode(coords.lat, coords.lng);

    // Clean up map instance on unmount
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Watch for external initial coords updates (only if map exists and changes externally)
  useEffect(() => {
    if (initialCoords && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const latLng = L.latLng(initialCoords.latitude, initialCoords.longitude);
      
      // If position is significantly different, pan map
      const distance = map.getCenter().distanceTo(latLng);
      if (distance > 10) { // more than 10 meters away
        map.setView(latLng, map.getZoom());
        setCoords({ lat: initialCoords.latitude, lng: initialCoords.longitude });
        setAddress(initialAddress || "Position locked");
      }
    }
  }, [initialCoords]);

  // Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // GPS Current Location Detection
  const handleGPSDetect = async () => {
    setIsDetectingGPS(true);
    setErrorMessage(null);
    try {
      // Direct high-accuracy coordinates fetch
      const currentGPS = await getCurrentLocation();
      
      // If accuracy telemetry is available via navigator
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          if (pos.coords.accuracy) {
            setAccuracy(pos.coords.accuracy);
          }
        }, () => {}, { enableHighAccuracy: true });
      }

      setCoords({ lat: currentGPS.latitude, lng: currentGPS.longitude });
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([currentGPS.latitude, currentGPS.longitude], 16);
      }

      triggerDebouncedReverseGeocode(currentGPS.latitude, currentGPS.longitude);
    } catch (err: any) {
      console.error("InteractiveMapPicker: GPS failed:", err);
      setErrorMessage(err.message || "Failed to acquire location. Please search manually.");
    } finally {
      setIsDetectingGPS(false);
    }
  };

  // Autocomplete Search Debounce
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error("InteractiveMapPicker: Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // Apply search suggestion
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const lat = suggestion.latitude;
    const lng = suggestion.longitude;

    setCoords({ lat, lng });
    setAddress(suggestion.address);
    setSearchQuery("");
    setShowSearchDropdown(false);
    setAccuracy(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
    }

    // Immediately cache and trigger parent updates
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    reverseGeocodeCache.current[cacheKey] = suggestion.address;
    onChange(lat, lng, suggestion.address);
  };

  return (
    <div className="w-full flex flex-col rounded-2xl border border-[#E5E0D8] bg-white overflow-hidden shadow-xs">
      
      {/* Search Bar - Part 4 */}
      <div className="p-4 bg-[#FAF9F6] border-b border-[#E5E0D8] space-y-2 relative">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]" htmlFor="map-search-input">
          🔍 Search Sector, Colony, or Landmark
        </label>
        <div className="relative">
          <input
            id="map-search-input"
            type="text"
            placeholder="Search Delhi, Ludhiana, Indiranagar, Metro station..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            className="w-full text-xs bg-white border border-[#E5E0D8] rounded-xl pl-9 pr-10 py-3 focus:outline-none focus:border-[#5A5A40] text-[#1A1A1A] placeholder:text-[#A8A297] transition-all"
          />
          <Search className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-[#A8A297]" />
          {isSearching && (
            <Loader2 className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin text-[#5A5A40]" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchDropdown && searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1.5 bg-white border border-[#E5E0D8] rounded-xl shadow-xl z-[1000] max-h-56 overflow-y-auto divide-y divide-[#F5F5F0]">
            {searchResults.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-3 text-xs text-[#4A4A3A] hover:bg-[#FAF9F6] transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-[#A37B5C] shrink-0 mt-0.5" />
                <span className="truncate">{suggestion.address}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container - Parts 1, 2, 3, 6, 9 */}
      <div className="relative w-full h-[280px] sm:h-[360px] md:h-[400px] z-10 bg-[#FAF9F6]">
        <div ref={mapContainerRef} className="w-full h-full" id="awaaz-interactive-map" />

        {/* Floating Custom Controls */}
        <div className="absolute right-3 top-3 flex flex-col gap-2 z-[999]">
          {/* Zoom Buttons */}
          <div className="flex flex-col bg-white border border-[#E5E0D8] rounded-xl shadow-md overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2.5 hover:bg-[#FAF9F6] transition-colors border-b border-[#F5F5F0] text-[#5A5A40] cursor-pointer"
              title="Zoom In"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2.5 hover:bg-[#FAF9F6] transition-colors text-[#5A5A40] cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Current Location GPS Button */}
          <button
            type="button"
            onClick={handleGPSDetect}
            disabled={isDetectingGPS}
            className="p-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl shadow-md text-[#5A5A40] disabled:opacity-75 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Locate Me (GPS)"
          >
            {isDetectingGPS ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#5A5A40]" />
            ) : (
              <Compass className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Floating Sector Indicators Overlay */}
        <div className="absolute left-3 bottom-3 bg-black/70 backdrop-blur-xs text-[10px] text-white py-1 px-2.5 rounded-lg font-mono font-medium flex items-center gap-1.5 z-[999]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>RADIUS SECURE RADAR: 2.5KM</span>
        </div>

        {/* GPS Error Toast overlay */}
        {errorMessage && (
          <div className="absolute top-3 left-3 right-14 bg-rose-50 border border-rose-200 text-rose-800 p-2 text-xs rounded-xl shadow-lg flex items-start gap-2 animate-in fade-in z-[999]">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-grow">
              <p className="font-semibold">GPS Error</p>
              <p className="text-[10px] opacity-90">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Map Preview & Details Panel - Parts 5, 6, 12 */}
      <div className="p-4 bg-[#FAF9F6] border-t border-[#E5E0D8] space-y-3">
        {/* Selected Address Preview */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#5A5A40]" />
              Selected Target Location
            </span>
            {isGeocoding && (
              <span className="text-[10px] text-[#A37B5C] font-semibold flex items-center gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Geocoding...
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-[#1A1A1A] leading-relaxed">
            {address}
          </h4>
        </div>

        {/* Coordinates Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-[#7A756D]">
          <div className="bg-white border border-[#E5E0D8] p-2 rounded-xl">
            <p className="text-[9px] uppercase font-bold text-[#A8A297]">Latitude / Longitude</p>
            <p className="font-semibold text-[#1A1A1A] mt-0.5">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          </div>
          <div className="bg-white border border-[#E5E0D8] p-2 rounded-xl flex flex-col justify-between">
            <p className="text-[9px] uppercase font-bold text-[#A8A297]">GPS Precision / Accuracy</p>
            <p className="font-semibold text-[#1A1A1A] mt-0.5">
              {accuracy ? `±${accuracy.toFixed(1)}m (Satellite)` : "Browser Triangulation"}
            </p>
          </div>
        </div>

        {/* Nearby Issues Indicator Counter */}
        <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#A37B5C] shrink-0" />
            <div className="text-left">
              <p className="font-bold text-[#1A1A1A]">Nearby Existing Issues</p>
              <p className="text-[10px] text-[#7A756D]">
                {nearbyIssues.length > 0
                  ? `Found ${nearbyIssues.length} active civic reports within 2.5km.`
                  : "No similar reports logged nearby. This is a new localized issue!"}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            nearbyIssues.length > 0 ? "bg-amber-100 text-amber-800" : "bg-[#5A5A40]/10 text-[#5A5A40]"
          }`}>
            {nearbyIssues.length} Reports
          </span>
        </div>
      </div>
    </div>
  );
}
