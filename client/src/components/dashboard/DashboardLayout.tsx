import React from "react";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";

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

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User | null;
  logout: () => void;
  scopes: Scope[];
  selectedScope: Scope | null;
  onScopeChange: (scope: Scope) => void;
  currentSection: string;
  onSectionChange: (section: string) => void;
  onBackToCitizenApp: () => void;
}

export default function DashboardLayout({
  children,
  user,
  logout,
  scopes,
  selectedScope,
  onScopeChange,
  currentSection,
  onSectionChange,
  onBackToCitizenApp
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex antialiased font-sans" id="ops-dashboard-root">
      {/* Sidebar navigation */}
      <Sidebar
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        onBackToCitizenApp={onBackToCitizenApp}
      />

      {/* Main viewport area */}
      <div className="flex-grow flex flex-col min-w-0 min-h-screen">
        {/* Top bar header */}
        <TopNavigation
          user={user}
          logout={logout}
          scopes={scopes}
          selectedScope={selectedScope}
          onScopeChange={onScopeChange}
        />

        {/* Scrollable primary content wrapper */}
        <main className="flex-grow p-8 overflow-y-auto max-w-7xl w-full mx-auto" id="dashboard-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
