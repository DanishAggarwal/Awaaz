import React from "react";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: LucideIcon;
}

export default function DashboardCard({
  title,
  value = "--",
  subtitle,
  icon: Icon
}: DashboardCardProps) {
  return (
    <div className="bg-[#FDFCFB] rounded-2xl border border-[#E5E0D8] p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md hover:border-[#D5D0C8] relative overflow-hidden group" id={`dashboard-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] line-clamp-1">
            {title}
          </h4>
          {Icon && (
            <div className="p-1.5 rounded-lg bg-[#F5F5F0] text-[#5A5A40] group-hover:bg-[#5A5A40]/10 transition-colors shrink-0">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-3xl font-extrabold font-serif text-[#5A5A40] tracking-tight">
            {value}
          </span>
        </div>
      </div>

      {subtitle && (
        <div className="mt-4 pt-3 border-t border-[#E5E0D8]/60 flex items-center justify-between text-[11px] font-medium text-[#7A756D]">
          <span className="truncate">{subtitle}</span>
        </div>
      )}
    </div>
  );
}
