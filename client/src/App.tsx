import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { 
  MapPin, 
  AlertCircle, 
  ThumbsUp, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Compass, 
  Bell, 
  Users, 
  Flame, 
  TrendingUp, 
  MessageSquare,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  Loader2,
  Plus
} from "lucide-react";
import { getRisingIssues, getGroups, joinGroup } from "./api";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import CreateGroupModal from "./components/groups/CreateGroupModal";
import IssuesFeed from "./pages/IssuesFeed";
import ReportIssue from "./pages/ReportIssue";
import IssueDetail from "./pages/IssueDetail";
import { NearbyIssues, MyReports, NotificationsPage } from "./pages/PlaceholderPages";

// Define TypeScript structures
interface Issue {
  id: string;
  groupId: string;
  groupName?: string;
  reportedBy: string;
  reporterName: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  aiCategory: "pothole" | "garbage" | "waterlogging" | "streetlight" | "sewage" | "other";
  aiSeverity: "low" | "medium" | "high" | "critical";
  aiSummary: string;
  status: "reported" | "verified" | "assigned" | "in_progress" | "resolved" | "confirmed" | "closed" | "disputed";
  endorsementCount: number;
  priorityScore: number;
  createdAt: string;
}

export default function App() {
  return (
    <ProtectedRoute>
      <MainDashboard />
    </ProtectedRoute>
  );
}

function MainDashboard() {
  const { user, logout, refreshUser } = useAuth();

  // Helper to parse initial state from URL query parameters (for bookmarks and refresh resilience)
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["feed", "nearby", "reports", "notifications", "groups", "group_detail", "report_issue", "issue_detail"].includes(tab)) {
      return tab as "feed" | "nearby" | "reports" | "notifications" | "groups" | "group_detail" | "report_issue" | "issue_detail";
    }
    return "feed";
  };

  const getInitialGroupId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("groupId");
  };

  const getInitialIssueId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("issueId");
  };

  const [activeTab, setActiveTab] = useState<"feed" | "nearby" | "reports" | "notifications" | "groups" | "group_detail" | "report_issue" | "issue_detail">(getInitialTab);
  const [activeFilter, setActiveFilter] = useState<"all" | "groups" | "public">("all");
  const [apiIssues, setApiIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Groups and roles state management
  const [activeGroupId, setActiveGroupId] = useState<string | null>(getInitialGroupId);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(getInitialIssueId);
  const [joinedGroups, setJoinedGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isAppCreateModalOpen, setIsAppCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync tab/group/issue state changes to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    
    if (activeTab === "group_detail" && activeGroupId) {
      params.set("groupId", activeGroupId);
    } else {
      params.delete("groupId");
    }

    if (activeTab === "issue_detail" && activeIssueId) {
      params.set("issueId", activeIssueId);
    } else {
      params.delete("issueId");
    }
    
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, "");
    if (newSearch !== currentSearch) {
      window.history.pushState(null, "", `?${newSearch}`);
    }
  }, [activeTab, activeGroupId, activeIssueId]);

  // Listen to browser back/forward (popstate) to keep tab, groupId, and issueId state fully in-sync
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const groupId = params.get("groupId");
      const issueId = params.get("issueId");

      if (tab && ["feed", "nearby", "reports", "notifications", "groups", "group_detail", "report_issue", "issue_detail"].includes(tab)) {
        setActiveTab(tab as any);
      } else {
        setActiveTab("feed");
      }
      setActiveGroupId(groupId);
      setActiveIssueId(issueId);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Load user's joined groups from the server
  const loadJoinedGroups = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoadingGroups(true);
      const res = await getGroups();
      if (res && res.success && res.data && res.data.groups) {
        const userGroupIds = user.groupIds || [];
        const joined = res.data.groups.filter((g: any) => userGroupIds.includes(g.id));
        setJoinedGroups(joined);
      }
    } catch (err) {
      console.error("Error loading joined groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [user]);

  useEffect(() => {
    loadJoinedGroups();
  }, [user, loadJoinedGroups]);

  // Handle joining a community group at app-level (syncs user context & re-fetches joined list)
  const handleJoinGroupAtAppLevel = async (groupId: string) => {
    try {
      const res = await joinGroup(groupId);
      if (res && res.success) {
        if (refreshUser) {
          await refreshUser();
        }
        await loadJoinedGroups();
        setToast({
          message: "Successfully joined the community!",
          type: "success"
        });
      } else {
        const errMsg = res?.error || "Failed to join community group.";
        setToast({ message: errMsg, type: "error" });
        throw new Error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || "Failed to join community group.";
      setToast({ message: errMsg, type: "error" });
      throw err;
    }
  };

  const handleAppCreateSuccess = async (newGroup: any) => {
    try {
      setToast({
        message: `Successfully established community "${newGroup.name}"!`,
        type: "success"
      });

      if (refreshUser) {
        await refreshUser();
      }
      await loadJoinedGroups();

      if (newGroup && newGroup.id) {
        setActiveGroupId(newGroup.id);
        setActiveTab("group_detail");
      }
    } catch (err: any) {
      console.error("Failed to refresh on group creation:", err);
    }
  };

  // 3 Hardcoded issues as fallback and standard view
  const hardcodedIssues: Issue[] = [
    {
      id: "issue_1",
      groupId: "group_sec12",
      groupName: "Sector 12 RWA",
      reportedBy: "uid_citizen_1",
      reporterName: "Rajesh Kumar",
      description: "Severe overflow of open sewage line next to Sector 12 public park. The water is spilling onto the pedestrian walking path and causing a major health hazard for children and elders visiting the park daily.",
      location: { lat: 28.6139, lng: 77.209, address: "Sector 12 Park Road, Dwarka, New Delhi" },
      aiCategory: "sewage",
      aiSeverity: "critical",
      aiSummary: "Open sewage line overflowing near public park and pedestrian walkway.",
      status: "reported",
      endorsementCount: 42,
      priorityScore: 54,
      createdAt: "2026-06-25T08:00:00Z"
    },
    {
      id: "issue_2",
      groupId: "group_indiranagar",
      groupName: "Indiranagar Civic Forum",
      reportedBy: "uid_citizen_2",
      reporterName: "Ananya Sharma",
      description: "Massive pothole craters have formed right under the Metro Station Pillar 120. During brief rains, these fill with water completely, making them invisible and causing serious bike accidents.",
      location: { lat: 12.9716, lng: 77.5946, address: "Under Pillar 120, Indiranagar Double Rd, Bengaluru" },
      aiCategory: "waterlogging",
      aiSeverity: "high",
      aiSummary: "Dangerous pothole craters under metro pillar prone to waterlogging.",
      status: "in_progress",
      endorsementCount: 78,
      priorityScore: 68,
      createdAt: "2026-06-24T14:30:00Z"
    },
    {
      id: "issue_3",
      groupId: "group_road_safety",
      groupName: "Road Safety Initiative",
      reportedBy: "uid_citizen_3",
      reporterName: "Vikram Malhotra",
      description: "Entire stretch of streetlights are non-functional on Outer Ring Road, Block B. The pitch-dark road is highly unsafe for women commuters returning late from the nearby tech park.",
      location: { lat: 19.076, lng: 72.8777, address: "Outer Ring Road, Block B, Marathahalli, Bengaluru" },
      aiCategory: "streetlight",
      aiSeverity: "medium",
      aiSummary: "Broken streetlights leading to dark, unsafe commuter stretch.",
      status: "assigned",
      endorsementCount: 29,
      priorityScore: 32,
      createdAt: "2026-06-23T11:15:00Z"
    }
  ];

  // Load issues from backend
  useEffect(() => {
    async function loadRisingIssues() {
      setLoadingIssues(true);
      const res = await getRisingIssues(20);
      if (res && res.success && res.data && res.data.issues) {
        setApiIssues(res.data.issues);
      }
      setLoadingIssues(false);
    }
    loadRisingIssues();
  }, []);

  // Display issues list (API + Hardcoded so there are always cards)
  const allIssues = [...apiIssues, ...hardcodedIssues];

  // Simple filtering logic
  const filteredIssues = allIssues.filter(issue => {
    if (activeFilter === "groups") {
      return issue.groupId !== "";
    }
    if (activeFilter === "public") {
      return !issue.groupId || issue.groupId === "public";
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-600/10">Critical</span>;
      case "high":
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-600/10">High</span>;
      case "medium":
        return <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/10">Medium</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-600/10">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">Reported</span>;
      case "verified":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Verified</span>;
      case "assigned":
        return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Assigned</span>;
      case "in_progress":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 animate-pulse">In Progress</span>;
      case "resolved":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Resolved</span>;
      case "confirmed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Confirmed</span>;
      case "closed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Closed</span>;
      case "disputed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Disputed</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">Reported</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] flex flex-col antialiased font-sans">
      {/* Container holding three-column layout */}
      <div className="w-full max-w-7xl mx-auto flex-grow flex shadow-xs min-h-screen bg-[#FAF9F6] border-x border-[#E5E0D8]">
        
        {/* ========================================================= */}
        {/* LEFT SIDEBAR (220px)                                      */}
        {/* ========================================================= */}
        <aside className="w-[220px] bg-[#FDFCFB] flex flex-col border-r border-[#E5E0D8] shrink-0 p-5 justify-between" id="left-sidebar">
          <div>
            {/* Header / Logo */}
            <div className="flex items-center gap-2 mb-8 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5A5A40] text-white font-extrabold text-lg">
                आ
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#5A5A40] uppercase">Awaaz</h1>
                <p className="text-[9px] text-[#A8A297] uppercase tracking-widest font-mono font-bold">Civic Voice</p>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1" aria-label="Main Navigation">
              <button 
                onClick={() => {
                  setActiveTab("feed");
                  setActiveGroupId(null);
                  setActiveIssueId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${["feed", "issue_detail", "report_issue"].includes(activeTab) ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <Flame className="h-4.5 w-4.5" />
                <span>Issue Feed</span>
              </button>
              <button 
                onClick={() => {
                  setActiveTab("nearby");
                  setActiveGroupId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${activeTab === "nearby" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <MapPin className="h-4.5 w-4.5" />
                <span>Nearby Issues</span>
              </button>
              <button 
                onClick={() => {
                  setActiveTab("groups");
                  setActiveGroupId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${activeTab === "groups" || activeTab === "group_detail" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <Users className="h-4.5 w-4.5" />
                <span>Communities</span>
              </button>
              <button 
                onClick={() => {
                  setActiveTab("reports");
                  setActiveGroupId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${activeTab === "reports" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>My Reports</span>
              </button>
              <button 
                onClick={() => {
                  setActiveTab("notifications");
                  setActiveGroupId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${activeTab === "notifications" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <Bell className="h-4.5 w-4.5" />
                <span>Notifications</span>
              </button>
            </nav>

            {/* Groups Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#A8A297]">My Groups</span>
                <span className="text-[10px] font-mono text-[#5A5A40] bg-[#F5F5F0] px-1.5 py-0.5 rounded-full font-bold">
                  {joinedGroups.length}
                </span>
              </div>
              
              {loadingGroups ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-[#5A5A40]/70" />
                </div>
              ) : joinedGroups.length === 0 ? (
                <div className="px-2 py-1 space-y-2.5">
                  <p className="text-[11px] text-[#A8A297] italic leading-normal">
                    You haven't joined any communities yet.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => {
                        setActiveTab("groups");
                        setActiveGroupId(null);
                      }}
                      id="btn-sidebar-browse-communities"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white border border-[#E5E0D8] text-[#5A5A40] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>Browse Communities</span>
                    </button>
                    <button
                      onClick={() => setIsAppCreateModalOpen(true)}
                      id="btn-sidebar-create-community"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[#5A5A40] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Community</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-1 text-xs" aria-label="Joined Groups">
                    {joinedGroups.map((g, idx) => {
                      const bulletColors = ["bg-[#8A8A6F]", "bg-[#A37B5C]", "bg-[#6B8E8E]", "bg-[#B38F75]", "bg-[#7B8B7B]"];
                      const isCurrent = activeTab === "group_detail" && activeGroupId === g.id;
                      return (
                        <li key={g.id}>
                          <button 
                            onClick={() => {
                              setActiveGroupId(g.id);
                              setActiveTab("group_detail");
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors font-medium cursor-pointer ${
                              isCurrent ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#4A4A3A] hover:bg-[#F5F5F0]"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${bulletColors[idx % bulletColors.length]}`}></div>
                            <span className="truncate">{g.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  
                  {/* Small separator beneath the list */}
                  <div className="border-t border-[#E5E0D8]/60 my-2 pt-2 space-y-1.5 px-1">
                    <button
                      onClick={() => {
                        setActiveTab("groups");
                        setActiveGroupId(null);
                      }}
                      id="btn-sidebar-browse-communities-joined"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white border border-[#E5E0D8] text-[#5A5A40] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>Browse Communities</span>
                    </button>
                    <button
                      onClick={() => setIsAppCreateModalOpen(true)}
                      id="btn-sidebar-create-community-joined"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-[#FAF9F6] border border-[#E5E0D8] text-[#5A5A40] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Community</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Profile Info at Bottom */}
          <div className="border-t border-[#E5E0D8] pt-4 mt-auto bg-[#F9F8F5] -mx-5 -mb-5 p-5">
            <div className="flex items-center gap-3 mb-3">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="h-9 w-9 rounded-full border-2 border-white shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5E0D8] text-[#5A5A40] border-2 border-white shadow-xs font-semibold text-xs">
                  {user?.displayName?.[0] || "C"}
                </div>
              )}
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-semibold truncate text-[#1A1A1A]">{user?.displayName || "Citizen"}</p>
                <p className="text-[10px] text-[#A8A297] uppercase tracking-wider font-bold">Pro Contributor</p>
              </div>
            </div>
            
            <button 
              onClick={() => logout()}
              className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* CENTER FEED / DYNAMIC PAGE VIEW                           */}
        {/* ========================================================= */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#FAF9F6]" id="center-feed">
          {activeTab === "groups" ? (
            <GroupsPage
              joinedGroupIds={joinedGroups.map(g => g.id)}
              onJoinGroup={handleJoinGroupAtAppLevel}
              onViewGroup={(id) => {
                setActiveGroupId(id);
                setActiveTab("group_detail");
              }}
              onCreateGroup={async (newGroupId) => {
                if (refreshUser) {
                  await refreshUser();
                }
                await loadJoinedGroups();
              }}
            />
          ) : activeTab === "group_detail" && activeGroupId ? (
            <GroupDetailPage
              groupId={activeGroupId}
              joinedGroupIds={joinedGroups.map(g => g.id)}
              onJoinGroup={handleJoinGroupAtAppLevel}
              onBack={() => {
                setActiveTab("groups");
                setActiveGroupId(null);
              }}
              onReportIssue={(groupId) => {
                setActiveGroupId(groupId);
                setActiveTab("report_issue");
              }}
            />
          ) : activeTab === "report_issue" ? (
            <ReportIssue
              joinedGroups={joinedGroups}
              initialGroupId={activeGroupId}
              onSuccess={(newIssue) => {
                setToast({
                  message: `Civic issue filed successfully! Deterministic Priority Score: ${newIssue.priorityScore}`,
                  type: "success"
                });
                setActiveIssueId(newIssue.id);
                setActiveTab("issue_detail");
              }}
              onCancel={() => {
                if (activeGroupId) {
                  setActiveTab("group_detail");
                } else {
                  setActiveTab("feed");
                }
              }}
            />
          ) : activeTab === "issue_detail" && activeIssueId ? (
            <IssueDetail
              issueId={activeIssueId}
              onBack={() => {
                setActiveTab("feed");
                setActiveIssueId(null);
              }}
              onViewGroup={(id) => {
                setActiveGroupId(id);
                setActiveTab("group_detail");
              }}
            />
          ) : activeTab === "nearby" ? (
            <NearbyIssues />
          ) : activeTab === "reports" ? (
            <MyReports 
              onViewIssue={(issueId) => {
                setActiveIssueId(issueId);
                setActiveTab("issue_detail");
              }}
            />
          ) : activeTab === "notifications" ? (
            <NotificationsPage />
          ) : (
            <IssuesFeed
              joinedGroups={joinedGroups}
              onViewIssue={(issueId) => {
                setActiveIssueId(issueId);
                setActiveTab("issue_detail");
              }}
              onReportIssue={(groupId) => {
                setActiveGroupId(groupId);
                setActiveTab("report_issue");
              }}
              initialGroupId={activeGroupId}
            />
          )}
        </main>

        {/* ========================================================= */}
        {/* RIGHT SIDEBAR (260px)                                     */}
        {/* ========================================================= */}
        <aside className="w-[260px] bg-[#FDFCFB] border-l border-[#E5E0D8] shrink-0 p-6 flex flex-col gap-6" id="right-sidebar">
          {/* Active Statistics */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#A8A297] mb-4">Community Pulse</h3>
              <div className="bg-[#F5F5F0] rounded-2xl p-4 border border-[#E5E0D8]">
                <div className="mb-3">
                  <p className="text-3xl font-extrabold text-[#5A5A40] font-serif">142</p>
                  <p className="text-[11px] text-[#7A756D] font-medium">Issues resolved this week</p>
                </div>
                <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-[#E5E0D8]">
                  <div className="bg-[#5A5A40] h-full rounded-full" style={{ width: "65%" }}></div>
                </div>
                <p className="text-[10px] text-[#A8A297] mt-2 font-medium">+12% from last week</p>
              </div>
            </section>

            {/* Recent Activity Feed Placeholders */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#A8A297] mb-4">Recent Activity</h3>
              <div className="space-y-4" aria-label="Recent local activity updates">
                
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A37B5C] mt-2 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#4A4A3A] leading-relaxed">
                      <span className="font-bold text-[#1A1A1A]">MCD North</span> marked <span className="text-[#5A5A40] underline font-medium">Road Repair #443</span> as resolved.
                    </p>
                    <span className="text-[10px] text-[#A8A297] font-medium">2 hours ago</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40] mt-2 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#4A4A3A] leading-relaxed">
                      <span className="font-bold text-[#1A1A1A]">Truth Engine</span> verified resolution proof photos for <span className="italic">Waterlogging Issue</span>.
                    </p>
                    <span className="text-[10px] text-[#A8A297] font-medium">4 hours ago</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A37B5C] mt-2 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#4A4A3A] leading-relaxed">
                      <span className="font-bold text-[#1A1A1A]">Rajesh K.</span> and 14 others endorsed <span className="text-[#5A5A40] underline font-medium">Garbage issue</span>.
                    </p>
                    <span className="text-[10px] text-[#A8A297] font-medium">Yesterday</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A37B5C] mt-2 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#4A4A3A] leading-relaxed">
                      <span className="font-bold text-[#1A1A1A]">Rohan Das</span> joined Indiranagar Civic Forum.
                    </p>
                    <span className="text-[10px] text-[#A8A297] font-medium">3 days ago</span>
                  </div>
                </div>

              </div>
            </section>

            <section className="pt-2">
              <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div className="text-xs font-bold text-[#7A756D]">Active Citizens</div>
                <div className="flex -space-x-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#E5E0D8] border border-white"></div>
                  <div className="w-6 h-6 rounded-full bg-[#D5D0C8] border border-white"></div>
                  <div className="w-6 h-6 rounded-full bg-[#C5C0B8] border border-white"></div>
                  <div className="w-6 h-6 rounded-full bg-[#5A5A40] border border-white flex items-center justify-center text-[8px] text-white font-bold">+18</div>
                </div>
              </div>
            </section>
          </div>

          {/* Proving Resolution Banner */}
          <div className="mt-auto rounded-2xl bg-[#5A5A40] text-slate-100 p-4 border border-[#E5E0D8]/20 relative overflow-hidden shadow-sm">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
              <Shield className="h-24 w-24 text-white" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 text-[#F5F5F0]">
              <Layers className="h-3.5 w-3.5 text-[#FAF9F6]" />
              <span>Durable Truth</span>
            </h4>
            <p className="text-[11px] text-[#E5E0D8] leading-relaxed font-medium">
              Every status change runs through a 3-tier validation (Admin photo proof, AI verification, and Community confirmations).
            </p>
          </div>
        </aside>

      </div>

      {/* Create Community Modal at App level */}
      <CreateGroupModal
        isOpen={isAppCreateModalOpen}
        onClose={() => setIsAppCreateModalOpen(false)}
        onSuccess={handleAppCreateSuccess}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-2xl shadow-xl border text-xs font-semibold animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200/60 animate-bounce-subtle" 
              : "bg-rose-50 text-rose-800 border-rose-200/60"
          }`}
          id="app-global-toast"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"} shrink-0 animate-pulse`}></div>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
