import React, { useState, useRef } from "react";
import { X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { uploadImage } from "../utils/uploadImage";
import { submitReopenRequest } from "../api";

interface ReopenRequestModalProps {
  issueId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reopenRequest: any) => void;
}

export default function ReopenRequestModal({
  issueId,
  isOpen,
  onClose,
  onSuccess
}: ReopenRequestModalProps) {
  const [reason, setReason] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const setFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Please explain why this issue needs to be reopened.");
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedUrl = null;
      if (photoFile) {
        uploadedUrl = await uploadImage(photoFile);
      }

      const res = await submitReopenRequest(issueId, reason.trim(), uploadedUrl);
      if (res && res.success) {
        onSuccess(res.data.reopenRequest);
        onClose();
      } else {
        throw new Error(res?.error || "Failed to submit reopen request.");
      }
    } catch (err: any) {
      console.error("Reopen submission failed:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8]/60 pb-3">
          <div>
            <h3 className="text-base font-bold font-serif text-[#1A1A1A]">Report Issue Reopened</h3>
            <p className="text-[10px] text-[#7A756D] mt-0.5">
              Initiate official civic review process
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7A756D] hover:text-[#1A1A1A] p-1.5 rounded-full hover:bg-[#F0EBE3] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info card */}
        <div className="bg-amber-50/60 border border-amber-200/55 rounded-xl p-3.5 text-[11px] text-[#5A5A40] leading-relaxed">
          <p className="font-semibold text-amber-900 mb-1">📋 Citizen Advisory Notification</p>
          This issue was previously resolved. If the problem has returned, submit a reopen request for administrator review.
          <p className="mt-1 font-medium italic text-[#7A756D]">Do NOT immediately reopen the issue.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Reason Textarea */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
              Reason for Reopening <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed explanation of why this issue has returned or is still unresolved. Specific visual or local details are highly recommended."
              className="w-full text-xs p-3 border border-[#E5E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#A37B5C]/60 focus:border-[#A37B5C] bg-white text-[#1A1A1A] placeholder-[#9A958D] min-h-[100px] resize-none leading-relaxed"
            />
          </div>

          {/* Photograph Upload (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
              Current Photograph <span className="text-[#8A8A7F] font-normal lowercase">(optional)</span>
            </label>
            
            {photoPreview ? (
              <div className="relative border border-[#E5E0D8] rounded-xl overflow-hidden bg-white group">
                <img 
                  src={photoPreview} 
                  alt="Current preview" 
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? "border-[#A37B5C] bg-[#FAF9F6]"
                    : "border-[#E5E0D8] bg-white hover:bg-[#FAF9F6]"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="p-2.5 bg-[#FAF9F6] rounded-full text-[#7A756D] border border-[#E5E0D8]">
                  <Upload className="h-5 w-5 text-[#5A5A40]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#1A1A1A]">Drag and drop your image, or click to browse</p>
                  <p className="text-[10px] text-[#8A8A7F]">Supports PNG, JPG, JPEG up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#E5E0D8]/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-white border border-[#E5E0D8] text-xs font-bold text-[#5A5A40] rounded-xl hover:bg-[#F5F5F0] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting request...</span>
                </>
              ) : (
                <span>Submit Reopen Request</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
