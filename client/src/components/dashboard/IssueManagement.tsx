import React, { useState, useEffect } from "react";
import { 
  getIssues, 
  updateIssueStatus, 
  getComments, 
  createComment 
} from "../../api";
import { 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  Users, 
  ThumbsUp, 
  Calendar, 
  MapPin, 
  User, 
  Image as ImageIcon, 
  Send, 
  X, 
  ShieldAlert, 
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Sparkles,
  Info,
  CheckCircle,
  PlayCircle
} from "lucide-react";

interface Scope {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface IssueManagementProps {
  selectedScope: Scope | null;
}

export default function IssueManagement({ selectedScope }: IssueManagementProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "date" | "endorsements">("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected Issue for Drawer
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Status Change Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    issueId: string;
    newStatus: string;
    issueTitle: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Load issues for the current scope
  useEffect(() => {
    if (!selectedScope) return;

    async function loadIssues() {
      try {
        setLoading(true);
        setError(null);
        // Call backend API querying by the selected scope's group id
        const res = await getIssues({ groupId: selectedScope.id });
        if (res && res.success && res.data) {
          setIssues(res.data.issues || []);
        } else {
          setError(res?.error || "Failed to load issues for this scope.");
        }
      } catch (err: any) {
        console.error("Error fetching scope issues:", err);
        setError(err.message || "An unexpected error occurred while fetching issues.");
      } finally {
        setLoading(false);
      }
    }

    loadIssues();
    // Close drawer when scope changes
    setDrawerOpen(false);
    setSelectedIssueId(null);
    setSelectedIssue(null);
  }, [selectedScope]);

  // Load issue details & comments when selection changes
  useEffect(() => {
    if (!selectedIssueId) return;

    async function loadIssueDetails() {
      try {
        setIssueLoading(true);
        // We find the issue inside our loaded issues array to display immediately
        const matched = issues.find(i => i.id === selectedIssueId);
        if (matched) {
          setSelectedIssue(matched);
          setActiveImageIndex(0);
        }

        // Fetch fresh comments
        setCommentsLoading(true);
        const commentsRes = await getComments(selectedIssueId);
        if (commentsRes && commentsRes.success && commentsRes.data) {
          setComments(commentsRes.data.comments || []);
        }
      } catch (err) {
        console.error("Error loading issue comments:", err);
      } finally {
        setIssueLoading(false);
        setCommentsLoading(false);
      }
    }

    loadIssueDetails();
  }, [selectedIssueId, issues]);

  // Handle posting a comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId || !newCommentText.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const res = await createComment(selectedIssueId, { text: newCommentText.trim() });
      if (res && res.success && res.data) {
        setComments(prev => [res.data.comment, ...prev]);
        setNewCommentText("");
        // Update local issue comment count in parent state
        setIssues(prev => prev.map(issue => {
          if (issue.id === selectedIssueId) {
            return { ...issue, commentCount: (issue.commentCount || 0) + 1 };
          }
          return issue;
        }));
        // Update selectedIssue commentCount dynamically
        setSelectedIssue((prev: any) => prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null);
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Open confirmation modal for status changes
  const initiateStatusChange = (issueId: string, issueTitle: string, newStatus: string) => {
    setConfirmModal({
      isOpen: true,
      issueId,
      newStatus,
      issueTitle
    });
  };

  // Commit the status update to backend
  const commitStatusChange = async () => {
    if (!confirmModal) return;
    const { issueId, newStatus } = confirmModal;

    try {
      setUpdatingStatus(true);
      const res = await updateIssueStatus(issueId, newStatus);
      if (res && res.success) {
        // Update in parent issues state
        setIssues(prev => prev.map(issue => {
          if (issue.id === issueId) {
            return { ...issue, status: newStatus };
          }
          return issue;
        }));

        // Update selected issue details if open
        if (selectedIssue && selectedIssue.id === issueId) {
          setSelectedIssue((prev: any) => prev ? { ...prev, status: newStatus } : null);
        }

        // Close modal
        setConfirmModal(null);
      } else {
        alert(res?.error || "Failed to update issue status.");
      }
    } catch (err: any) {
      console.error("Error updating status:", err);
      alert(err.message || "An unexpected error occurred.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Format Helper for Dates
  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (e) {
      return dateString || "Recently";
    }
  };

  // Format Helper for Priority Label/Colors
  const getPriorityInfo = (score: number) => {
    if (score >= 80) return { label: "High", bg: "bg-red-50 text-red-700 border-red-100", text: "text-red-600" };
    if (score >= 40) return { label: "Medium", bg: "bg-amber-50 text-amber-700 border-amber-100", text: "text-amber-600" };
    return { label: "Low", bg: "bg-slate-50 text-slate-700 border-slate-100", text: "text-slate-500" };
  };

  // Format Helper for Status Badge
  const getStatusInfo = (status: string) => {
    const s = (status || "reported").toLowerCase();
    switch (s) {
      case "resolved":
        return { label: "Resolved", bg: "bg-emerald-50 text-emerald-800 border-emerald-100", icon: CheckCircle2 };
      case "in_progress":
        return { label: "In Progress", bg: "bg-blue-50 text-blue-800 border-blue-100", icon: Clock };
      case "verified":
        return { label: "Verified", bg: "bg-indigo-50 text-indigo-800 border-indigo-100", icon: CheckCircle };
      case "reported":
      default:
        return { label: "Reported", bg: "bg-rose-50 text-rose-800 border-rose-100", icon: AlertTriangle };
    }
  };

  // Client Side Search & Filter logic
  const filteredIssues = issues.filter(issue => {
    // 1. Search Query Match
    const matchesSearch = 
      (issue.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.category || "").toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Status Filter Match
    const matchesStatus = statusFilter === "all" || (issue.status || "reported") === statusFilter;

    // 3. Category Filter Match
    const matchesCategory = categoryFilter === "all" || (issue.category || "") === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Client Side Sorting logic
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    let factorA = 0;
    let factorB = 0;

    if (sortBy === "priority") {
      factorA = a.priorityScore || 0;
      factorB = b.priorityScore || 0;
    } else if (sortBy === "date") {
      factorA = new Date(a.createdAt || 0).getTime();
      factorB = new Date(b.createdAt || 0).getTime();
    } else if (sortBy === "endorsements") {
      factorA = a.endorsementCount || 0;
      factorB = b.endorsementCount || 0;
    }

    if (sortOrder === "desc") {
      return factorB - factorA;
    } else {
      return factorA - factorB;
    }
  });

  // Retrieve unique categories for filters
  const uniqueCategories = Array.from(new Set(issues.map(i => i.category).filter(Boolean)));

  const handleSortToggle = (type: "priority" | "date" | "endorsements") => {
    if (sortBy === type) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortOrder("desc"); // default descending for new sorting column
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="ops-issue-management-root">
      {/* Search and Filters Header */}
      <section className="bg-[#FDFCFB] border border-[#E5E0D8] rounded-2xl p-4 md:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-[#A8A297]">
              <Search className="h-4 w-4" />
            </span>
            <input 
              type="text" 
              placeholder="Search title, summary, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-[#5A5A40] transition-colors"
              id="search-issues-input"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center justify-end">
            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#4A4A3A] focus:outline-none cursor-pointer"
              aria-label="Filter by Status"
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Category Selector */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#4A4A3A] focus:outline-none cursor-pointer"
              aria-label="Filter by Category"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setSortOrder("desc");
              }}
              className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#4A4A3A] focus:outline-none cursor-pointer md:hidden"
              aria-label="Sort issues list"
            >
              <option value="priority">Sort by Priority</option>
              <option value="date">Sort by Date</option>
              <option value="endorsements">Sort by Endorsements</option>
            </select>
          </div>

        </div>
      </section>

      {/* Issues Table Workspace */}
      <section className="bg-white border border-[#E5E0D8] rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#5A5A40]" />
            <p className="text-xs text-[#7A756D] font-medium">Fetching scope issues...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 mx-auto mb-4">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[#1A1A1A]">Operational Error</h3>
            <p className="text-xs text-[#7A756D] mt-1 max-w-sm mx-auto">{error}</p>
          </div>
        ) : sortedIssues.length === 0 ? (
          <div className="py-24 text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-[#5A5A40]/5 border border-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] mx-auto mb-4">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[#1A1A1A]">Zero Issues Found</h3>
            <p className="text-xs text-[#7A756D] mt-1 max-w-sm mx-auto">
              No issues match your filters in this jurisdiction. Select a different filter or scope.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-label="Issue Queue">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#E5E0D8] text-[10px] font-bold uppercase tracking-wider text-[#7A756D]">
                  <th className="py-3 px-4">
                    <button 
                      onClick={() => handleSortToggle("priority")}
                      className="flex items-center gap-1 hover:text-[#5A5A40] font-bold uppercase"
                    >
                      <span>Priority</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">
                    <button 
                      onClick={() => handleSortToggle("endorsements")}
                      className="flex items-center gap-1 hover:text-[#5A5A40] font-bold uppercase"
                    >
                      <span>Endorsements</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Duplicate Reports</th>
                  <th className="py-3 px-4">
                    <button 
                      onClick={() => handleSortToggle("date")}
                      className="flex items-center gap-1 hover:text-[#5A5A40] font-bold uppercase"
                    >
                      <span>Created</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Reporter</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]/60 text-xs">
                {sortedIssues.map((issue) => {
                  const priority = getPriorityInfo(issue.priorityScore);
                  const statusInfo = getStatusInfo(issue.status);
                  const StatusIcon = statusInfo.icon;
                  const dupCount = issue.dna?.duplicateReports || 0;

                  return (
                    <tr 
                      key={issue.id} 
                      className={`hover:bg-[#FAF9F6]/50 transition-colors cursor-pointer ${selectedIssueId === issue.id ? "bg-[#FAF9F6]" : ""}`}
                      onClick={() => {
                        setSelectedIssueId(issue.id);
                        setDrawerOpen(true);
                      }}
                    >
                      {/* Priority Cell */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${priority.bg}`}>
                          {issue.priorityScore} ({priority.label})
                        </span>
                      </td>

                      {/* Status Cell */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${statusInfo.bg}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Title Cell */}
                      <td className="py-3 px-4 font-semibold text-[#1A1A1A] max-w-xs truncate">
                        {issue.title || "Untitled Civic Report"}
                      </td>

                      {/* Category Cell */}
                      <td className="py-3 px-4">
                        <span className="text-[#4A4A3A] font-semibold bg-[#FAF9F6] border border-[#E5E0D8]/80 px-2 py-0.5 rounded-md text-[10px]">
                          {issue.category || "General"}
                        </span>
                      </td>

                      {/* Endorsements Cell */}
                      <td className="py-3 px-4 font-mono font-bold text-[#4A4A3A]">
                        {issue.endorsementCount || 0}
                      </td>

                      {/* Duplicate Reports Cell */}
                      <td className="py-3 px-4">
                        {dupCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[#A37B5C] bg-[#A37B5C]/10 px-2 py-0.5 rounded-md text-[10px]">
                            {dupCount} reports
                          </span>
                        ) : (
                          <span className="text-[#A8A297] font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Created Cell */}
                      <td className="py-3 px-4 text-[#7A756D] font-medium">
                        {formatDate(issue.createdAt)}
                      </td>

                      {/* Reporter Cell */}
                      <td className="py-3 px-4 text-[#4A4A3A] font-semibold truncate max-w-[100px]">
                        {issue.authorName || "Anonymous"}
                      </td>

                      {/* Actions Cell */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setSelectedIssueId(issue.id);
                            setDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-lg transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Right Side Drawer for Selected Issue Details */}
      {drawerOpen && selectedIssue && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/30 z-40 transition-opacity backdrop-blur-xs" 
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Element */}
          <div 
            className="fixed inset-y-0 right-0 max-w-xl w-full bg-[#FAF9F6] shadow-2xl z-50 flex flex-col border-l border-[#E5E0D8] h-full animate-in slide-in-from-right duration-300"
            id="issue-detail-drawer"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4.5 bg-white border-b border-[#E5E0D8]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A8A297]">Issue Inspector</span>
                <h3 className="text-sm font-bold text-[#1A1A1A] truncate max-w-xs md:max-w-md">
                  {selectedIssue.title || "Untitled Civic Issue"}
                </h3>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-[#FAF9F6] flex items-center justify-center text-[#7A756D] transition-colors cursor-pointer"
                aria-label="Close Inspector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              
              {/* Photo Display */}
              {selectedIssue.imageUrls && selectedIssue.imageUrls.length > 0 ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#E5E0D8] bg-[#F5F5F0] h-60">
                  <img 
                    src={selectedIssue.imageUrls[activeImageIndex]} 
                    alt="Civic Issue Proof"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {selectedIssue.imageUrls.length > 1 && (
                    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                      {selectedIssue.imageUrls.map((_: any, idx: number) => (
                        <button 
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`h-1.5 w-1.5 rounded-full transition-all ${idx === activeImageIndex ? "bg-white w-3" : "bg-white/50"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#E5E0D8] bg-[#F5F5F0] h-40 flex flex-col items-center justify-center text-[#A8A297]">
                  <ImageIcon className="h-8 w-8 mb-2" />
                  <span className="text-[11px] font-medium">No photos submitted with this report</span>
                </div>
              )}

              {/* Status and Actions Panel */}
              <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A756D]">Operational Status</span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs border ${getStatusInfo(selectedIssue.status).bg}`}>
                    {React.createElement(getStatusInfo(selectedIssue.status).icon, { className: "h-3.5 w-3.5" })}
                    <span>{getStatusInfo(selectedIssue.status).label}</span>
                  </span>
                </div>

                {/* Status Transitions buttons */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297] block">Change Status</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => initiateStatusChange(selectedIssue.id, selectedIssue.title, "reported")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                        selectedIssue.status === "reported" 
                          ? "bg-rose-50 border-rose-200 text-rose-800 pointer-events-none" 
                          : "bg-white border-[#E5E0D8] text-[#7A756D] hover:bg-rose-50/30 hover:border-rose-100 hover:text-rose-700"
                      }`}
                    >
                      Reported
                    </button>
                    <button 
                      onClick={() => initiateStatusChange(selectedIssue.id, selectedIssue.title, "verified")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                        selectedIssue.status === "verified" 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-800 pointer-events-none" 
                          : "bg-white border-[#E5E0D8] text-[#7A756D] hover:bg-indigo-50/30 hover:border-indigo-100 hover:text-indigo-700"
                      }`}
                    >
                      Verified
                    </button>
                    <button 
                      onClick={() => initiateStatusChange(selectedIssue.id, selectedIssue.title, "in_progress")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                        selectedIssue.status === "in_progress" 
                          ? "bg-blue-50 border-blue-200 text-blue-800 pointer-events-none" 
                          : "bg-white border-[#E5E0D8] text-[#7A756D] hover:bg-blue-50/30 hover:border-blue-100 hover:text-blue-700"
                      }`}
                    >
                      In Progress
                    </button>
                    <button 
                      onClick={() => initiateStatusChange(selectedIssue.id, selectedIssue.title, "resolved")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                        selectedIssue.status === "resolved" 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 pointer-events-none" 
                          : "bg-white border-[#E5E0D8] text-[#7A756D] hover:bg-emerald-50/30 hover:border-emerald-100 hover:text-emerald-700"
                      }`}
                    >
                      Resolved
                    </button>
                  </div>
                </div>
              </section>

              {/* Core Metadata Grid */}
              <section className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297]">Priority Score</span>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-[#5A5A40] font-mono">{selectedIssue.priorityScore || 0}</span>
                    <span className="text-[10px] text-[#7A756D] font-medium capitalize">({getPriorityInfo(selectedIssue.priorityScore).label})</span>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297]">Confidence Level</span>
                  <div className="mt-2.5 flex items-baseline gap-0.5">
                    <span className="text-xl font-extrabold text-[#5A5A40] font-mono">{Math.round((selectedIssue.confidence || 0.95) * 100)}%</span>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297]">Severity Rating</span>
                  <div className="mt-2.5 flex items-baseline gap-0.5">
                    <span className="text-xl font-extrabold text-[#5A5A40] font-mono uppercase text-xs">
                      {selectedIssue.severity || "Medium"}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297]">Category Scope</span>
                  <div className="mt-2.5">
                    <span className="text-xs font-bold text-[#4A4A3A] bg-[#FAF9F6] border border-[#E5E0D8] px-2 py-1 rounded-md">
                      {selectedIssue.category || "Unassigned"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Text descriptions */}
              <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">AI summary</h4>
                  <p className="text-xs text-[#4A4A3A] leading-relaxed font-medium bg-[#F5F5F0] p-3 rounded-xl border border-[#E5E0D8]/60">
                    {selectedIssue.summary || "No automated executive summary has been generated for this issue."}
                  </p>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">Raw Report Description</h4>
                  <p className="text-xs text-[#7A756D] leading-relaxed whitespace-pre-wrap">
                    {selectedIssue.description || "No manual description provided."}
                  </p>
                </div>
              </section>

              {/* Issue DNA */}
              <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-3.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#5A5A40]">Issue DNA</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-[10px] text-[#A8A297] block">Endorsement Velocity</span>
                    <span className="font-semibold text-[#4A4A3A] font-mono">{(selectedIssue.dna?.endorsementVelocity || 0).toFixed(2)} / hr</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A8A297] block">Verification Count</span>
                    <span className="font-semibold text-[#4A4A3A] font-mono">{selectedIssue.dna?.verificationCount || 0} confirmations</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A8A297] block">Reporter ID</span>
                    <span className="font-mono text-[#A8A297] truncate block max-w-[150px]">{selectedIssue.authorId || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#A8A297] block">Duplicate Submissions</span>
                    <span className="font-semibold text-[#4A4A3A] font-mono">{selectedIssue.dna?.duplicateCount || 0} links</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-[#A8A297] block">Geographic Location</span>
                    <div className="flex items-start gap-1.5 mt-1">
                      <MapPin className="h-4.5 w-4.5 text-[#5A5A40] shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-[#4A4A3A] block leading-relaxed">
                          {selectedIssue.location?.address || "Coordinate Area"}
                        </span>
                        {selectedIssue.location?.latitude && (
                          <span className="text-[10px] text-[#A8A297] font-mono block">
                            {selectedIssue.location.latitude.toFixed(5)}, {selectedIssue.location.longitude.toFixed(5)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* RESERVED FUTURE SECTIONS (Coming in a future phase) */}
              <section className="bg-[#FAF9F6] border border-[#E5E0D8]/80 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-[#E5E0D8]/60 pb-2 mb-2">
                  <Sparkles className="h-4 w-4 text-[#5A5A40]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#5A5A40]">Integrated Agent Workspace</h4>
                </div>
                
                {/* Community Summary */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#4A4A3A]">Community Summary</span>
                    <span className="text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1.5 py-0.5 rounded-md">Coming in future phase</span>
                  </div>
                  <p className="text-[10px] text-[#A8A297] italic">AI agent synthesis of active resident comments and feedback loops.</p>
                </div>

                {/* Truth Engine */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#4A4A3A]">Truth Engine</span>
                    <span className="text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1.5 py-0.5 rounded-md">Coming in future phase</span>
                  </div>
                  <p className="text-[10px] text-[#A8A297] italic">Automated cross-jurisdiction analysis, duplicate verification, and satellite audit checks.</p>
                </div>

                {/* Official Resolution */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#4A4A3A]">Official Resolution</span>
                    <span className="text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1.5 py-0.5 rounded-md">Coming in future phase</span>
                  </div>
                  <p className="text-[10px] text-[#A8A297] italic">Municipal department assignments, SLA logs, and direct administrative tracking.</p>
                </div>

                {/* Resolution Evidence */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#4A4A3A]">Resolution Evidence</span>
                    <span className="text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1.5 py-0.5 rounded-md">Coming in future phase</span>
                  </div>
                  <p className="text-[10px] text-[#A8A297] italic">Before/after photos, ground team telemetry, and citizen confirmation approvals.</p>
                </div>

                {/* Activity Timeline */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-[#4A4A3A]">Activity Timeline</span>
                    <span className="text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1.5 py-0.5 rounded-md">Coming in future phase</span>
                  </div>
                  <p className="text-[10px] text-[#A8A297] italic">Interactive step-by-step history logs of all operations and agent triggers.</p>
                </div>
              </section>

              {/* Citizen Comments Section */}
              <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E5E0D8]/60 pb-3">
                  <MessageSquare className="h-4.5 w-4.5 text-[#5A5A40]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#5A5A40]">
                    Citizen Discussion ({comments.length})
                  </h4>
                </div>

                {/* Post comment box */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Contribute administrative notes or update..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-grow bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#5A5A40]"
                    aria-label="Add a comment to issue"
                  />
                  <button 
                    type="submit"
                    disabled={!newCommentText.trim() || submittingComment}
                    className="bg-[#5A5A40] text-white hover:bg-[#4A4A30] p-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  >
                    {submittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>

                {/* List of comments */}
                {commentsLoading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#5A5A40]/60" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-[11px] text-[#A8A297] italic text-center py-4">No comments posted yet on this report.</p>
                ) : (
                  <div className="space-y-3.5 divide-y divide-[#E5E0D8]/40">
                    {comments.map((comment, index) => (
                      <div key={comment.id} className={`pt-3.5 ${index === 0 ? "pt-0" : ""}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          {comment.photoURL ? (
                            <img 
                              src={comment.photoURL} 
                              alt={comment.displayName || "User"} 
                              className="h-5.5 w-5.5 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-5.5 w-5.5 rounded-full bg-[#E5E0D8] text-[#5A5A40] text-[9px] font-bold flex items-center justify-center">
                              {comment.displayName?.[0] || "C"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#1A1A1A] block truncate">{comment.displayName || "Citizen"}</span>
                            <span className="text-[9px] text-[#A8A297] block">{formatDate(comment.createdAt)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-[#4A4A3A] pl-7.5 leading-relaxed font-medium">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          </div>
        </>
      )}

      {/* Lightweight Status Confirmation Dialog Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#FAF9F6] border border-[#E5E0D8] rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 text-center items-center">
            <div className="h-12 w-12 rounded-2xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
              <Info className="h-6 w-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">Confirm Status Change</h3>
              <p className="text-xs text-[#7A756D] leading-relaxed">
                Are you sure you want to transition <span className="font-semibold text-[#4A4A3A]">"{confirmModal.issueTitle}"</span> to status <span className="font-bold text-[#5A5A40] capitalize">"{confirmModal.newStatus.replace("_", " ")}"</span>?
              </p>
            </div>

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-4 bg-white border border-[#E5E0D8] text-[#7A756D] text-xs font-bold rounded-xl hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                disabled={updatingStatus}
              >
                Cancel
              </button>
              <button
                onClick={commitStatusChange}
                className="flex-1 py-2.5 px-4 bg-[#5A5A40] text-white text-xs font-bold rounded-xl hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Confirm</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
