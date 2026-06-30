import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPermissions, getIssues } from "../api";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import DashboardCard from "../components/dashboard/DashboardCard";
import IssueManagement from "../components/dashboard/IssueManagement";
import AnalyticsView from "../components/dashboard/AnalyticsView";
import { 
  AlertCircle, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Shield,
  Loader2,
  Lock,
  ArrowRight,
  TrendingUp,
  BarChart3
} from "lucide-react";

interface Scope {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface OperationsDashboardProps {
  onBackToCitizenFeed: () => void;
}

export default function OperationsDashboard({
  onBackToCitizenFeed
}: OperationsDashboardProps) {
  const { user, logout } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);
  const [currentSection, setCurrentSection] = useState("dashboard");
  
  // Dynamic issues state
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Load permissions and scopes on mount
  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      try {
        setLoading(true);
        const res = await getPermissions();
        
        if (!active) return;

        if (res && res.success && res.data) {
          const { canAccessOperationalTools, managedScopesDetails } = res.data;
          
          if (!canAccessOperationalTools || !managedScopesDetails || managedScopesDetails.length === 0) {
            setAuthorized(false);
            // Delay redirect slightly so user gets a brief flash/notice or seamless routing
            onBackToCitizenFeed();
          } else {
            setAuthorized(true);
            setScopes(managedScopesDetails);

            // Restore previously selected scope from localStorage if valid
            const savedScopeId = localStorage.getItem("awaaz_selected_scope_id");
            const matchedScope = managedScopesDetails.find((s: Scope) => s.id === savedScopeId);
            
            if (matchedScope) {
              setSelectedScope(matchedScope);
            } else {
              // Default to the first managed scope
              setSelectedScope(managedScopesDetails[0]);
              localStorage.setItem("awaaz_selected_scope_id", managedScopesDetails[0].id);
            }
          }
        } else {
          setAuthorized(false);
          onBackToCitizenFeed();
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
        if (active) {
          setAuthorized(false);
          onBackToCitizenFeed();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      active = false;
    };
  }, [onBackToCitizenFeed]);

  // Load issues list based on scope
  const loadDashboardData = async () => {
    if (!selectedScope) return;
    try {
      setIssuesLoading(true);
      setIssuesError(null);
      const res = await getIssues({ groupId: selectedScope.id });
      if (res && res.success && res.data) {
        setIssues(res.data.issues || []);
      } else {
        setIssuesError(res?.error || "Failed to load dashboard data.");
      }
    } catch (err: any) {
      console.error("Error loading dashboard issues:", err);
      setIssuesError(err.message || "An error occurred.");
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedScope) {
      loadDashboardData();
    }
  }, [selectedScope]);

  // Handle scope modification
  const handleScopeChange = (scope: Scope) => {
    setSelectedScope(scope);
    localStorage.setItem("awaaz_selected_scope_id", scope.id);
  };

  // Synchronize URL path and currentSection
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/dashboard/issues") {
      setCurrentSection("issues");
    } else if (path === "/dashboard/analytics") {
      setCurrentSection("analytics");
    } else {
      setCurrentSection("dashboard");
    }
  }, []);

  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
    let newPath = "/dashboard";
    if (section !== "dashboard") {
      newPath = `/dashboard/${section}`;
    }
    window.history.pushState(null, "", newPath);
    if (section === "dashboard" || section === "analytics") {
      loadDashboardData();
    }
  };

  // Safe logout wrapper
  const handleLogout = async () => {
    try {
      await logout();
      onBackToCitizenFeed();
    } catch (err) {
      console.error("Dashboard logout error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 antialiased" id="ops-loader-screen">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#5A5A40]" />
          <div>
            <h2 className="text-sm font-bold text-[#1A1A1A] tracking-tight">Authorizing Secure Session</h2>
            <p className="text-xs text-[#7A756D] mt-1">Retrieving civic jurisdiction permissions and metadata...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 antialiased" id="ops-denied-screen">
        <div className="bg-[#FDFCFB] rounded-3xl border border-[#E5E0D8] p-8 max-w-md w-full shadow-lg text-center flex flex-col items-center gap-6">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A] tracking-tight">Access Denied</h2>
            <p className="text-xs text-[#7A756D] mt-2 leading-relaxed">
              Your citizen account does not have municipal or community administrative privileges. Returning you to the community feed.
            </p>
          </div>
          <button
            onClick={onBackToCitizenFeed}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#5A5A40] text-white hover:bg-[#4A4A30] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
          >
            <span>Return to Feed</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Section placeholder router
  const renderContent = () => {
    if (currentSection === "issues") {
      return <IssueManagement selectedScope={selectedScope} />;
    }

    if (currentSection === "analytics") {
      return (
        <AnalyticsView 
          issues={issues} 
          loading={issuesLoading} 
          selectedScope={selectedScope} 
        />
      );
    }

    const isAdminType = selectedScope?.id === "awaaz_public" || selectedScope?.type === "system" 
      ? "Municipal Administrator" 
      : "Community Administrator";

    // Metrics calculations
    const openCount = issues.filter(i => i.status !== "resolved").length;
    const highPriorityCount = issues.filter(i => i.priorityScore >= 80).length;
    const inProgressCount = issues.filter(i => i.status === "in_progress").length;
    const resolvedCount = issues.filter(i => i.status === "resolved").length;

    // AI insights metrics
    const avgConfidence = issues.length > 0
      ? (issues.reduce((sum, i) => sum + (i.confidence || 0), 0) / issues.length)
      : 0;

    const categoryCounts: Record<string, number> = {};
    issues.forEach(i => {
      const cat = i.category || "General";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    // Dashboard Home View
    return (
      <div className="space-y-8 animate-in fade-in duration-300" id="admin-dashboard-home">
        {/* Compact Welcome / Hero Section */}
        <section className="bg-[#F5F5F0] border border-[#E5E0D8] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" id="dashboard-welcome-hero">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold font-serif text-[#5A5A40] tracking-tight">
              Admin Dashboard
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#7A756D]">
              <span>Managing:</span>
              <span className="font-bold text-[#4A4A3A]">{selectedScope?.name}</span>
              <span className="text-[#A8A297]">•</span>
              <span className="font-semibold text-[#5A5A40]">{isAdminType}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-[#E5E0D8]/80 rounded-xl px-3.5 py-1.5 shrink-0 text-xs font-semibold text-[#5A5A40]">
            <Shield className="h-3.5 w-3.5 text-[#5A5A40]" />
            <span className="capitalize">{selectedScope?.type || "neighborhood"} Scope</span>
          </div>
        </section>

        {/* Overview */}
        <section id="dashboard-overview-section">
          <div className="flex items-center justify-between gap-4 mb-5 border-b border-[#E5E0D8]/60 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D]">
                Overview
              </h3>
              <p className="text-[11px] text-[#A8A297] mt-0.5">Summary of reports requiring response in this scope</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard
              title="Open Issues"
              value={issuesLoading ? "--" : String(openCount)}
              subtitle="Active unresolved reports"
              icon={AlertCircle}
            />
            <DashboardCard
              title="High Priority"
              value={issuesLoading ? "--" : String(highPriorityCount)}
              subtitle="Priority score above 80"
              icon={Flame}
            />
            <DashboardCard
              title="In Progress"
              value={issuesLoading ? "--" : String(inProgressCount)}
              subtitle="Currently being resolved"
              icon={Clock}
            />
            <DashboardCard
              title="Resolved"
              value={issuesLoading ? "--" : String(resolvedCount)}
              subtitle="Closed issues count"
              icon={CheckCircle2}
            />
          </div>
        </section>

        {/* Real Dynamic AI Insights Panel */}
        <section id="dashboard-ai-roadmap-section">
          <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">
                  AI-Assisted Operations & Priority Insights
                </h3>
              </div>
              <p className="text-xs text-[#7A756D] max-w-2xl leading-relaxed">
                Telemetry analyses and category trends are calculated directly from active citizen reports. The Case Ingestion engine has recorded an average ingestion confidence of <strong className="text-[#4A4A3A]">{(avgConfidence * 100).toFixed(0)}%</strong>, with the primary civic hotspot currently identified as <strong className="text-[#4A4A3A]">{topCategory}</strong>.
              </p>
            </div>
            
            <div className="flex gap-4 self-stretch sm:self-auto shrink-0 font-mono text-[10px]">
              <div className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-center min-w-[110px] flex flex-col justify-center">
                <span className="text-[#A8A297] font-bold uppercase tracking-wider block mb-1">Confidence</span>
                <span className="text-[#4A4A3A] text-lg font-black block">{(avgConfidence * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 text-center min-w-[110px] flex flex-col justify-center">
                <span className="text-[#A8A297] font-bold uppercase tracking-wider block mb-1">Top Vector</span>
                <span className="text-[#4A4A3A] text-xs font-black block truncate max-w-[90px]">{topCategory}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <DashboardLayout
      user={user}
      logout={handleLogout}
      scopes={scopes}
      selectedScope={selectedScope}
      onScopeChange={handleScopeChange}
      currentSection={currentSection}
      onSectionChange={handleSectionChange}
      onBackToCitizenApp={onBackToCitizenFeed}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
