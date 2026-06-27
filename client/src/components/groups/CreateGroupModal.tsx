import React, { useState } from "react";
import { X, Loader2, Plus, Sparkles } from "lucide-react";
import { createGroup } from "../../api";
import { GROUP_TYPES } from "./GroupFilter";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newGroup: any) => void;
}

export default function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [errors, setErrors] = useState<{ name?: string; description?: string; type?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: { name?: string; description?: string; type?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Community name is required.";
    } else if (name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters long.";
    }

    if (!description.trim()) {
      newErrors.description = "A short description is required.";
    } else if (description.trim().length < 15) {
      newErrors.description = "Description should be descriptive (minimum 15 characters).";
    }

    if (!type) {
      newErrors.type = "Please select a community type.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const res = await createGroup({
        name: name.trim(),
        description: description.trim(),
        type: type
      });

      if (res && res.success && res.data && res.data.group) {
        // Reset states
        setName("");
        setDescription("");
        setType("");
        setErrors({});
        onSuccess(res.data.group);
        onClose();
      } else {
        setApiError(res?.error || "An unexpected error occurred while creating the community.");
      }
    } catch (err: any) {
      console.error("Failed to create group:", err);
      setApiError(err.message || "Network error. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs" id="create-group-modal">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl border border-[#E5E0D8] shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#FAF9F6]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5A5A40] text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A] font-serif">Establish Community</h3>
              <p className="text-[10px] text-[#7A756D] font-mono">CREATE NEW HYPERLOCAL SPHERE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-[#A8A297] hover:text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {apiError && (
            <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl" id="modal-api-error">
              {apiError}
            </div>
          )}

          {/* Group Name */}
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider block">
              Community Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="group-name"
              placeholder="e.g. Rohini Sector 7, XYZ Apartment Society"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`block w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border rounded-xl text-[#1A1A1A] focus:outline-hidden focus:ring-1 transition-colors ${
                errors.name 
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
                  : "border-[#E5E0D8] focus:ring-[#5A5A40] focus:border-[#5A5A40]"
              }`}
            />
            {errors.name && (
              <p className="text-[11px] font-semibold text-red-600 pl-0.5">{errors.name}</p>
            )}
          </div>

          {/* Group Type */}
          <div className="space-y-1.5">
            <label htmlFor="group-type" className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider block">
              Community Type <span className="text-red-500">*</span>
            </label>
            <select
              id="group-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`block w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border rounded-xl text-[#1A1A1A] focus:outline-hidden focus:ring-1 transition-colors ${
                errors.type 
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
                  : "border-[#E5E0D8] focus:ring-[#5A5A40] focus:border-[#5A5A40]"
              }`}
            >
              <option value="">Select a community category...</option>
              {GROUP_TYPES.slice(1).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="text-[11px] font-semibold text-red-600 pl-0.5">{errors.type}</p>
            )}
          </div>

          {/* Group Description */}
          <div className="space-y-1.5">
            <label htmlFor="group-desc" className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider block">
              Aims & Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="group-desc"
              rows={4}
              placeholder="Outline your community boundaries, issues you wish to tackle, and the civic bodies involved in managing this area..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`block w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border rounded-xl text-[#1A1A1A] focus:outline-hidden focus:ring-1 transition-colors resize-none ${
                errors.description 
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
                  : "border-[#E5E0D8] focus:ring-[#5A5A40] focus:border-[#5A5A40]"
              }`}
            />
            {errors.description && (
              <p className="text-[11px] font-semibold text-red-600 pl-0.5">{errors.description}</p>
            )}
            <p className="text-[10px] text-[#A8A297] flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#5A5A40]" />
              <span>A detailed description assists future MCD/municipal routing AI models.</span>
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F5F5F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#7A756D] hover:text-[#5A5A40] hover:bg-[#F5F5F0] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] disabled:bg-[#5A5A40]/50 transition-colors rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Establishing...</span>
                </>
              ) : (
                <span>Create Community</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
