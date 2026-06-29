import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Shield } from "lucide-react";

interface Scope {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface ScopeSelectorProps {
  scopes: Scope[];
  selectedScope: Scope | null;
  onScopeChange: (scope: Scope) => void;
}

export default function ScopeSelector({
  scopes,
  selectedScope,
  onScopeChange
}: ScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (scopes.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F0] border border-[#E5E0D8] rounded-xl text-xs font-semibold text-[#7A756D]">
        <Shield className="h-3.5 w-3.5 text-[#A8A297]" />
        <span>No active scopes available</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef} id="scope-selector-container">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A756D] mb-1 pl-1">
          Your Scope
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          id="btn-scope-selector"
          className="flex items-center justify-between gap-3 px-4 py-2 bg-[#F5F5F0] hover:bg-[#EAEAE2] border border-[#E5E0D8] rounded-xl text-xs font-bold text-[#5A5A40] transition-colors cursor-pointer animate-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#5A5A40] shrink-0"></div>
            <span className="truncate">{selectedScope?.name || "Select Scope"}</span>
            {selectedScope?.type && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-[#5A5A40]/10 text-[#5A5A40] shrink-0 font-mono">
                {selectedScope.type}
              </span>
            )}
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-[#7A756D] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E5E0D8] rounded-2xl shadow-lg z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A8A297] border-b border-[#E5E0D8]/60 mb-1">
            Available Scopes
          </p>
          <div className="max-h-60 overflow-y-auto">
            {scopes.map((scope) => {
              const isSelected = selectedScope?.id === scope.id;
              return (
                <button
                  key={scope.id}
                  onClick={() => {
                    onScopeChange(scope);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors hover:bg-[#F5F5F0] ${
                    isSelected ? "text-[#5A5A40] bg-[#F5F5F0]/60 font-bold" : "text-[#4A4A3A]"
                  }`}
                >
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="truncate">{scope.name}</span>
                    <span className="text-[9px] text-[#A8A297] font-mono uppercase tracking-wider">
                      ID: {scope.id} • Role: {scope.role}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[#5A5A40] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
