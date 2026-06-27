import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Users, 
  AlertTriangle, 
  Shield, 
  CheckCircle2, 
  Bell, 
  BarChart3, 
  MessageSquare, 
  Loader2,
  Lock,
  Plus,
  Flame,
  MapPin,
  Clock,
  ChevronRight
} from "lucide-react";
import { getGroup, getMyRole, getGroupMembers, getIssues } from "../api";

interface GroupDetailPageProps {
  groupId: string;
  joinedGroupIds: string[];
  onJoinGroup: (groupId: string) => Promise<void>;
  onBack: () => void;
  onReportIssue?: (groupId: string) => void;
  onViewIssue?: (issueId: string, scrollToComments?: boolean) => void;
}

export default function GroupDetailPage({ 
  groupId, 
  joinedGroupIds, 
  onJoinGroup, 
  onBack, 
  onReportIssue,
  onViewIssue 
}: GroupDetailPageProps) {
  const [group, setGroup] = useState<any>(null);
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    async function loadGroupDetails() {
      try {
        setLoading(true);
        setLoadingMembers(true);
        setError(null);
        
        // Fetch group details, role, members list, and issues in parallel
        const [groupRes, roleRes, membersRes, issuesRes] = await Promise.all([
          getGroup(groupId),
          getMyRole(groupId),
          getGroupMembers(groupId),
          getIssues({ groupId })
        ]);

        if (groupRes && groupRes.success && groupRes.data && groupRes.data.group) {
          setGroup(groupRes.data.group);
        } else {
          throw new Error(groupRes?.error || "Failed to load community details.");
        }

        if (roleRes && roleRes.success && roleRes.data) {
          setRole(roleRes.data.role);
        }

        if (membersRes && membersRes.success && membersRes.data && membersRes.data.members) {
          setMembers(membersRes.data.members);
        }

        if (issuesRes && issuesRes.success && issuesRes.data && issuesRes.data.issues) {
          setIssues(issuesRes.data.issues);
        }
      } catch (err: any) {
        console.error("Error loading group details:", err);
        setError(err.message || "An error occurred while fetching details.");
      } finally {
        setLoading(false);
        setLoadingMembers(false);
      }
    }

    loadGroupDetails();
  }, [groupId]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await onJoinGroup(groupId);
      // Refresh local states
      setRole("member");
      setGroup((prev: any) => prev ? { ...prev, memberCount: (prev.memberCount || 0) + 1 } : null);
      
      // Update members list
      const membersRes = await getGroupMembers(groupId);
      if (membersRes && membersRes.success && membersRes.data && membersRes.data.members) {
        setMembers(membersRes.data.members);
      }
    } catch (err) {
      console.error("Failed to join from detail page:", err);
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-24 bg-[#FAF9F6]" id="detail-loading">
        <Loader2 className="h-7 w-7 text-[#5A5A40] animate-spin mb-3" />
        <p className="text-xs text-[#7A756D] font-mono">LOADING COMMUNITY SPHERE...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-[#FAF9F6]" id="detail-error">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#1A1A1A] font-serif">Unable to load community</h3>
          <p className="text-xs text-[#7A756D] mt-2">{error || "The community could not be found."}</p>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] transition-colors rounded-xl text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Communities</span>
          </button>
        </div>
      </div>
    );
  }

  const isJoined = joinedGroupIds.includes(groupId) || !!role;

  const resolvedCount = issues.filter(issue => ["resolved", "confirmed", "closed"].includes(issue.status)).length;
  const reportedCount = issues.length;
  const civicScore = reportedCount > 0 
    ? Math.round((resolvedCount / reportedCount) * 100) 
    : 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-800">Reported</span>;
      case "verified":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">Verified</span>;
      case "assigned":
        return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700">Assigned</span>;
      case "in_progress":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">In Progress</span>;
      case "resolved":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Resolved</span>;
      case "confirmed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-800">Confirmed</span>;
      case "closed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">Closed</span>;
      case "disputed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-800">Disputed</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-800">Reported</span>;
    }
  };

  return (
    <div className="flex-grow flex flex-col min-w-0" id="group-detail-container">
      {/* Detail Header / Nav Bar */}
      <header className="border-b border-[#E5E0D8] bg-white p-5 sticky top-0 z-10 flex items-center justify-between">
        <button
          onClick={onBack}
          id="btn-back-to-groups"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#7A756D] hover:text-[#5A5A40] px-2.5 py-1.5 hover:bg-[#F5F5F0] rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Communities</span>
        </button>

        <div className="flex items-center gap-3">
          {isJoined && (
            <button
              onClick={() => onReportIssue && onReportIssue(groupId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] transition-colors rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Report Community Issue</span>
            </button>
          )}

          {isJoined ? (
            <div className="flex items-center gap-1.5 bg-[#F5F5F0] px-3 py-1.5 rounded-full border border-[#E5E0D8] text-xs font-semibold text-[#5A5A40]" id="role-badge">
              {role === "admin" ? (
                <>
                  <Shield className="h-3.5 w-3.5 text-[#A37B5C]" />
                  <span className="hidden sm:inline">Admin Role</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Member</span>
                </>
              )}
            </div>
          ) : (
            <button
              disabled={isJoining}
              onClick={handleJoin}
              id="btn-detail-join"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] transition-colors rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-55"
            >
              {isJoining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Join Community</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Pane */}
      <div className="p-6 space-y-6 overflow-y-auto flex-grow bg-[#FAF9F6]">
        
        {/* Banner Section */}
        <section className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-2xs space-y-4 relative overflow-hidden" id="detail-hero">
          <div className="absolute right-[-10px] top-[-10px] w-48 h-48 rounded-full bg-[#5A5A40]/3 pointer-events-none" />
          
          <div className="space-y-2 relative">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-teal-50 text-teal-800 border-teal-200/50">
              {group.type}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] font-serif leading-tight">
              {group.name}
            </h1>
            <p className="text-xs text-[#7A756D] font-mono">
              Established on: {new Date(group.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <p className="text-sm text-[#4A4A3A] leading-relaxed max-w-2xl relative">
            {group.description}
          </p>

          {/* Counts metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F5F5F0] relative">
            <div className="p-3 bg-[#FAF9F6] border border-[#E5E0D8]/60 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-[#7A756D] font-medium mb-1">
                <Users className="h-4 w-4 text-[#A8A297]" />
                <span>Members</span>
              </div>
              <p className="text-xl font-bold text-[#1A1A1A] font-mono">{group.memberCount}</p>
            </div>

            <div className="p-3 bg-[#FAF9F6] border border-[#E5E0D8]/60 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-[#7A756D] font-medium mb-1">
                <AlertTriangle className="h-4 w-4 text-[#A8A297]" />
                <span>Reported Issues</span>
              </div>
              <p className="text-xl font-bold text-[#1A1A1A] font-mono">{reportedCount || group.issueCount}</p>
            </div>

            <div className="p-3 bg-[#FAF9F6] border border-[#E5E0D8]/60 rounded-xl col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-[#7A756D] font-medium mb-1">
                <CheckCircle2 className="h-4 w-4 text-[#A8A297]" />
                <span>Resolved Issues</span>
              </div>
              <p className="text-xl font-bold text-[#1A1A1A] font-mono">{resolvedCount}</p>
            </div>

            <div className="p-3 bg-[#FAF9F6] border border-[#E5E0D8]/60 rounded-xl col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-[#7A756D] font-medium mb-1">
                <BarChart3 className="h-4 w-4 text-[#A8A297]" />
                <span>Civic Score</span>
              </div>
              <p className="text-xl font-bold text-[#5A5A40] font-mono">{civicScore}%</p>
            </div>
          </div>
        </section>

        {/* Future compatible placeholders grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="detail-placeholders-grid">
          
          {/* Recent Issues column/section (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F5F5F0] pb-3">
                <h3 className="text-sm font-bold text-[#1A1A1A] font-serif flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#5A5A40]" />
                  <span>Recent Local Issues</span>
                </h3>
                <span className="text-[10px] font-mono text-[#5A5A40] bg-[#F5F5F0] px-2 py-0.5 rounded-full border border-[#E5E0D8]">Active Feed</span>
              </div>
              
              {issues.length === 0 ? (
                <div className="space-y-4 py-6 text-center text-[#7A756D]" id="placeholder-issues">
                  <p className="text-xs italic">There are no active complaints filed under this community group yet.</p>
                  {isJoined ? (
                    <button 
                      onClick={() => onReportIssue && onReportIssue(groupId)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#5A5A40] hover:underline font-bold py-1 px-3 bg-[#F5F5F0] rounded-lg border border-[#E5E0D8]/50 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>File First Community Issue</span>
                    </button>
                  ) : (
                    <p className="text-[10px] text-[#A8A297] flex items-center justify-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Join community to create or endorse issues.</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {issues.map((issue) => {
                    const mainImage = issue.imageUrls && issue.imageUrls.length > 0 ? issue.imageUrls[0] : null;
                    return (
                      <article
                        key={issue.id}
                        onClick={() => onViewIssue && onViewIssue(issue.id)}
                        className="group rounded-xl border border-[#E5E0D8] bg-white hover:border-[#5A5A40]/30 transition-all p-4 flex gap-4 cursor-pointer"
                      >
                        {mainImage && (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-[#FAF9F6] border border-[#E5E0D8] relative">
                            <img 
                              src={mainImage} 
                              alt="Issue proof" 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        )}
                        <div className="flex-grow min-w-0 flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                {getStatusBadge(issue.status)}
                              </div>
                              <div className="flex items-center gap-0.5 text-[#5A5A40]" title="Deterministic Priority Score">
                                <Flame className="h-3 w-3 fill-[#A37B5C] text-[#A37B5C]" />
                                <span className="text-[10px] font-bold font-mono">{issue.priorityScore || 50}</span>
                              </div>
                            </div>
                            <p className="text-xs text-[#4A4A3A] font-semibold leading-snug line-clamp-2 group-hover:text-[#5A5A40] transition-colors">
                              {issue.description}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between text-[9px] text-[#A8A297] font-semibold pt-1 border-t border-[#F5F5F0]/60 gap-2">
                            <span className="truncate max-w-[100px] sm:max-w-xs flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{issue.location?.address || "Coordinates mapped"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-0.5 text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8]/80 px-1.5 py-0.2 rounded-full text-[8px] font-bold">
                                👍 {issue.endorsementCount || 0}
                              </span>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewIssue && onViewIssue(issue.id, true);
                                }}
                                className="inline-flex items-center gap-0.5 text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8]/80 hover:bg-[#F5F5F0] transition-colors px-1.5 py-0.2 rounded-full text-[8px] font-bold cursor-pointer"
                              >
                                💬 {issue.commentCount || 0}
                              </span>
                              <span className="shrink-0 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                <span>{new Date(issue.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Discussion Forums placeholder */}
            <section className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F5F5F0] pb-3">
                <h3 className="text-sm font-bold text-[#1A1A1A] font-serif flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#5A5A40]" />
                  <span>Community Consensus Council</span>
                </h3>
                <span className="text-[10px] font-mono text-[#A8A297] uppercase font-bold bg-[#FAF9F6] px-2 py-0.5 rounded-full border border-[#E5E0D8]">AI Forum</span>
              </div>
              
              <div className="flex items-start gap-4 p-4.5 bg-[#FAF9F6] border border-[#E5E0D8]/60 rounded-xl opacity-60">
                <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full mt-2 shrink-0 animate-ping"></div>
                <div>
                  <h4 className="text-xs font-bold text-[#1A1A1A]">Automated Consensus Scanner</h4>
                  <p className="text-[11px] text-[#7A756D] leading-relaxed mt-1">
                    Future AI scanning modules will compile active local threads, measure endorsement velocities, and summarize community alignment before drafting petitions for municipal authorities.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right rail placeholders (lg:col-span-1) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Announcements Placeholder */}
            <section className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F5F5F0] pb-3">
                <h3 className="text-sm font-bold text-[#1A1A1A] font-serif flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-[#5A5A40]" />
                  <span>Announcements</span>
                </h3>
                <span className="text-[10px] font-mono text-[#A8A297] uppercase font-bold bg-[#FAF9F6] px-1.5 py-0.5 rounded-full border border-[#E5E0D8]">Muni</span>
              </div>

              <div className="space-y-4">
                <div className="p-3 border border-[#E5E0D8]/50 bg-[#FAF9F6] rounded-xl flex gap-3 opacity-65">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#1A1A1A]">System Notice</p>
                    <p className="text-[10px] text-[#7A756D] leading-normal mt-0.5">Welcome to your new hyperlocal sphere! All civic announcements will stream here.</p>
                    <span className="text-[9px] text-[#A8A297] font-mono block mt-1">SYSTEM • JUST NOW</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Members Directory list */}
            <section className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F5F5F0] pb-3">
                <h3 className="text-sm font-bold text-[#1A1A1A] font-serif flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#5A5A40]" />
                  <span>Members</span>
                </h3>
                <span className="text-xs font-mono font-bold text-[#5A5A40] bg-[#F5F5F0] px-2 py-0.5 rounded-full">{members.length}</span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {loadingMembers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-[#5A5A40]/70" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-[11px] text-[#A8A297] italic text-center py-2">No members registered yet.</p>
                ) : (
                  members.map((m) => {
                    const initials = m.displayName ? m.displayName.slice(0, 1).toUpperCase() : "A";
                    return (
                      <div key={m.uid} className="flex items-center justify-between gap-2 p-1 hover:bg-[#FAF9F6] rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {m.photoURL ? (
                            <img
                              src={m.photoURL}
                              alt={m.displayName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover border border-[#E5E0D8]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#FAF5EE] text-[#5A5A40] text-xs font-bold flex items-center justify-center border border-[#E5E0D8]">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1A1A1A] truncate">{m.displayName}</p>
                            <p className="text-[9px] text-[#A8A297] uppercase tracking-wider font-mono">
                              {m.role === "admin" ? "Admin" : "Member"}
                            </p>
                          </div>
                        </div>
                        {m.role === "admin" && (
                          <Shield className="h-3.5 w-3.5 text-[#A37B5C] shrink-0" title="Admin" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

        </div>

      </div>
    </div>
  );
}
