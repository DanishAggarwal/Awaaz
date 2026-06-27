import React, { useState, useEffect, useCallback } from "react";
import { getIssues } from "../api";
import { 
  Flame, 
  MapPin, 
  Plus, 
  AlertTriangle, 
  Compass, 
  Sparkles, 
  ThumbsUp, 
  MessageSquare, 
  Eye, 
  EyeOff,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2
} from "lucide-react";

interface IssuesFeedProps {
  joinedGroups: any[];
  onViewIssue: (issueId: string, scrollToComments?: boolean) => void;
  onReportIssue: (groupId?: string | null) => void;
  initialGroupId?: string | null;
}

export default function IssuesFeed({ joinedGroups, onViewIssue, onReportIssue, initialGroupId }: IssuesFeedProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Scopes: "my-groups" | "public"
  const [activeScope, setActiveScope] = useState<"my-groups" | "public">(
    initialGroupId ? "my-groups" : "public"
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || "");
  const [sortBy, setSortBy] = useState<"newest" | "priority" | "endorsed">("newest");

  // Fetch issues based on selected filters
  const fetchIssuesList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let params: { scope?: string; groupId?: string } = {};
      if (activeScope === "my-groups") {
        if (selectedGroupId) {
          params.groupId = selectedGroupId;
        } else {
          params.scope = "my-groups";
        }
      } else {
        params.scope = "public";
      }

      const res = await getIssues(params);
      if (res && res.success && res.data && res.data.issues) {
        setIssues(res.data.issues);
      } else {
        setError(res?.error || "Failed to load issues feed. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to load issues:", err);
      setError("Unable to connect to the Awaaz telemetry network. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeScope, selectedGroupId]);

  useEffect(() => {
    fetchIssuesList();
  }, [fetchIssuesList]);

  // Status utility
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider font-mono border border-amber-200/50">
            Reported
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 uppercase tracking-wider font-mono border border-sky-200/50">
            In Progress
          </span>
        );
      case "assigned":
        return (
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wider font-mono border border-indigo-200/50">
            Assigned
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono border border-emerald-200/50">
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-[#F5F5F0] px-2 py-0.5 text-[10px] font-bold text-[#4A4A3A] uppercase tracking-wider font-mono border border-[#E5E0D8]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-grow flex flex-col min-w-0 font-sans">
      
      {/* Dynamic Header */}
      <header className="border-b border-[#E5E0D8] bg-white/85 backdrop-blur-md p-5 sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif flex items-center gap-2">
            <span>Awaaz Civic Ledger</span>
          </h2>
          <p className="text-xs text-[#7A756D] mt-0.5">
            Real-time citizen-sourced complaints and community-verified civic evidence.
          </p>
        </div>

        {/* Call to action */}
        <button
          onClick={() => {
            if (activeScope === "public") {
              onReportIssue(null);
            } else {
              onReportIssue(selectedGroupId || undefined);
            }
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{activeScope === "public" ? "Report Public Issue" : "Report Community Issue"}</span>
        </button>
      </header>

      {/* Scope Filter Controls Bar */}
      <div className="bg-[#FAF9F6] border-b border-[#E5E0D8] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 bg-[#F5F5F0] p-1 rounded-xl border border-[#E5E0D8]">
          <button
            onClick={() => {
              setActiveScope("public");
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeScope === "public" ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#7A756D] hover:text-[#5A5A40]"
            }`}
          >
            Public Feed
          </button>
          <button
            onClick={() => {
              setActiveScope("my-groups");
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeScope === "my-groups" ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#7A756D] hover:text-[#5A5A40]"
            }`}
          >
            My Communities
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Conditional Group Dropdown inside My Communities */}
          {activeScope === "my-groups" && (
            <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
              <span className="text-xs text-[#7A756D] font-medium hidden sm:inline">Filter:</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full sm:w-56 text-xs bg-white border border-[#E5E0D8] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#5A5A40] transition-colors font-medium text-[#1A1A1A]"
              >
                <option value="">All My Communities</option>
                {joinedGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
            <span className="text-xs text-[#7A756D] font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full sm:w-44 text-xs bg-white border border-[#E5E0D8] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#5A5A40] transition-colors font-medium text-[#1A1A1A]"
            >
              <option value="newest">🕒 Newest First</option>
              <option value="priority">🔥 Highest Priority</option>
              <option value="endorsed">👍 Most Endorsed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stream Area */}
      <section className="p-6 space-y-6 overflow-y-auto flex-grow" aria-label="Awaaz Issues list">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Unable to fetch feed</div>
              <p className="text-[11px] text-rose-700/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#5A5A40] mb-2" />
            <span className="text-[#7A756D] text-xs font-medium">Retrieving issues stream...</span>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E5E0D8] p-8 max-w-lg mx-auto">
            <div className="h-12 w-12 rounded-full bg-[#FAF9F6] flex items-center justify-center mx-auto mb-4 text-[#A8A297] border border-[#E5E0D8]">
              <Compass className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-[#4A4A3A]">No reported issues found</p>
            <p className="text-xs text-[#8A8A6F] mt-1 leading-normal">
              {activeScope === "my-groups" 
                ? "You haven't joined any communities that have active issue reports, or your communities are currently in perfect standing!"
                : activeScope === "specific" && !selectedGroupId
                ? "Please select a community group above to filter reported issues."
                : "No active civic alerts currently match this feed scope. Tap below to map the very first alert."}
            </p>
            <button
              onClick={() => {
                if (activeScope === "public") {
                  onReportIssue(null);
                } else {
                  onReportIssue(selectedGroupId || undefined);
                }
              }}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Report First Issue</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto">
            {(() => {
              const sortedIssues = [...issues].sort((a, b) => {
                if (sortBy === "priority") {
                  return (b.priorityScore || 0) - (a.priorityScore || 0);
                }
                if (sortBy === "endorsed") {
                  return (b.endorsementCount || 0) - (a.endorsementCount || 0);
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });

              return sortedIssues.map((issue) => {
                const mainImage = issue.imageUrls && issue.imageUrls.length > 0 ? issue.imageUrls[0] : null;
                
                return (
                  <article
                    key={issue.id}
                    onClick={() => onViewIssue(issue.id)}
                    className="group rounded-2xl border border-[#E5E0D8] bg-white hover:border-[#5A5A40]/30 transition-all shadow-xs overflow-hidden flex flex-col md:flex-row cursor-pointer"
                  >
                    {/* Image side column (left on large, top on mobile) */}
                    {mainImage && (
                      <div className="md:w-56 shrink-0 aspect-video md:aspect-auto relative bg-[#FAF9F6] overflow-hidden border-b md:border-b-0 md:border-r border-[#E5E0D8]">
                        <img 
                          src={mainImage} 
                          alt="Issue proof" 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        />
                        {issue.imageUrls.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                            +{issue.imageUrls.length - 1} photos
                          </span>
                        )}
                      </div>
                    )}

                    {/* Body Info column (right on large, bottom on mobile) */}
                    <div className="flex-grow p-5 flex flex-col justify-between space-y-4">
                      <div>
                        {/* Priority and Status header */}
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {issue.groupName && (
                              <span className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider bg-[#F5F5F0] border border-[#E5E0D8] px-2 py-0.5 rounded-md">
                                {issue.groupName}
                              </span>
                            )}
                            {getStatusBadge(issue.status)}
                          </div>

                          {/* Priority Flame score */}
                          <div className="flex items-center gap-1 bg-[#FAF9F6] px-2 py-0.5 rounded-lg border border-[#E5E0D8] text-[#5A5A40]" title="Deterministic Priority Score">
                            <Flame className="h-3.5 w-3.5 fill-[#A37B5C] text-[#A37B5C]" />
                            <span className="text-[11px] font-bold font-mono">{issue.priorityScore || 50}</span>
                          </div>
                        </div>

                        {/* Brief description */}
                        <p className="text-sm text-[#4A4A3A] font-medium leading-relaxed line-clamp-3 mb-3">
                          {issue.description}
                        </p>

                        {/* Landmark address pin */}
                        <div className="flex items-center gap-1.5 text-xs text-[#7A756D] bg-[#FAF9F6] px-2.5 py-1.5 rounded-lg border border-[#E5E0D8]/60">
                          <MapPin className="h-3.5 w-3.5 text-[#A8A297] shrink-0" />
                          <span className="truncate">{issue.location.address || "Coordinates mapped"}</span>
                        </div>
                      </div>

                      {/* Footer stats and meta */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#F5F5F0] text-[10px] text-[#A8A297] font-semibold">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Filed {new Date(issue.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}</span>
                            <span>by {issue.authorName || "Citizen"}</span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8] px-2 py-0.5 rounded-full text-[9px] font-bold">
                            👍 {issue.endorsementCount || 0}
                          </span>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewIssue(issue.id, true);
                            }}
                            className="inline-flex items-center gap-1 text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8] hover:bg-[#F5F5F0] transition-colors px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer"
                          >
                            💬 {issue.commentCount || 0}
                          </span>
                        </div>
                        
                        <span className="text-[#5A5A40] flex items-center gap-0.5 hover:underline group-hover:translate-x-0.5 transition-transform">
                          <span>Inspect complaint</span>
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              });
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
