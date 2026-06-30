import React, { useState, useEffect } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  TrendingUp, 
  Shield, 
  RotateCcw, 
  Sparkles,
  ArrowRight,
  BellRing
} from "lucide-react";
import { subscribeToCommunityPulse } from "../api";

interface CommunityPulseProps {
  joinedGroups: any[];
  onViewIssue: (issueId: string) => void;
}

interface PulseActivity {
  id: string;
  issueId: string;
  type: "reported" | "status_change" | "discussion" | "trending";
  icon: string;
  dotColor: string;
  title: string;
  description: string;
  communityName: string;
  timestamp: string;
  category: string;
  status: string;
}

export default function CommunityPulse({ joinedGroups, onViewIssue }: CommunityPulseProps) {
  const [activities, setActivities] = useState<PulseActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Group IDs to subscribe to
  const groupIds = joinedGroups.map((g) => g.id);

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to real-time issue updates (User's joined groups + Public network)
    const unsubscribe = subscribeToCommunityPulse(groupIds, (updatedIssues: any[]) => {
      const allActivities: PulseActivity[] = [];

      updatedIssues.forEach((issue) => {
        // 1. Report Event (always exists)
        allActivities.push({
          id: `${issue.id}-reported`,
          issueId: issue.id,
          type: "reported",
          icon: "AlertCircle",
          dotColor: "bg-[#A37B5C]",
          title: "New issue reported",
          description: `${issue.title || "Civic Complaint"} reported near ${
            issue.location?.address 
              ? issue.location.address.split(",")[0] 
              : "community"
          }`,
          communityName: issue.groupName || "Public Initiative",
          timestamp: issue.createdAt,
          category: issue.aiCategory || issue.category || "General",
          status: issue.status,
        });

        // 2. Status Change Event (if updated beyond reported)
        if (issue.status && issue.status !== "reported") {
          let icon = "Clock";
          let dotColor = "bg-blue-500";
          let title = "Status update";
          let description = "";

          if (issue.status === "verified" || issue.status === "confirmed") {
            icon = "Shield";
            dotColor = "bg-amber-500";
            title = "Issue verified";
            description = `${issue.category ? issue.category.charAt(0).toUpperCase() + issue.category.slice(1) : "Civic"} complaint verified by community`;
          } else if (issue.status === "assigned" || issue.status === "in_progress") {
            icon = "Clock";
            dotColor = "bg-orange-500";
            title = "Work started";
            description = `"${issue.title || "Issue"}" marked as In Progress`;
          } else if (issue.status === "resolved" || issue.status === "closed") {
            icon = "CheckCircle2";
            dotColor = "bg-emerald-600";
            title = "Issue resolved";
            description = `"${issue.title || "Issue"}" has been successfully resolved`;
          } else if (issue.status === "reopened") {
            icon = "RotateCcw";
            dotColor = "bg-rose-600";
            title = "Issue reopened";
            description = `Residents reported problem returned for "${issue.title || "Issue"}"`;
          }

          if (description) {
            allActivities.push({
              id: `${issue.id}-status-${issue.status}`,
              issueId: issue.id,
              type: "status_change",
              icon,
              dotColor,
              title,
              description,
              communityName: issue.groupName || "Public Initiative",
              timestamp: issue.updatedAt || issue.createdAt,
              category: issue.aiCategory || issue.category || "General",
              status: issue.status,
            });
          }
        }

        // 3. Discussion Event (if comments exist)
        if (issue.commentCount && issue.commentCount > 0) {
          allActivities.push({
            id: `${issue.id}-discussion`,
            issueId: issue.id,
            type: "discussion",
            icon: "MessageSquare",
            dotColor: "bg-indigo-500",
            title: "Active discussion",
            description: `${issue.commentCount} comments on "${issue.title || "Issue"}"`,
            communityName: issue.groupName || "Public Initiative",
            timestamp: issue.updatedAt || issue.createdAt,
            category: issue.aiCategory || issue.category || "General",
            status: issue.status,
          });
        }

        // 4. Trending Event (if highly supported/endorsed)
        if (issue.endorsementCount && issue.endorsementCount >= 2) {
          allActivities.push({
            id: `${issue.id}-trending`,
            issueId: issue.id,
            type: "trending",
            icon: "TrendingUp",
            dotColor: "bg-rose-500",
            title: "Trending issue",
            description: `"${issue.title || "Issue"}" receiving high community support`,
            communityName: issue.groupName || "Public Initiative",
            timestamp: issue.updatedAt || issue.createdAt,
            category: issue.aiCategory || issue.category || "General",
            status: issue.status,
          });
        }
      });

      // Sort all activities in reverse chronological order (newest first)
      allActivities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Limit to 20 recent activities
      setActivities(allActivities.slice(0, 20));
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [JSON.stringify(groupIds)]);

  // Relative timestamp helper function
  const formatTime = (dateInput: string) => {
    try {
      const now = new Date();
      const past = new Date(dateInput);
      const diffMs = now.getTime() - past.getTime();
      
      if (isNaN(diffMs) || diffMs < 0) {
        return "just now";
      }

      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return past.toLocaleDateString("en-IN", { day: 'numeric', month: 'short' });
    } catch (e) {
      return "recently";
    }
  };

  // Icon mapping helper
  const renderIcon = (iconName: string) => {
    const iconClass = "h-3.5 w-3.5 text-white";
    switch (iconName) {
      case "AlertCircle":
        return <AlertCircle className={iconClass} />;
      case "CheckCircle2":
        return <CheckCircle2 className={iconClass} />;
      case "Clock":
        return <Clock className={iconClass} />;
      case "MessageSquare":
        return <MessageSquare className={iconClass} />;
      case "TrendingUp":
        return <TrendingUp className={iconClass} />;
      case "Shield":
        return <Shield className={iconClass} />;
      case "RotateCcw":
        return <RotateCcw className={iconClass} />;
      default:
        return <Sparkles className={iconClass} />;
    }
  };

  // Helper to style status badge
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "reported":
        return "bg-amber-100 text-amber-800 border-amber-200/50";
      case "verified":
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200/50";
      case "assigned":
      case "in_progress":
        return "bg-orange-100 text-orange-800 border-orange-200/50";
      case "resolved":
      case "closed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200/50";
      case "reopened":
        return "bg-rose-100 text-rose-800 border-rose-200/50";
      default:
        return "bg-[#FAF9F6] text-[#4A4A3A] border-[#E5E0D8]";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#A8A297] gap-2">
          <div className="w-5 h-5 border-2 border-t-[#5A5A40] border-[#E5E0D8] rounded-full animate-spin"></div>
          <p className="text-[11px] font-medium font-mono">Syncing pulse...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-[#FAF9F6] rounded-2xl p-6 border border-[#E5E0D8]/60 text-center flex flex-col items-center gap-2">
          <BellRing className="h-6 w-6 text-[#A8A297]/60" />
          <p className="text-xs font-semibold text-[#4A4A3A]">
            No recent community activity.
          </p>
          <p className="text-[10px] text-[#A8A297]">
            You're all caught up.
          </p>
        </div>
      ) : (
        <div className="relative pl-3 border-l border-[#E5E0D8] space-y-5" aria-label="Live community pulse feed">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="relative group cursor-pointer"
              onClick={() => onViewIssue(activity.issueId)}
            >
              {/* Timeline Dot Indicator */}
              <div className={`absolute left-[-19.5px] top-1 w-3 h-3 rounded-full border border-white flex items-center justify-center ${activity.dotColor} shadow-sm transition-transform duration-200 group-hover:scale-110`}>
                <div className="w-1 h-1 rounded-full bg-white"></div>
              </div>

              {/* Activity Box */}
              <div className="bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8]/60 hover:border-[#5A5A40]/40 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded-md ${activity.dotColor} shadow-2xs`}>
                      {renderIcon(activity.icon)}
                    </span>
                    <span className="text-[10px] font-extrabold text-[#1A1A1A] uppercase tracking-wider font-sans">
                      {activity.title}
                    </span>
                  </div>
                  <span className="text-[9px] text-[#A8A297] font-semibold font-mono whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-[#4A4A3A] font-medium leading-relaxed font-sans">
                  {activity.description}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#F5F5F0]">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {/* Community tag */}
                    <span className="text-[9px] text-[#7A756D] font-bold truncate max-w-[80px]">
                      {activity.communityName}
                    </span>
                    <span className="text-[#E5E0D8] text-[10px] select-none">•</span>
                    {/* Category Chip */}
                    <span className="bg-[#FAF9F6] text-[#5A5A40] border border-[#E5E0D8]/40 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                      {activity.category}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${getStatusStyle(activity.status)}`}>
                    {activity.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
