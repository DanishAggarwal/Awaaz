import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { createIssue } from "../api";
import { uploadImage } from "../utils/uploadImage";
import { 
  getCurrentLocation, 
  reverseGeocode, 
  searchLocations, 
  LocationSuggestion 
} from "../utils/location";
import { 
  Compass, 
  MapPin, 
  Image as ImageIcon, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Plus
} from "lucide-react";

interface ReportIssueProps {
  joinedGroups: any[];
  onSuccess: (newIssue: any) => void;
  onCancel: () => void;
  initialGroupId?: string | null;
}

export default function ReportIssue({ joinedGroups, onSuccess, onCancel, initialGroupId }: ReportIssueProps) {
  // If initialGroupId is explicitly null, it represents a public issue (no group)
  // If undefined, let the user select from their joined groups
  // If string, preselect that group and hide selector
  const isCommunityPreselected = initialGroupId !== undefined;
  
  const [selectedGroupId, setSelectedGroupId] = useState(() => {
    if (initialGroupId) return initialGroupId;
    return "";
  });
  
  const [description, setDescription] = useState("");
  
  // Location autocomplete / selection states
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // File states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Automatically trigger location detection on load to make UX smooth
  useEffect(() => {
    handleDetectLocation();
  }, []);

  // Search Address/Landmark debounce effect
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(searchQuery);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Error searching locations:", err);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle Geolocation Detection
  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setLocationMessage({ text: "Detecting satellite coordinates...", type: "info" });
    setSelectedLocation(null);

    try {
      const coords = await getCurrentLocation();
      setLocationMessage({ 
        text: `GPS locked: (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}). Finding nearest landmark...`, 
        type: "info" 
      });

      const location = await reverseGeocode(coords.latitude, coords.longitude);
      setSelectedLocation(location);
      setSearchQuery(location.address);
      setLocationMessage({ 
        text: `Position locked successfully: ${location.address}`, 
        type: "success" 
      });
    } catch (err: any) {
      console.error("GPS detection failed:", err);
      setLocationMessage({ 
        text: err.message || "Unable to retrieve GPS coordinates. Please search for an address manually below.", 
        type: "error" 
      });
    } finally {
      setDetectingLocation(false);
    }
  };

  // Handle File Selection and Drag & Drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validImageFiles = files.filter(file => file.type.startsWith("image/"));
    if (validImageFiles.length === 0) {
      setError("Please select valid image files.");
      return;
    }

    setSelectedFiles(prev => [...prev, ...validImageFiles]);
    
    // Create local object URLs for previewing
    const newPreviews = validImageFiles.map(file => URL.createObjectURL(file));
    setFilePreviews(prev => [...prev, ...newPreviews]);
    setError(null);
  };

  const removeFile = (index: number) => {
    // Revoke object URL to prevent leaks
    URL.revokeObjectURL(filePreviews[index]);
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Form Submission and Image Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Initial fields validation
    if (!isCommunityPreselected && !selectedGroupId && initialGroupId !== null) {
      // If we allowed choosing but they didn't pick anything (for group context)
      setError("Please select the community group where this issue is occurring.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe the civic issue in detail.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("At least one reported image photo is required to substantiate your report.");
      return;
    }

    if (!selectedLocation || !selectedLocation.address.trim() || typeof selectedLocation.latitude !== "number" || typeof selectedLocation.longitude !== "number") {
      setError("Please select a valid location using GPS detection or search autocomplete.");
      return;
    }

    setIsUploading(true);
    const imageUrls: string[] = [];

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error("You must be logged in to report an issue.");
      }

      // 1. Upload images to Cloudinary
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`Uploading photo ${i + 1} of ${selectedFiles.length}...`);
        
        const downloadUrl = await uploadImage(file);
        imageUrls.push(downloadUrl);
      }

      setUploadProgress("Filing official civic complaint with Awaaz Ledger...");

      // 2. Submit the issue metadata to our backend
      // Group ID is null if we are in a public reporting context
      const targetGroupId = selectedGroupId || null;

      const res = await createIssue({
        groupId: targetGroupId,
        description: description.trim(),
        imageUrls,
        location: {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          address: selectedLocation.address.trim()
        }
      });

      if (res && res.success && res.data && res.data.issue) {
        onSuccess(res.data.issue);
      } else {
        throw new Error(res?.error || "Failed to create issue on the backend.");
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(err.message || "Failed to submit reported issue. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  // Find preselected group name for display
  const preselectedGroupName = selectedGroupId 
    ? joinedGroups.find(g => g.id === selectedGroupId)?.name || "Community Group"
    : "";

  return (
    <div className="max-w-3xl mx-auto p-6 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#1A1A1A] tracking-tight">
            {selectedGroupId ? "Report Community Issue" : "Report Public Issue"}
          </h1>
          <p className="text-xs text-[#7A756D] mt-1">
            {selectedGroupId 
              ? `Filing a community-focused complaint directly inside ${preselectedGroupName}.`
              : "Filing a public civic issue mapped on the global feed."}
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="px-4 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-xs font-semibold rounded-xl text-[#5A5A40] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs">
        {error && (
          <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* 1. Community Selector (Show only if not pre-selected or determined by launch context) */}
        {!isCommunityPreselected && (
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5A40]" htmlFor="issue-community">
              Select Impacted Community <span className="text-rose-500">*</span>
            </label>
            <select
              id="issue-community"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={isUploading}
              className="w-full text-sm bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 focus:outline-none focus:border-[#5A5A40] transition-colors text-[#1A1A1A]"
            >
              <option value="">-- Select one of your joined communities --</option>
              {joinedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {joinedGroups.length === 0 && (
              <p className="text-[11px] text-[#A37B5C] italic">
                You haven't joined any communities yet. Please explore and join a community in the sidebar before reporting.
              </p>
            )}
          </div>
        )}

        {isCommunityPreselected && selectedGroupId && (
          <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A756D]">Assigned Community</span>
              <h4 className="text-sm font-bold text-[#5A5A40]">{preselectedGroupName}</h4>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
              Auto-Bound
            </span>
          </div>
        )}

        {/* 2. Photo Upload Box */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
            Photographic Evidence <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-[#7A756D] leading-normal">
            Upload clear photos showing the current scale and status of the issue. High fidelity ensures fast verification.
          </p>

          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[#E5E0D8] hover:border-[#5A5A40]/40 rounded-2xl bg-[#FDFCFB] p-6 text-center transition-colors cursor-pointer relative"
          >
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-uploader"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-[#F5F5F0] flex items-center justify-center text-[#5A5A40]">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-[#4A4A3A]">
                Drag and drop your images here, or <span className="text-[#5A5A40] underline">browse files</span>
              </p>
              <p className="text-[10px] text-[#A8A297]">JPEG, PNG, or WEBP up to 10MB each</p>
            </div>
          </div>

          {/* Previews Grid */}
          {filePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              {filePreviews.map((previewUrl, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E0D8] group">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                    className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-rose-700 text-white rounded-lg p-1.5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Description Area */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5A40]" htmlFor="issue-desc">
            Issue Description & Details <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="issue-desc"
            rows={5}
            placeholder="Provide a detailed overview of the complaint. Include landmark descriptions, impact on local citizens, and any critical details that verify this is a real problem..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUploading}
            className="w-full text-sm bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 focus:outline-none focus:border-[#5A5A40] transition-colors text-[#1A1A1A] resize-y placeholder:text-[#A8A297]"
          />
        </div>

        {/* 4. Location Details */}
        <div className="space-y-4 border-t border-[#F5F5F0] pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                Issue Location <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-[#7A756D]">Set a precise geocoded location. Coordinates are verified instantly.</p>
            </div>
            
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingLocation || isUploading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FAF9F6] hover:bg-[#5A5A40] hover:text-white border border-[#E5E0D8] text-xs font-bold rounded-xl transition-all text-[#5A5A40] cursor-pointer"
            >
              {detectingLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Compass className="h-3.5 w-3.5" />
              )}
              <span>📍 Use Current Location</span>
            </button>
          </div>

          {locationMessage && (
            <div className={`p-3 rounded-xl border text-[11px] flex items-center gap-2 ${
              locationMessage.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : locationMessage.type === "error" 
                ? "bg-rose-50 text-rose-800 border-rose-100" 
                : "bg-amber-50 text-amber-800 border-amber-100"
            }`}>
              {locationMessage.type === "success" ? (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              )}
              <span className="font-medium">{locationMessage.text}</span>
            </div>
          )}

          {/* Option B: Search Input */}
          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-semibold text-[#7A756D]" htmlFor="issue-search">
              🔍 Search Address, Locality, or Landmark
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A8A297]" />
              <input
                id="issue-search"
                type="text"
                placeholder="Type apartment, society, street name, metro station..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                disabled={isUploading}
                className="w-full text-xs bg-white border border-[#E5E0D8] rounded-xl pl-10 pr-10 py-3.5 focus:outline-none focus:border-[#5A5A40] transition-colors text-[#1A1A1A] placeholder:text-[#A8A297]"
              />
              {searching && (
                <Loader2 className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin text-[#5A5A40]" />
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#E5E0D8] rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-[#F5F5F0]">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(suggestion);
                      setSearchQuery(suggestion.address);
                      setShowSuggestions(false);
                      setLocationMessage({ 
                        text: "Location selected successfully from search suggestions.", 
                        type: "success" 
                      });
                    }}
                    className="w-full text-left px-4 py-3 text-xs text-[#4A4A3A] hover:bg-[#FAF9F6] transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#A37B5C] shrink-0 mt-0.5" />
                    <span className="truncate">{suggestion.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Location Confirmation Box */}
          {selectedLocation ? (
            <div className="bg-[#FAF9F6] border border-emerald-200/80 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-600" />
                  ✓ Valid Location Locked
                </span>
                <span className="text-[9px] font-mono font-semibold text-[#7A756D] bg-white border border-[#E5E0D8] px-1.5 py-0.5 rounded-md uppercase">
                  Source: {selectedLocation.source}
                </span>
              </div>
              <h4 className="text-xs font-bold text-[#1A1A1A] leading-relaxed">{selectedLocation.address}</h4>
              <p className="text-[10px] text-[#7A756D] font-mono">
                Coordinates: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </p>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-4">
              <span className="text-xs font-medium text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                No Valid Location Selected. Use GPS detection or search a landmark above.
              </span>
            </div>
          )}
        </div>

        {/* Form Footer & Actions */}
        <div className="border-t border-[#F5F5F0] pt-6 flex items-center justify-between">
          <p className="text-[10px] text-[#A8A297] italic font-medium">
            * Indicates mandatory required fields
          </p>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isUploading}
              className="px-4 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-xs font-bold rounded-xl text-[#4A4A3A] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-75 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="truncate max-w-[200px]">{uploadProgress || "Submitting..."}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Submit Issue Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
