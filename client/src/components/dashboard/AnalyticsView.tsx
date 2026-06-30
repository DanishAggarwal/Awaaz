import React from "react";
import { motion } from "motion/react";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  ArrowUpRight, 
  Layers, 
  Users,
  Copy,
  FolderDot
} from "lucide-react";

interface Scope {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface AnalyticsViewProps {
  issues: any[];
  loading: boolean;
  selectedScope: Scope | null;
}

export default function AnalyticsView({ issues, loading, selectedScope }: AnalyticsViewProps) {
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></span>
        <p className="text-xs text-[#7A756D] font-medium animate-pulse">Compiling database analytics...</p>
      </div>
    );
  }

  // --- 1. Issue Status Distribution ---
  const statusCounts = {
    reported: 0,
    in_progress: 0,
    resolved: 0,
    reopened: 0,
  };

  issues.forEach((i) => {
    const status = i.status || "reported";
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    } else {
      statusCounts.reported++;
    }
  });

  const totalIssues = issues.length;

  // --- 2. Issue Categories ---
  const categoryCounts: Record<string, number> = {};
  issues.forEach((i) => {
    const cat = i.category || "General";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const sortedCategories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // --- 3. Priority Distribution ---
  let highPriority = 0;
  let medPriority = 0;
  let lowPriority = 0;

  issues.forEach((i) => {
    const score = i.priorityScore || 0;
    if (score >= 80) highPriority++;
    else if (score >= 40) medPriority++;
    else lowPriority++;
  });

  // --- 4. Community vs Public Issues ---
  let publicIssues = 0;
  let communityIssues = 0;

  issues.forEach((i) => {
    if (i.visibility === "public" || i.groupId === "awaaz_public") {
      publicIssues++;
    } else {
      communityIssues++;
    }
  });

  // --- 5. Duplicate Statistics ---
  let totalDuplicatesSupported = 0;
  issues.forEach((i) => {
    const dupCount = i.duplicateReports ?? i.dna?.duplicateReports ?? i.duplicateCount ?? 0;
    totalDuplicatesSupported += dupCount;
  });

  // --- 6. Average Resolution Time ---
  const resolvedIssues = issues.filter(i => i.status === "resolved" && i.resolution?.resolvedAt);
  let avgResolutionTimeStr = "N/A";
  if (resolvedIssues.length > 0) {
    const totalMs = resolvedIssues.reduce((sum, i) => {
      const end = new Date(i.resolution.resolvedAt).getTime();
      const start = new Date(i.createdAt).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    const avgDays = (totalMs / resolvedIssues.length) / (1000 * 60 * 60 * 24);
    avgResolutionTimeStr = avgDays < 1 
      ? `${Math.round(avgDays * 24)} hours` 
      : `${avgDays.toFixed(1)} days`;
  }

  // --- 7. Reopen Statistics ---
  let totalReopenedCount = 0;
  let pendingReopenRequests = 0;
  issues.forEach((i) => {
    if (i.status === "reopened") {
      totalReopenedCount++;
    }
    if (i.reopenRequest?.status === "pending") {
      pendingReopenRequests++;
    }
  });

  // --- 8. Truth Verification Summary ---
  const truthSummary = {
    verified: 0,
    likelyVerified: 0,
    needsReview: 0,
    insufficientEvidence: 0,
    pending: 0,
  };

  issues.forEach((i) => {
    if (!i.truthAnalysis) {
      truthSummary.pending++;
    } else {
      const status = i.truthAnalysis.verificationStatus;
      if (status === "Verified") truthSummary.verified++;
      else if (status === "Likely Verified") truthSummary.likelyVerified++;
      else if (status === "Needs Review") truthSummary.needsReview++;
      else if (status === "Insufficient Evidence") truthSummary.insufficientEvidence++;
      else truthSummary.needsReview++;
    }
  });

  // --- 9. Recent Activity ---
  const recentIssues = [...issues]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getPercentage = (value: number) => {
    if (totalIssues === 0) return 0;
    return Math.round((value / totalIssues) * 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300" id="analytics-dashboard-view">
      {/* Overview header */}
      <section className="bg-[#F5F5F0] border border-[#E5E0D8] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" id="analytics-welcome-hero">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#5A5A40]" />
            <h2 className="text-2xl font-extrabold font-serif text-[#5A5A40] tracking-tight">
              Operational Analytics
            </h2>
          </div>
          <p className="text-xs text-[#7A756D]">
            Live analytical dashboard representing historical trends and real-time metrics for <strong className="text-[#4A4A3A] font-bold">{selectedScope?.name}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E5E0D8]/80 rounded-xl px-3.5 py-1.5 shrink-0 text-xs font-semibold text-[#5A5A40]">
          <Layers className="h-3.5 w-3.5 text-[#5A5A40]" />
          <span>{totalIssues} Total Issues Analyzed</span>
        </div>
      </section>

      {totalIssues === 0 ? (
        <div className="bg-[#FDFCFB] rounded-3xl border border-[#E5E0D8] p-12 text-center max-w-md mx-auto my-12 shadow-xs">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-[#1A1A1A]">No Data to Analyze</h3>
          <p className="text-xs text-[#7A756D] mt-2 leading-relaxed">
            There are currently no civic reports registered in this scope. Once issues are submitted, full-fidelity analytics will generate here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics-grid">
          
          {/* Column 1: Statuses & Priorities */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Status Distribution */}
            <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E0D8]/60 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D]">Issue Status Distribution</h3>
                <span className="text-[10px] font-mono text-[#A8A297] font-semibold">Active & Historic</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Reported", count: statusCounts.reported, color: "bg-amber-500", text: "text-amber-800" },
                  { label: "In Progress", count: statusCounts.in_progress, color: "bg-sky-500", text: "text-sky-800" },
                  { label: "Resolved", count: statusCounts.resolved, color: "bg-emerald-500", text: "text-emerald-800" },
                  { label: "Reopened", count: statusCounts.reopened, color: "bg-rose-500", text: "text-rose-800" },
                ].map((st) => {
                  const pct = getPercentage(st.count);
                  return (
                    <div key={st.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#4A4A3A]">{st.label}</span>
                        <span className="text-[#7A756D]">{st.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${st.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid for Priority and Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Priority Distribution */}
              <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] border-b border-[#E5E0D8]/60 pb-3">Priority Distribution</h3>
                <div className="flex items-center justify-around py-4">
                  {[
                    { label: "High (≥80)", count: highPriority, color: "text-rose-600 bg-rose-50 border-rose-100" },
                    { label: "Medium", count: medPriority, color: "text-amber-700 bg-amber-50 border-amber-100" },
                    { label: "Low", count: lowPriority, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                  ].map((p) => {
                    const pct = getPercentage(p.count);
                    return (
                      <div key={p.label} className="text-center space-y-1">
                        <div className={`h-12 w-12 rounded-full border flex items-center justify-center text-xs font-bold ${p.color} mx-auto`}>
                          {pct}%
                        </div>
                        <span className="text-[10px] font-bold text-[#7A756D] block">{p.label}</span>
                        <span className="text-xs font-extrabold text-[#1A1A1A] block">{p.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Community vs Public */}
              <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] border-b border-[#E5E0D8]/60 pb-3">Visibility Profile</h3>
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#7A756D] flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-[#5A5A40]" /> Public Issues
                    </span>
                    <span className="font-extrabold text-[#1A1A1A]">{publicIssues}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#7A756D] flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-[#A37B5C]" /> Community Group Issues
                    </span>
                    <span className="font-extrabold text-[#1A1A1A]">{communityIssues}</span>
                  </div>
                  
                  {/* Visual ratio bar */}
                  <div className="h-3 w-full bg-[#FAF9F6] border border-[#E5E0D8]/50 rounded-lg overflow-hidden flex">
                    <div className="bg-[#5A5A40] h-full" style={{ width: `${getPercentage(publicIssues)}%` }} title="Public" />
                    <div className="bg-[#A37B5C] h-full" style={{ width: `${getPercentage(communityIssues)}%` }} title="Community" />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono font-bold text-[#A8A297]">
                    <span>Public: {getPercentage(publicIssues)}%</span>
                    <span>Community: {getPercentage(communityIssues)}%</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Categories Distribution */}
            <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] border-b border-[#E5E0D8]/60 pb-3">Dominant Categories</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedCategories.slice(0, 6).map((cat, index) => {
                  const pct = getPercentage(cat.count);
                  return (
                    <div key={cat.name} className="bg-[#FAF9F6] border border-[#E5E0D8]/50 rounded-xl p-3 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono font-bold text-[#7A756D] uppercase">RANK #{index + 1}</span>
                        <h4 className="text-xs font-extrabold text-[#1A1A1A]">{cat.name}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-[#5A5A40] block">{cat.count} issues</span>
                        <span className="text-[10px] font-mono text-[#A8A297]">{pct}% share</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Column 2: Truth Audit, Performance, and Recent Feed */}
          <div className="space-y-6">
            
            {/* Truth Engine Auditing Performance */}
            <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E0D8]/60 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D]">Truth Verification</h3>
                <Sparkles className="h-4 w-4 text-[#5A5A40]" />
              </div>
              <div className="space-y-3">
                {[
                  { label: "Verified (Absolute)", count: truthSummary.verified, color: "text-emerald-700 bg-emerald-50" },
                  { label: "Likely Verified", count: truthSummary.likelyVerified, color: "text-sky-700 bg-sky-50" },
                  { label: "Needs Audit/Review", count: truthSummary.needsReview, color: "text-amber-700 bg-amber-50" },
                  { label: "Insufficient Evidence", count: truthSummary.insufficientEvidence, color: "text-rose-700 bg-rose-50" },
                  { label: "Audit Unperformed", count: truthSummary.pending, color: "text-[#7A756D] bg-[#FAF9F6]" },
                ].map((truth) => {
                  const pct = getPercentage(truth.count);
                  return (
                    <div key={truth.label} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#7A756D]">{truth.label}</span>
                      <span className={`px-2 py-0.5 rounded-md font-extrabold font-mono text-[10px] ${truth.color}`}>
                        {truth.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance metrics */}
            <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] border-b border-[#E5E0D8]/60 pb-3">Administrative SLA</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-xl p-3 text-center">
                  <Clock className="h-5 w-5 text-[#5A5A40] mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-[#A8A297] uppercase">Avg Resolution</span>
                  <p className="text-sm font-extrabold text-[#4A4A3A] mt-0.5">{avgResolutionTimeStr}</p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-xl p-3 text-center">
                  <Copy className="h-5 w-5 text-[#A37B5C] mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-[#A8A297] uppercase">Duplicates</span>
                  <p className="text-sm font-extrabold text-[#4A4A3A] mt-0.5">{totalDuplicatesSupported}</p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-xl p-3 text-center">
                  <AlertTriangle className="h-5 w-5 text-rose-600 mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-[#A8A297] uppercase">Reopen Events</span>
                  <p className="text-sm font-extrabold text-[#4A4A3A] mt-0.5">{totalReopenedCount}</p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-xl p-3 text-center">
                  <HelpCircle className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
                  <span className="text-[9px] font-bold text-[#A8A297] uppercase">Pending Reopen</span>
                  <p className="text-sm font-extrabold text-[#4A4A3A] mt-0.5">{pendingReopenRequests}</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A756D] border-b border-[#E5E0D8]/60 pb-3">Recent Reports</h3>
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {recentIssues.map((issue) => (
                  <div key={issue.id} className="flex items-start justify-between gap-2.5 text-xs border-b border-[#F5F5F0] pb-3 last:border-b-0 last:pb-0">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[9px] font-mono text-[#A8A297] font-semibold">{issue.category}</span>
                      <h4 className="font-extrabold text-[#1A1A1A] truncate">{issue.title}</h4>
                      <p className="text-[10px] text-[#7A756D]">{new Date(issue.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono shrink-0 ${
                      issue.status === "resolved" 
                        ? "bg-emerald-50 text-emerald-800" 
                        : issue.status === "in_progress"
                        ? "bg-sky-50 text-sky-800"
                        : "bg-amber-50 text-amber-800"
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
