import React, { useState } from "react";
import { Users, AlertTriangle, ChevronRight, Loader2, Pin } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string;
  type: string;
  memberCount: number;
  issueCount: number;
}

interface GroupCardProps {
  key?: string | number;
  group: Group;
  isJoined: boolean;
  onJoin: (groupId: string) => Promise<void>;
  onView: (groupId: string) => void;
}

export default function GroupCard({ group, isJoined, onJoin, onView }: GroupCardProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setJoinError(null);
    setIsJoining(true);
    try {
      await onJoin(group.id);
    } catch (err: any) {
      console.error("Error joining from card:", err);
      setJoinError("Failed to join.");
    } finally {
      setIsJoining(false);
    }
  };

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case "Locality":
        return "bg-teal-50 text-teal-800 border-teal-200/50";
      case "Apartment Society":
        return "bg-indigo-50 text-indigo-800 border-indigo-200/50";
      case "Educational Institution":
        return "bg-amber-50 text-amber-800 border-amber-200/50";
      case "Market Association":
        return "bg-rose-50 text-rose-800 border-rose-200/50";
      case "NGO":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/50";
      case "Resident Welfare Association":
        return "bg-blue-50 text-blue-800 border-blue-200/50";
      default:
        return "bg-slate-50 text-slate-800 border-slate-200/50";
    }
  };

  return (
    <div 
      className="bg-white rounded-2xl border border-[#E5E0D8] hover:border-[#5A5A40]/40 p-5 flex flex-col justify-between transition-all hover:shadow-xs group/card cursor-pointer"
      onClick={() => onView(group.id)}
      id={`group-card-${group.id}`}
    >
      <div className="space-y-3">
        {/* Type Badge & Meta */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getGroupTypeColor(group.type)}`}>
            {group.type}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-[#A8A297] font-mono font-medium">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{group.memberCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{group.issueCount}</span>
            </span>
          </div>
        </div>

        {/* Title and Description */}
        <div>
          <h4 className="text-base font-bold text-[#1A1A1A] font-serif group-hover/card:text-[#5A5A40] transition-colors line-clamp-1">
            {group.name}
          </h4>
          <p className="text-xs text-[#7A756D] leading-relaxed line-clamp-2 mt-1.5">
            {group.description}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 pt-4 border-t border-[#F5F5F0] flex items-center justify-between">
        {joinError ? (
          <span className="text-[10px] text-red-600 font-semibold">{joinError}</span>
        ) : (
          <span className="text-[10px] text-[#A8A297] font-mono">ID: {group.id.slice(0, 8)}...</span>
        )}

        {isJoined ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(group.id);
            }}
            id={`btn-view-${group.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#5A5A40] hover:underline"
          >
            <span>View Community</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            disabled={isJoining}
            onClick={handleJoin}
            id={`btn-join-${group.id}`}
            className="inline-flex items-center justify-center min-w-[100px] px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#5A5A40]/30 hover:border-[#5A5A40] transition-colors rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-55"
          >
            {isJoining ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span>Join Community</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
