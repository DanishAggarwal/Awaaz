import React from "react";
import { Users, Plus, AlertCircle } from "lucide-react";

interface EmptyGroupsStateProps {
  isSearch: boolean;
  onCreateClick?: () => void;
}

export default function EmptyGroupsState({ isSearch, onCreateClick }: EmptyGroupsStateProps) {
  if (isSearch) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E5E0D8] p-8 max-w-md mx-auto" id="empty-groups-search">
        <AlertCircle className="h-10 w-10 mx-auto text-[#A8A297] mb-3" />
        <h3 className="text-base font-bold text-[#1A1A1A] font-serif">No communities match your search</h3>
        <p className="text-xs text-[#7A756D] mt-1.5 leading-relaxed">
          Try refining your keywords or checking another group type to find communities in your area.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E5E0D8] p-8 max-w-md mx-auto" id="empty-groups-initial">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-[#F5F5F0] flex items-center justify-center text-[#5A5A40] mb-4">
        <Users className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-[#1A1A1A] font-serif">No communities have been created yet</h3>
      <p className="text-xs text-[#7A756D] mt-1.5 leading-relaxed">
        Be the pioneer in your area! Establish a hyperlocal group to organize civic participation, report local issues, and drive local actions.
      </p>
      {onCreateClick && (
        <button
          onClick={onCreateClick}
          id="btn-create-first-community"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] transition-colors rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create First Community</span>
        </button>
      )}
    </div>
  );
}
