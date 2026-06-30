import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { createIssue, supportDuplicateIssue } from "../api";
import { uploadImage } from "../utils/uploadImage";
import ReopenRequestModal from "../components/ReopenRequestModal";
import { 
  getCurrentLocation, 
  reverseGeocode, 
  searchLocations, 
  LocationSuggestion 
} from "../utils/location";
import InteractiveMapPicker from "../components/InteractiveMapPicker";
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
  onSuccess: (newIssue: any, customToastMessage?: string | null) => void;
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

  // Duplicate Resolution states
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [duplicateCandidate, setDuplicateCandidate] = useState<any | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isSupportingDuplicate, setIsSupportingDuplicate] = useState(false);
  const [showAnywayConfirm, setShowAnywayConfirm] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

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
    setUploadedImageUrls([]);
    
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
    setUploadedImageUrls([]);
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleActualSubmit(false);
  };

  const handleActualSubmit = async (allowBypass: boolean = false) => {
    setError(null);

    // Initial fields validation
    if (!isCommunityPreselected && !selectedGroupId && initialGroupId !== null) {
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
    let imageUrlsToUse = [...uploadedImageUrls];

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error("You must be logged in to report an issue.");
      }

      // 1. Upload images if we haven't already uploaded them
      if (imageUrlsToUse.length === 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadProgress(`Uploading photo ${i + 1} of ${selectedFiles.length}...`);
          
          const downloadUrl = await uploadImage(file);
          imageUrlsToUse.push(downloadUrl);
        }
        setUploadedImageUrls(imageUrlsToUse);
      }

      setUploadProgress("Filing official civic complaint with Awaaz Ledger...");

      // 2. Submit the issue metadata to our backend
      // Group ID is null if we are in a public reporting context
      const targetGroupId = selectedGroupId || null;

      const submitPayload: any = {
        groupId: targetGroupId,
        description: description.trim(),
        imageUrls: imageUrlsToUse,
        location: {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          address: selectedLocation.address.trim()
        }
      };

      if (allowBypass) {
        submitPayload.allowDuplicate = true;
      }

      const res = await createIssue(submitPayload);

      if (res && res.success && res.data && res.data.issue) {
        onSuccess(res.data.issue);
      } else if (res && res.duplicate && res.existingIssue) {
        setDuplicateCandidate(res.existingIssue);
        setShowDuplicateDialog(true);
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

  // Duplicate Resolution actions

  // Action 1: Support Existing Issue
  const handleSupportExisting = async () => {
    if (!duplicateCandidate) return;
    setIsSupportingDuplicate(true);
    setDuplicateError(null);
    try {
      const res = await supportDuplicateIssue(duplicateCandidate.id);
      if (res && res.success) {
        setShowDuplicateDialog(false);
        const candidateId = duplicateCandidate.id;
        setDuplicateCandidate(null);
        onSuccess({ id: candidateId }, "Successfully supported the existing report and updated impact metadata.");
      } else {
        throw new Error(res?.error || "Failed to support/endorse the existing issue.");
      }
    } catch (err: any) {
      console.error("Failed to support existing duplicate issue:", err);
      setDuplicateError(err.message || "An error occurred while supporting this issue.");
    } finally {
      setIsSupportingDuplicate(false);
    }
  };

  // Action 2: View Existing Issue
  const handleViewExisting = () => {
    if (!duplicateCandidate) return;
    setShowDuplicateDialog(false);
    const candidateId = duplicateCandidate.id;
    setDuplicateCandidate(null);
    onSuccess({ id: candidateId }, null);
  };

  // Action 3: Report Anyway (retries submission with allowDuplicate = true)
  const handleReportAnyway = async () => {
    setShowDuplicateDialog(false);
    setDuplicateCandidate(null);
    setShowAnywayConfirm(false);
    await handleActualSubmit(true);
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

        {/* 4. Location Details (Interactive Map Experience) */}
        <div className="space-y-4 border-t border-[#F5F5F0] pt-5">
          <div className="flex flex-col gap-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
              Issue Location & Geographic Mapping <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-[#7A756D]">
              Select the exact location of the civic complaint. You can search, drag the map, or use GPS to position the pin.
            </p>
          </div>

          <InteractiveMapPicker
            initialCoords={selectedLocation ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } : null}
            initialAddress={selectedLocation?.address || ""}
            joinedGroups={joinedGroups}
            onChange={(lat, lng, addr) => {
              setSelectedLocation({
                latitude: lat,
                longitude: lng,
                address: addr,
                source: "gps"
              });
            }}
          />
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

      {/* Duplicate Resolution Dialog */}
      {showDuplicateDialog && duplicateCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 rounded-full text-amber-700 border border-amber-200 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-serif text-[#1A1A1A]">⚠ Similar Issue Found Nearby</h3>
                <p className="text-[11px] text-[#7A756D] mt-1">
                  Our duplicate detection system identified a matching report in your immediate vicinity.
                </p>
              </div>
            </div>

            {/* Explanation card */}
            {duplicateCandidate.status === "resolved" ? (
              <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-800 font-semibold leading-relaxed animate-fade-in">
                This issue was previously resolved. Has the problem returned?
              </div>
            ) : (
              <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 text-xs text-[#5A5A40] leading-relaxed">
                A similar civic issue has already been reported nearby. Supporting the existing report helps the municipality understand the true community impact while avoiding duplicate reports.
              </div>
            )}

            {/* Existing Issue details */}
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 space-y-3 shadow-xs">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#A37B5C] bg-amber-50 px-2 py-0.5 rounded-sm">
                  {duplicateCandidate.category || "General"}
                </span>
                <h4 className="text-sm font-bold text-[#1A1A1A] mt-1.5">{duplicateCandidate.title}</h4>
              </div>

              {duplicateCandidate.summary && (
                <div className="text-xs text-[#5A5A40] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#F0EBE3]">
                  <span className="font-semibold block text-[10px] uppercase text-[#7A756D] mb-1">AI Intake Summary:</span>
                  {duplicateCandidate.summary}
                </div>
              )}

              {/* Grid of metadata */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#F0EBE3]">
                  <span className="text-[10px] text-[#7A756D] block">Distance</span>
                  <span className="font-semibold text-[#1A1A1A]">{duplicateCandidate.distance} meters away</span>
                </div>
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#F0EBE3]">
                  <span className="text-[10px] text-[#7A756D] block">Status</span>
                  <span className="font-semibold capitalize text-[#1A1A1A]">{duplicateCandidate.status.replace("_", " ")}</span>
                </div>
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#F0EBE3]">
                  <span className="text-[10px] text-[#7A756D] block">Priority Score</span>
                  <span className="font-mono font-bold text-[#5A5A40]">{duplicateCandidate.priorityScore || 0}</span>
                </div>
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#F0EBE3]">
                  <span className="text-[10px] text-[#7A756D] block">Endorsements</span>
                  <span className="font-semibold text-[#1A1A1A]">{duplicateCandidate.endorsementCount} citizens</span>
                </div>
              </div>
            </div>

            {/* Error display if endorsement fails */}
            {duplicateError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-medium">
                {duplicateError}
              </div>
            )}

            {/* Support Confirmation or Anyway Confirmation Sub-UI */}
            {duplicateCandidate.status === "resolved" ? (
              <div className="flex flex-col gap-2.5 pt-2 animate-fade-in">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  🔄 Report Issue Reopened
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleViewExisting}
                    className="px-3 py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[11px] font-bold rounded-xl text-[#5A5A40] transition-colors cursor-pointer"
                  >
                    View Existing Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicateDialog(false);
                      setDuplicateCandidate(null);
                    }}
                    className="px-3 py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[11px] font-bold rounded-xl text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showAnywayConfirm ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs text-amber-900 leading-normal font-medium">
                  This appears to be a similar nearby issue. Continue only if your report concerns a different real-world problem.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReportAnyway}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Confirm & Report Anyway
                  </button>
                  <button
                    onClick={() => setShowAnywayConfirm(false)}
                    className="px-3 py-1.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-xs font-bold rounded-lg text-amber-800 transition-colors cursor-pointer"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            ) : (
              /* Action Buttons */
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSupportExisting}
                  disabled={isSupportingDuplicate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSupportingDuplicate ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Recording Impact Support...</span>
                    </>
                  ) : (
                    <>
                      <span>👍 Support Existing Issue (Recommended)</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleViewExisting}
                    disabled={isSupportingDuplicate}
                    className="px-3 py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[11px] font-bold rounded-xl text-[#5A5A40] transition-colors cursor-pointer"
                  >
                    View Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAnywayConfirm(true)}
                    disabled={isSupportingDuplicate}
                    className="px-3 py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[11px] font-bold rounded-xl text-[#7A756D] hover:text-[#5A5A40] transition-colors cursor-pointer"
                  >
                    Report Anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicateDialog(false);
                      setDuplicateCandidate(null);
                    }}
                    disabled={isSupportingDuplicate}
                    className="px-3 py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[11px] font-bold rounded-xl text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Future Compatibility Hook Comment */}
            {/* TODO: Future versions may display Community Brief, Community Agent summary, Municipality progress, Resolution timeline */}
          </div>
        </div>
      )}

      {/* Reopen Request Modal */}
      {duplicateCandidate && (
        <ReopenRequestModal
          issueId={duplicateCandidate.id}
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          onSuccess={() => {
            const candidateId = duplicateCandidate.id;
            setShowDuplicateDialog(false);
            setDuplicateCandidate(null);
            onSuccess({ id: candidateId }, "Reopen request submitted successfully for administrator review.");
          }}
        />
      )}
    </div>
  );
}
