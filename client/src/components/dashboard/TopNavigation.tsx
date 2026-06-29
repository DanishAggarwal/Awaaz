import React from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import ScopeSelector from "./ScopeSelector";

interface Scope {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface User {
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
}

interface TopNavigationProps {
  user: User | null;
  logout: () => void;
  scopes: Scope[];
  selectedScope: Scope | null;
  onScopeChange: (scope: Scope) => void;
}

export default function TopNavigation({
  user,
  logout,
  scopes,
  selectedScope,
  onScopeChange
}: TopNavigationProps) {
  return (
    <header className="h-16 border-b border-[#E5E0D8] bg-[#FDFCFB]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40" id="dashboard-header">
      {/* Scope Selector on Left */}
      <div className="flex items-center gap-4">
        <ScopeSelector
          scopes={scopes}
          selectedScope={selectedScope}
          onScopeChange={onScopeChange}
        />
      </div>

      {/* Admin Profile & Actions on Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 pl-3 border-l border-[#E5E0D8]">
          <div className="text-right">
            <p className="text-xs font-bold text-[#1A1A1A]">
              {user?.displayName || "Administrator"}
            </p>
            <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3" />
              <span>Authorized</span>
            </div>
          </div>

          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              className="h-8 w-8 rounded-full border-2 border-white shadow-xs shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5E0D8] text-[#5A5A40] border-2 border-white shadow-xs font-bold text-xs shrink-0">
              {user?.displayName?.[0] || "A"}
            </div>
          )}
        </div>

        <button
          onClick={logout}
          id="btn-admin-logout"
          title="Sign Out"
          className="p-2 rounded-xl border border-[#E5E0D8] text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
