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
  Layers
} from "lucide-react";
import { getRisingIssues } from "./api";

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
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"feed" | "nearby" | "reports" | "notifications">("feed");
  const [activeFilter, setActiveFilter] = useState<"all" | "groups" | "public">("all");
  const [apiIssues, setApiIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

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
                onClick={() => setActiveTab("feed")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === "feed" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <Flame className="h-4.5 w-4.5" />
                <span>Issue Feed</span>
              </button>
              <button 
                onClick={() => setActiveTab("nearby")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === "nearby" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <MapPin className="h-4.5 w-4.5" />
                <span>Nearby Issues</span>
              </button>
              <button 
                onClick={() => setActiveTab("reports")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === "reports" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>My Reports</span>
              </button>
              <button 
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === "notifications" ? "bg-[#F5F5F0] text-[#5A5A40]" : "text-[#7A756D] hover:bg-[#F5F5F0]/60 hover:text-[#5A5A40]"}`}
              >
                <Bell className="h-4.5 w-4.5" />
                <span>Notifications</span>
              </button>
            </nav>

            {/* Groups Section with Placeholders */}
            <div className="mt-8">
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#A8A297]">My Groups</span>
                <span className="text-[10px] font-mono text-[#5A5A40] bg-[#F5F5F0] px-1.5 py-0.5 rounded-full font-bold">3</span>
              </div>
              <ul className="space-y-1 text-xs" aria-label="Joined Groups">
                <li>
                  <button className="w-full text-left px-3 py-2 text-[#4A4A3A] hover:bg-[#F5F5F0] rounded-lg flex items-center gap-2.5 transition-colors font-medium">
                    <div className="w-2 h-2 rounded-full bg-[#8A8A6F] shrink-0"></div>
                    <span className="truncate">Sector 12 RWA</span>
                  </button>
                </li>
                <li>
                  <button className="w-full text-left px-3 py-2 text-[#4A4A3A] hover:bg-[#F5F5F0] rounded-lg flex items-center gap-2.5 transition-colors font-medium">
                    <div className="w-2 h-2 rounded-full bg-[#A37B5C] shrink-0"></div>
                    <span className="truncate">Indiranagar Civic Forum</span>
                  </button>
                </li>
                <li>
                  <button className="w-full text-left px-3 py-2 text-[#4A4A3A] hover:bg-[#F5F5F0] rounded-lg flex items-center gap-2.5 transition-colors font-medium">
                    <div className="w-2 h-2 rounded-full bg-[#6B8E8E] shrink-0"></div>
                    <span className="truncate">Road Safety Initiative</span>
                  </button>
                </li>
              </ul>
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
        {/* CENTER FEED                                               */}
        {/* ========================================================= */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#FAF9F6]" id="center-feed">
          {/* Feed Header */}
          <header className="border-b border-[#E5E0D8] bg-white/80 backdrop-blur-md p-5 sticky top-0 z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif">Awaaz Feed</h2>
              <p className="text-xs text-[#7A756D]">Hyperpure community-verified civic complaints</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-1.5 bg-[#F5F5F0] p-1 rounded-full border border-[#E5E0D8]">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${activeFilter === "all" ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#7A756D] hover:text-[#5A5A40]"}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("groups")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${activeFilter === "groups" ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#7A756D] hover:text-[#5A5A40]"}`}
              >
                My Groups
              </button>
              <button
                onClick={() => setActiveFilter("public")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${activeFilter === "public" ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#7A756D] hover:text-[#5A5A40]"}`}
              >
                Public
              </button>
            </div>
          </header>

          {/* Issue Cards Feed */}
          <section className="p-6 space-y-6 overflow-y-auto flex-grow font-sans" aria-label="Civic Issues list">
            {loadingIssues ? (
              <div className="flex justify-center py-12">
                <span className="text-[#7A756D] text-sm flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-[#5A5A40] border-t-transparent animate-spin"></span>
                  Retrieving live signal issues...
                </span>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#E5E0D8] p-6">
                <AlertTriangle className="h-8 w-8 mx-auto text-[#A8A297] mb-2" />
                <p className="text-sm font-semibold text-[#7A756D]">No issues match this filter</p>
                <p className="text-xs text-[#A8A297] mt-1">Be the first to file an issue for your locality!</p>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <article
                  key={issue.id}
                  className="rounded-2xl border border-[#E5E0D8] bg-white p-6 hover:border-[#5A5A40]/30 transition-all shadow-xs relative"
                >
                  {/* Category, Status & Priority Score Row */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-[#F5F5F0] px-2.5 py-1 text-xs font-bold text-[#5A5A40] uppercase tracking-wider font-mono border border-[#E5E0D8]">
                        {issue.aiCategory}
                      </span>
                      {getSeverityBadge(issue.aiSeverity)}
                      {getStatusBadge(issue.status)}
                    </div>
                    
                    {/* Priority score indicator with Flame */}
                    <div className="flex items-center gap-1.5 bg-[#FAF9F6] px-2.5 py-1 rounded-xl border border-[#E5E0D8] text-[#5A5A40]" title="Priority Score">
                      <Flame className="h-4 w-4 fill-[#A37B5C] text-[#A37B5C]" />
                      <span className="text-xs font-bold font-mono">{issue.priorityScore}</span>
                    </div>
                  </div>

                  {/* Group Name & Reporter Meta */}
                  <div className="text-xs text-[#A8A297] mb-3 flex items-center gap-2 flex-wrap font-medium">
                    <span className="font-bold text-[#5A5A40]">{issue.groupName || "Public Initiative"}</span>
                    <span>•</span>
                    <span>Reported by {issue.reporterName}</span>
                    <span>•</span>
                    <span>{new Date(issue.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}</span>
                  </div>

                  {/* Summary/Description */}
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2 font-serif tracking-tight leading-snug">
                    {issue.aiSummary}
                  </h3>
                  <p className="text-sm text-[#4A4A3A] leading-relaxed mb-4">
                    {issue.description}
                  </p>

                  {/* Address / Location Row */}
                  <div className="flex items-center gap-1.5 text-xs text-[#7A756D] mb-5 bg-[#FDFCFB] p-3 rounded-xl border border-[#E5E0D8]">
                    <MapPin className="h-3.5 w-3.5 text-[#A8A297] shrink-0" />
                    <span className="truncate">{issue.location.address}</span>
                  </div>

                  {/* Action/Interactions Row */}
                  <div className="flex items-center justify-between border-t border-[#F5F5F0] pt-4 text-xs">
                    <div className="flex items-center gap-4">
                      <button className="flex items-center gap-1.5 text-[#7A756D] hover:text-[#5A5A40] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#F5F5F0] transition-colors">
                        <ThumbsUp className="h-4 w-4" />
                        <span>Endorse ({issue.endorsementCount})</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-[#7A756D] hover:text-[#5A5A40] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#F5F5F0] transition-colors">
                        <MessageSquare className="h-4 w-4" />
                        <span>Discuss</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#A37B5C] font-semibold bg-[#F5F5F0]/40 px-2.5 py-1 rounded-md border border-[#E5E0D8]/40">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Issue DNA Audit</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
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
    </div>
  );
}
