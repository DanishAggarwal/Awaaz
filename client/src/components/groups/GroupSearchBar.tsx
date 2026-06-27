import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface GroupSearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
}

export default function GroupSearchBar({ onSearch, initialValue = "" }: GroupSearchBarProps) {
  const [value, setValue] = useState(initialValue);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, 400);

    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative w-full" id="group-search-bar-container">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A297]">
        <Search className="h-4.5 w-4.5" />
      </div>
      <input
        type="text"
        id="group-search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by community name or description..."
        className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#E5E0D8] rounded-xl text-[#1A1A1A] placeholder-[#A8A297] focus:outline-hidden focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-colors shadow-2xs"
      />
      {value && (
        <button
          type="button"
          id="clear-search-button"
          onClick={() => setValue("")}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A8A297] hover:text-[#5A5A40] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
