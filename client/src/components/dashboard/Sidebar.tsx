import React from "react";
import { 
  LayoutDashboard, 
  AlertTriangle, 
  BarChart3, 
  Users2, 
  ShieldAlert, 
  Brain, 
  BellRing, 
  Settings2, 
  ArrowLeft 
} from "lucide-react";

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  onBackToCitizenApp: () => void;
}

export default function Sidebar({
  currentSection,
  onSectionChange,
  onBackToCitizenApp
}: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "issues", label: "Issues", icon: AlertTriangle, placeholder: "Soon" },
    { id: "community", label: "Community", icon: Users2, placeholder: "Soon" },
    { id: "settings", label: "Settings", icon: Settings2, placeholder: "Soon" },
  ];

  return (
    <aside className="w-[240px] bg-[#FDFCFB] flex flex-col border-r border-[#E5E0D8] shrink-0 p-5 justify-between h-screen sticky top-0" id="dashboard-sidebar">
      <div className="flex flex-col flex-grow">
        {/* Header / Logo */}
        <div className="flex items-center gap-2 mb-8 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5A5A40] text-white font-extrabold text-lg">
            आ
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#5A5A40] uppercase">Admin Dashboard</h1>
            <p className="text-[9px] text-[#A8A297] uppercase tracking-widest font-bold">Awaaz Network</p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1 flex-grow" aria-label="Operations Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer group ${
                  isActive 
                    ? "bg-[#F5F5F0] text-[#5A5A40]" 
                    : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-[#5A5A40]" : "text-[#A8A297] group-hover:text-[#5A5A40]"}`} />
                  <span>{item.label}</span>
                </div>
                {item.placeholder && (
                  <span className="text-[8px] font-bold text-[#A8A297] uppercase tracking-wider bg-[#F5F5F0] px-1.5 py-0.5 rounded-md group-hover:bg-[#EAEAE2] group-hover:text-[#7A756D] transition-colors">
                    {item.placeholder}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Back button at the bottom */}
      <div className="border-t border-[#E5E0D8] pt-4 mt-auto">
        <button
          onClick={onBackToCitizenApp}
          id="btn-back-to-citizen"
          className="w-full flex items-center gap-2.5 justify-center py-2.5 px-4 bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white border border-[#E5E0D8] text-[#5A5A40] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Exit Dashboard</span>
        </button>
      </div>
    </aside>
  );
}
