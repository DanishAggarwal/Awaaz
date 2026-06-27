import React from "react";
import { Layers } from "lucide-react";

interface GroupFilterProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

export const GROUP_TYPES = [
  { label: "All Types", value: "" },
  { label: "Locality", value: "Locality" },
  { label: "Apartment Society", value: "Apartment Society" },
  { label: "Educational Institution", value: "Educational Institution" },
  { label: "Market Association", value: "Market Association" },
  { label: "NGO", value: "NGO" },
  { label: "Resident Welfare Association", value: "Resident Welfare Association" }
];

export default function GroupFilter({ selectedType, onSelectType }: GroupFilterProps) {
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar" id="group-filter-container">
      <div className="flex items-center gap-1 text-[#A8A297] text-xs font-bold uppercase tracking-wider select-none shrink-0">
        <Layers className="h-3.5 w-3.5" />
        <span>Filter:</span>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {GROUP_TYPES.map((type) => {
          const isActive = selectedType === type.value;
          return (
            <button
              key={type.value}
              id={`filter-pill-${type.value || "all"}`}
              onClick={() => onSelectType(type.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                isActive
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs"
                  : "bg-white text-[#7A756D] border-[#E5E0D8] hover:text-[#5A5A40] hover:border-[#5A5A40]/40"
              }`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
