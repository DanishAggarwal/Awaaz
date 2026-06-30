import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  getIssues, 
  getIssue,
  updateIssueStatus, 
  getComments, 
  createComment,
  getCommunityAnalysis,
  getTruthAnalysis,
  exportReportPDF,
  approveReopenRequest,
  rejectReopenRequest
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import { uploadImage } from "../../utils/uploadImage";
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
  PlayCircle,
  RotateCw,
  RotateCcw,
  Layers
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

  // Community Analysis state
  const [communityAnalysis, setCommunityAnalysis] = useState<any | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Truth Analysis state
  const [truthAnalysis, setTruthAnalysis] = useState<any | null>(null);
  const [truthLoading, setTruthLoading] = useState(false);
  const [truthError, setTruthError] = useState<string | null>(null);
  const [truthAnalysisStatus, setTruthAnalysisStatus] = useState<string | null>(null);

  // Export Report state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Status Change Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    issueId: string;
    newStatus: string;
    issueTitle: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { user } = useAuth();

  // Resolution Modal state
  const [resolutionModal, setResolutionModal] = useState<{
    isOpen: boolean;
    issueId: string;
    issueTitle: string;
  } | null>(null);

  const [afterImageFile, setAfterImageFile] = useState<File | null>(null);
  const [afterImagePreview, setAfterImagePreview] = useState<string>("");
  const [resolutionNote, setResolutionNote] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [isReopenActionPending, setIsReopenActionPending] = useState(false);

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
    setCommunityAnalysis(null);
    setAnalysisError(null);
    setTruthAnalysis(null);
    setTruthError(null);
  }, [selectedScope]);

  // Keep selectedIssue synced with the issues list when it changes (Client-side sync only, no API calls)
  useEffect(() => {
    if (!selectedIssueId) return;
    const matched = issues.find(i => i.id === selectedIssueId);
    if (matched) {
      setSelectedIssue(matched);
    }
  }, [selectedIssueId, issues]);

  // Load issue details & comments exactly once when selection changes (NOT when issues list updates)
  useEffect(() => {
    if (!selectedIssueId) return;

    async function loadIssueDetails() {
      try {
        setIssueLoading(true);

        // Fetch fresh detailed issue
        let freshIssue = null;
        try {
          const issueRes = await getIssue(selectedIssueId);
          if (issueRes && issueRes.success && issueRes.data && issueRes.data.issue) {
            freshIssue = issueRes.data.issue;
            setSelectedIssue(freshIssue);
          }
        } catch (err) {
          console.error("Error fetching fresh issue:", err);
        }

        // Find current issue from latest state
        const matched = freshIssue || issues.find(i => i.id === selectedIssueId);
        if (matched) {
          setActiveImageIndex(0);
          setCommunityAnalysis(matched.communityAnalysis || null);
          setTruthAnalysis(matched.truthAnalysis || null);
          setTruthAnalysisStatus(matched.truthAnalysisStatus || null);
        } else {
          setCommunityAnalysis(null);
          setTruthAnalysis(null);
          setTruthAnalysisStatus(null);
        }

        // Fetch fresh comments
        setCommentsLoading(true);
        const commentsRes = await getComments(selectedIssueId);
        if (commentsRes && commentsRes.success && commentsRes.data) {
          setComments(commentsRes.data.comments || []);
        }

        // Fetch fresh community analysis dynamically
        setAnalysisLoading(true);
        setAnalysisError(null);
        try {
          const analysisRes = await getCommunityAnalysis(selectedIssueId);
          if (analysisRes && analysisRes.success && analysisRes.data) {
            setCommunityAnalysis(analysisRes.data.communityAnalysis);
            
            // Sync with local issues list
            setIssues(prev => prev.map(issue => {
              if (issue.id === selectedIssueId) {
                return { ...issue, communityAnalysis: analysisRes.data.communityAnalysis };
              }
              return issue;
            }));
          }
        } catch (err: any) {
          console.error("Error fetching community analysis:", err);
          // Only show error if we don't have cached communityAnalysis in memory
          if (!matched || !matched.communityAnalysis) {
            setAnalysisError(err.message || "Failed to load community analysis.");
          }
        } finally {
          setAnalysisLoading(false);
        }

        // Fetch fresh truth analysis dynamically if resolved or reopened
        if (matched && (matched.status === "resolved" || matched.status === "reopened")) {
          setTruthLoading(true);
          setTruthError(null);
          try {
            const truthRes = await getTruthAnalysis(selectedIssueId);
            if (truthRes && truthRes.success && truthRes.data) {
              setTruthAnalysis(truthRes.data.truthAnalysis);
              setTruthAnalysisStatus(truthRes.data.truthAnalysisStatus || null);
              
              // Sync with local issues list
              setIssues(prev => prev.map(issue => {
                if (issue.id === selectedIssueId) {
                  return { 
                    ...issue, 
                    truthAnalysis: truthRes.data.truthAnalysis,
                    truthAnalysisStatus: truthRes.data.truthAnalysisStatus || null
                  };
                }
                return issue;
              }));
            }
          } catch (err: any) {
            console.error("Error fetching truth analysis:", err);
            if (!matched || !matched.truthAnalysis) {
              setTruthError(err.message || "Failed to load truth verification.");
            }
          } finally {
            setTruthLoading(false);
          }
        } else {
          setTruthAnalysis(null);
          setTruthAnalysisStatus(null);
        }
      } catch (err) {
        console.error("Error loading issue comments:", err);
      } finally {
        setIssueLoading(false);
        setCommentsLoading(false);
      }
    }

    loadIssueDetails();
  }, [selectedIssueId]);

  // Handle regenerating Community Analysis
  const handleRegenerateAnalysis = async () => {
    if (!selectedIssueId || analysisLoading) return;

    try {
      setAnalysisLoading(true);
      setAnalysisError(null);
      const res = await getCommunityAnalysis(selectedIssueId, true); // force=true
      if (res && res.success && res.data) {
        setCommunityAnalysis(res.data.communityAnalysis);
        
        // Update the issue in the local list so the cache is synced in memory
        setIssues(prev => prev.map(issue => {
          if (issue.id === selectedIssueId) {
            return { ...issue, communityAnalysis: res.data.communityAnalysis };
          }
          return issue;
        }));
      } else {
        setAnalysisError(res?.error || "Failed to regenerate community analysis.");
      }
    } catch (err: any) {
      console.error("Error regenerating community analysis:", err);
      setAnalysisError(err.message || "An unexpected error occurred.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Handle regenerating Truth Analysis
  const handleRegenerateTruth = async () => {
    if (!selectedIssueId || truthLoading) return;

    try {
      setTruthLoading(true);
      setTruthError(null);
      setTruthAnalysisStatus("generating");
      const res = await getTruthAnalysis(selectedIssueId, true); // force=true
      if (res && res.success && res.data) {
        setTruthAnalysis(res.data.truthAnalysis);
        setTruthAnalysisStatus(res.data.truthAnalysisStatus || "completed");
        
        // Update the issue in the local list so the cache is synced in memory
        setIssues(prev => prev.map(issue => {
          if (issue.id === selectedIssueId) {
            return { 
              ...issue, 
              truthAnalysis: res.data.truthAnalysis,
              truthAnalysisStatus: res.data.truthAnalysisStatus || "completed"
            };
          }
          return issue;
        }));
      } else {
        setTruthError(res?.error || "Failed to regenerate truth verification.");
        setTruthAnalysisStatus("failed");
      }
    } catch (err: any) {
      console.error("Error regenerating truth analysis:", err);
      setTruthError(err.message || "Failed to regenerate truth verification.");
      setTruthAnalysisStatus("failed");
    } finally {
      setTruthLoading(false);
    }
  };

  // Polling for Truth Analysis if it's currently generating
  useEffect(() => {
    if (truthAnalysisStatus !== "generating" || !selectedIssueId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await getTruthAnalysis(selectedIssueId);
        if (res && res.success && res.data) {
          if (res.data.truthAnalysisStatus !== "generating") {
            setTruthAnalysis(res.data.truthAnalysis);
            setTruthAnalysisStatus(res.data.truthAnalysisStatus || null);
            
            // Sync with local issues list
            setIssues(prev => prev.map(issue => {
              if (issue.id === selectedIssueId) {
                return { 
                  ...issue, 
                  truthAnalysis: res.data.truthAnalysis,
                  truthAnalysisStatus: res.data.truthAnalysisStatus || null
                };
              }
              return issue;
            }));
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error("Error polling truth analysis:", err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [truthAnalysisStatus, selectedIssueId]);

  // Handle exporting the civic report PDF
  const handleExportReport = async () => {
    if (!selectedIssueId || exporting) return;

    try {
      setExporting(true);
      setExportError(null);
      const blob = await exportReportPDF(selectedIssueId);
      
      // Create object URL and download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Awaaz_Civic_Report_${selectedIssueId}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error exporting report:", err);
      setExportError(err.message || "Failed to download report PDF.");
    } finally {
      setExporting(false);
    }
  };

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
    if (newStatus === "resolved") {
      setResolutionModal({
        isOpen: true,
        issueId,
        issueTitle
      });
      // Reset any previous state
      setAfterImageFile(null);
      setAfterImagePreview("");
      setResolutionNote("");
      setInternalNote("");
      setResolutionError(null);
    } else {
      setConfirmModal({
        isOpen: true,
        issueId,
        newStatus,
        issueTitle
      });
    }
  };

  // Handle submitting the resolution evidence
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionModal || submittingResolution) return;

    if (!afterImageFile) {
      setResolutionError("An after-work photograph is required.");
      return;
    }
    if (!resolutionNote.trim()) {
      setResolutionError("A resolution note is required.");
      return;
    }

    try {
      setSubmittingResolution(true);
      setResolutionError(null);

      // 1. Upload After Image
      let afterImageUrl = "";
      try {
        afterImageUrl = await uploadImage(afterImageFile);
      } catch (uploadErr: any) {
        throw new Error(`Failed to upload after photo: ${uploadErr.message || uploadErr}`);
      }

      // 2. Commit Status change with resolution object
      const resolutionPayload = {
        afterImageUrl,
        resolutionNote: resolutionNote.trim(),
        internalNote: internalNote.trim()
      };

      const res = await updateIssueStatus(resolutionModal.issueId, "resolved", resolutionPayload);
      if (res && res.success) {
        // Construct the resolution block to update local client state
        const resolutionDataLocal = {
          resolvedBy: user?.displayName || user?.email || "Administrator",
          resolvedAt: new Date().toISOString(),
          afterImageUrl,
          resolutionNote: resolutionNote.trim(),
          internalNote: internalNote.trim()
        };

        // Update in parent issues state
        setIssues(prev => prev.map(issue => {
          if (issue.id === resolutionModal.issueId) {
            return { 
              ...issue, 
              status: "resolved",
              resolution: resolutionDataLocal,
              truthAnalysisStatus: "generating",
              truthAnalysis: null
            };
          }
          return issue;
        }));

        // Update selected issue details if open
        if (selectedIssue && selectedIssue.id === resolutionModal.issueId) {
          setSelectedIssue((prev: any) => prev ? { 
            ...prev, 
            status: "resolved",
            resolution: resolutionDataLocal,
            truthAnalysisStatus: "generating",
            truthAnalysis: null
          } : null);
          setTruthAnalysis(null);
          setTruthAnalysisStatus("generating");
        }

        // Close modal and reset
        setResolutionModal(null);
        setAfterImageFile(null);
        setAfterImagePreview("");
        setResolutionNote("");
        setInternalNote("");
      } else {
        setResolutionError(res?.error || "Failed to submit resolution.");
      }
    } catch (err: any) {
      console.error("Error submitting resolution:", err);
      setResolutionError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmittingResolution(false);
    }
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

  const handleApproveReopen = async () => {
    if (!selectedIssue || isReopenActionPending) return;
    
    try {
      setIsReopenActionPending(true);
      const res = await approveReopenRequest(selectedIssue.id);
      if (res && res.success) {
        const updatedIssue = res.data?.issue || res.data;
        
        // Update in parent list
        setIssues(prev => prev.map(issue => {
          if (issue.id === selectedIssue.id) {
            return {
              ...issue,
              status: "reopened",
              reopenRequest: {
                ...issue.reopenRequest,
                status: "approved"
              },
              dna: {
                ...issue.dna,
                reopenCount: (issue.dna?.reopenCount || 0) + 1
              },
              resolution: null,
              communityAnalysis: null
            };
          }
          return issue;
        }));

        // Update selectedIssue with returned payload
        setSelectedIssue(updatedIssue);
        alert("Reopen request approved. Issue is now marked as Reopened.");
      } else {
        alert(res?.error || "Failed to approve reopen request.");
      }
    } catch (err: any) {
      console.error("Error approving reopen:", err);
      alert(err.message || "An unexpected error occurred.");
    } finally {
      setIsReopenActionPending(false);
    }
  };

  const handleRejectReopen = async () => {
    if (!selectedIssue || isReopenActionPending) return;
    const rejectReason = window.prompt("Please provide a reason for rejecting this reopen request:");
    if (rejectReason === null) return; // user cancelled prompt
    
    try {
      setIsReopenActionPending(true);
      const res = await rejectReopenRequest(selectedIssue.id, rejectReason);
      if (res && res.success) {
        const updatedIssue = res.data?.issue || res.data;
        
        // Update in parent list
        setIssues(prev => prev.map(issue => {
          if (issue.id === selectedIssue.id) {
            return {
              ...issue,
              reopenRequest: {
                ...issue.reopenRequest,
                status: "rejected",
                rejectReason
              }
            };
          }
          return issue;
        }));

        // Update selectedIssue with returned payload
        setSelectedIssue(updatedIssue);
        alert("Reopen request rejected successfully.");
      } else {
        alert(res?.error || "Failed to reject reopen request.");
      }
    } catch (err: any) {
      console.error("Error rejecting reopen:", err);
      alert(err.message || "An unexpected error occurred.");
    } finally {
      setIsReopenActionPending(false);
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
      case "reopened":
        return { label: "Reopened", bg: "bg-orange-50 text-orange-800 border-orange-100/60", icon: RotateCcw };
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
                  const dupCount = issue.dna?.duplicateReports || issue.dna?.duplicateCount || 0;

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
                        {issue.reopenRequest?.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border bg-amber-50 text-amber-800 border-amber-200">
                            <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse" />
                            <span>Reopen Requested</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${statusInfo.bg}`}>
                            <StatusIcon className="h-3 w-3" />
                            <span>{statusInfo.label}</span>
                          </span>
                        )}
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

                {/* Reopen Request Pending Review Block */}
                {selectedIssue.reopenRequest?.status === "pending" && (
                  <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-3.5 space-y-3 animate-fade-in text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                      <span className="text-sm">⚠️</span>
                      <span>Reopen Request Review</span>
                    </div>

                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-amber-100/60 shadow-2xs">
                      <div className="text-[9px] uppercase font-bold text-[#A8A297] tracking-wider">Citizen Reason</div>
                      <p className="text-[#4A4A3A] font-medium leading-relaxed">{selectedIssue.reopenRequest.reason}</p>
                    </div>

                    {selectedIssue.reopenRequest.photoUrl && (
                      <div className="border border-amber-100/40 rounded-lg overflow-hidden max-h-32 bg-white flex items-center justify-center">
                        <img src={selectedIssue.reopenRequest.photoUrl} alt="Reopen evidence" className="w-full object-cover max-h-32" />
                      </div>
                    )}

                    <div className="flex justify-between text-[9px] font-bold text-[#8A8A6F] uppercase">
                      <span>By: {selectedIssue.reopenRequest.requestedBy}</span>
                      <span>
                        {selectedIssue.reopenRequest.requestedAt ? new Date(selectedIssue.reopenRequest.requestedAt).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        }) : "Recently"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleApproveReopen}
                        disabled={isReopenActionPending}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {isReopenActionPending ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : "✓"} Approve
                      </button>
                      <button
                        onClick={handleRejectReopen}
                        disabled={isReopenActionPending}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        {isReopenActionPending ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : "✕"} Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* PDF Export Section */}
                <div className="pt-2 border-t border-[#E5E0D8]/40">
                  <button
                    onClick={handleExportReport}
                    disabled={exporting}
                    className="w-full py-2 px-3 bg-[#FAF9F6] border border-[#E5E0D8] hover:bg-[#F5F5F0] hover:border-[#D5D0C8] text-[#5A5A40] hover:text-[#4A4A35] rounded-xl text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5A5A40]" />
                        <span>Generating Civic Report...</span>
                      </>
                    ) : (
                      <>
                        <span>📄 Export Report</span>
                      </>
                    )}
                  </button>
                  {exportError && (
                    <p className="mt-1.5 text-[10px] text-rose-600 font-medium text-center">{exportError}</p>
                  )}
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

              {/* Resolution Evidence section */}
              {selectedIssue.status === "resolved" && (
                <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-[#E5E0D8]/60 pb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#5A5A40]">Resolution Evidence</h4>
                  </div>

                  {selectedIssue.resolution ? (
                    <div className="space-y-4">
                      {/* After Work Photo */}
                      {selectedIssue.resolution.afterImageUrl ? (
                        <div className="border border-[#E5E0D8] rounded-2xl overflow-hidden bg-white max-h-60 flex items-center justify-center">
                          <img 
                            src={selectedIssue.resolution.afterImageUrl} 
                            alt="After Work Photograph" 
                            className="w-full object-cover max-h-60" 
                          />
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#A8A297] italic">No photograph uploaded.</p>
                      )}

                      {/* Notes */}
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">Resolution Note</h5>
                        <p className="text-xs text-[#4A4A3A] leading-relaxed whitespace-pre-wrap bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/60 font-medium">
                          {selectedIssue.resolution.resolutionNote || "No note recorded."}
                        </p>
                      </div>

                      {selectedIssue.resolution.internalNote && (
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 mb-1 flex items-center gap-1">
                            <span>Internal Operational Remarks</span>
                            <span className="text-[8px] text-[#A8A297] font-normal italic">(Visible only to administrators)</span>
                          </h5>
                          <p className="text-xs text-[#7A756D] leading-relaxed whitespace-pre-wrap bg-amber-50/20 p-3 rounded-xl border border-amber-100/40">
                            {selectedIssue.resolution.internalNote}
                          </p>
                        </div>
                      )}

                      {/* Sign-off metadata */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5E0D8]/40 text-xs">
                        <div>
                          <span className="text-[10px] text-[#A8A297] block">Resolved By</span>
                          <span className="font-semibold text-[#4A4A3A]">{selectedIssue.resolution.resolvedBy || "Administrator"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#A8A297] block">Resolved Date</span>
                          <span className="font-semibold text-[#4A4A3A]">
                            {selectedIssue.resolution.resolvedAt ? new Date(selectedIssue.resolution.resolvedAt).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                            }) : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/40 border border-amber-100/60 rounded-xl text-center">
                      <p className="text-xs text-amber-800 font-medium">No resolution evidence available.</p>
                      <p className="text-[10px] text-[#7A756D] mt-0.5">This issue was resolved historically without structured audit trails.</p>
                    </div>
                  )}
                </section>
              )}

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
                    <span className="font-semibold text-[#4A4A3A] font-mono">{selectedIssue.dna?.duplicateCount || selectedIssue.dna?.duplicateReports || 0} links</span>
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
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3.5 space-y-3">
                  <div className="flex justify-between items-center border-b border-[#E5E0D8]/40 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#5A5A40]" />
                      <span className="text-[11px] font-bold text-[#4A4A3A]">Community Summary</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegenerateAnalysis}
                      disabled={analysisLoading}
                      title="Regenerate Community Analysis"
                      className="p-1 hover:bg-[#FAF9F6] rounded-md transition-colors text-[#5A5A40]/70 hover:text-[#5A5A40] disabled:opacity-40 cursor-pointer"
                    >
                      <RotateCw className={`h-2.5 w-2.5 ${analysisLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {analysisLoading && !communityAnalysis ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#5A5A40]" />
                      <p className="text-[9px] text-[#A8A297] font-medium animate-pulse text-center">
                        Community Agent compiling feedback...
                      </p>
                    </div>
                  ) : analysisError ? (
                    <div className="py-2 text-center space-y-1.5">
                      <p className="text-[9px] text-rose-600 font-medium">{analysisError}</p>
                      <button
                        type="button"
                        onClick={handleRegenerateAnalysis}
                        className="text-[8px] font-bold text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8] px-2 py-0.5 rounded hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !communityAnalysis ? (
                    <div className="py-3 text-center space-y-1.5">
                      <p className="text-[9px] text-[#A8A297] italic">No Community Analysis generated yet for this issue.</p>
                      <button
                        type="button"
                        onClick={handleRegenerateAnalysis}
                        className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-md hover:bg-[#4A4A30] transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        Analyze Community Context
                      </button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="space-y-3.5 overflow-hidden"
                    >
                      {/* Mood, Escalate, and Confidence Header */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          communityAnalysis.communityMood === "urgent"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : communityAnalysis.communityMood === "frustrated"
                            ? "bg-amber-50 text-amber-800 border border-amber-100"
                            : communityAnalysis.communityMood === "concerned"
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-slate-50 text-slate-600 border border-slate-100"
                        }`}>
                          Mood: {communityAnalysis.communityMood}
                        </span>

                        {communityAnalysis.escalate && (
                          <span className="text-[8px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 animate-pulse">
                            Escalate Suggested
                          </span>
                        )}

                        <span className="ml-auto text-[8px] font-mono font-bold text-[#A8A297] bg-[#F5F5F0] px-1 py-0.5 rounded">
                          Confidence: {Math.round((communityAnalysis.confidence || 0) * 100)}%
                        </span>
                      </div>

                      {/* Brief Paragraph */}
                      <div>
                        <h5 className="text-[8px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">Executive Brief</h5>
                        <p className="text-[10px] text-[#4A4A3A] leading-relaxed bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E0D8]/40">
                          {communityAnalysis.brief}
                        </p>
                      </div>

                      {/* Key Insights */}
                      {communityAnalysis.keyInsights && communityAnalysis.keyInsights.length > 0 && (
                        <div>
                          <h5 className="text-[8px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">Key Insights</h5>
                          <ul className="space-y-1">
                            {communityAnalysis.keyInsights.map((insight: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1 text-[10px] text-[#4A4A3A]">
                                <ChevronRight className="h-3 w-3 text-[#5A5A40] shrink-0 mt-0.5" />
                                <span className="leading-tight">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Possible Factors */}
                      {communityAnalysis.possibleFactors && communityAnalysis.possibleFactors.length > 0 && (
                        <div>
                          <h5 className="text-[8px] font-bold uppercase tracking-wider text-[#A8A297] mb-1">Possible Factors</h5>
                          <div className="flex flex-wrap gap-1">
                            {communityAnalysis.possibleFactors.map((factor: string, idx: number) => (
                              <span key={idx} className="text-[9px] text-[#7A756D] bg-[#FAF9F6] py-0.5 px-2 rounded border border-[#E5E0D8]/20">
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Urgency Note */}
                      {communityAnalysis.urgencyNote && (
                        <div className="bg-amber-50/45 border border-amber-100 rounded-lg p-2.5 text-[9.5px] text-amber-950 leading-normal flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-amber-700/80 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold uppercase tracking-wide text-[8px] block text-amber-800 mb-0.5">Urgency Note</span>
                            {communityAnalysis.urgencyNote}
                          </div>
                        </div>
                      )}

                      {/* Recommended Next Step */}
                      {communityAnalysis.recommendedNextStep && (
                        <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-lg p-2.5 text-[10px] text-[#4A4A3A] leading-relaxed">
                          <span className="font-extrabold uppercase tracking-wider text-[8px] text-[#5A5A40] block mb-0.5">Recommended Next Step (Advisory)</span>
                          <p className="font-medium">{communityAnalysis.recommendedNextStep}</p>
                        </div>
                      )}

                      {/* Metadata stamp */}
                      <div className="text-[7.5px] font-mono text-[#A8A297] text-right pt-1 flex justify-between items-center border-t border-[#E5E0D8]/10">
                        <span>Comments: {communityAnalysis.sourceCommentCount ?? 0}</span>
                        <span>Generated: {new Date(communityAnalysis.generatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Truth Engine */}
                <div className="border border-[#E5E0D8]/40 bg-white rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#5A5A40]" />
                      <span className="text-[11px] font-bold text-[#4A4A3A]">Truth Engine Verification</span>
                    </div>
                    {selectedIssue?.status === "resolved" || selectedIssue?.status === "reopened" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleRegenerateTruth}
                          disabled={truthLoading}
                          className="text-[8px] font-bold text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8] px-1.5 py-0.5 rounded hover:bg-[#F5F5F0] transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Force Truth Engine Audit"
                        >
                          <RotateCw className={`h-2 w-2 ${truthLoading ? "animate-spin" : ""}`} />
                          Re-run Verification
                        </button>
                      </div>
                    ) : (
                      <span className="text-[8px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md">Pending Resolution</span>
                    )}
                  </div>

                  {!(selectedIssue?.status === "resolved" || selectedIssue?.status === "reopened") ? (
                    <p className="text-[10px] text-[#A8A297] italic mt-1.5">Truth verification is pending. This audit runs automatically when the issue is resolved.</p>
                  ) : (truthAnalysisStatus === "generating" || (truthLoading && !truthAnalysis)) ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#5A5A40]" />
                      <p className="text-[9px] text-[#A8A297] font-medium animate-pulse text-center">
                        Generating Truth Verification...
                      </p>
                    </div>
                  ) : (truthAnalysisStatus === "failed" || (truthError && !truthAnalysis)) ? (
                    <div className="py-2 text-center space-y-1.5">
                      <p className="text-[9px] text-rose-600 font-medium">{truthError || "Truth verification pending."}</p>
                      <button
                        type="button"
                        onClick={handleRegenerateTruth}
                        className="text-[8px] font-bold text-[#5A5A40] bg-[#FAF9F6] border border-[#E5E0D8] px-2 py-0.5 rounded hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                      >
                        Retry Verification
                      </button>
                    </div>
                  ) : !truthAnalysis ? (
                    <div className="py-3 text-center space-y-1.5">
                      <p className="text-[9px] text-[#A8A297] italic">Truth verification has not yet been performed.</p>
                      <button
                        type="button"
                        onClick={handleRegenerateTruth}
                        className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-md hover:bg-[#4A4A30] transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        Run Truth Audit
                      </button>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="space-y-3 mt-2"
                    >
                      {/* Status and Confidence */}
                      <div className="flex items-center justify-between border-b border-[#E5E0D8]/40 pb-1.5">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          truthAnalysis.verificationStatus === "Verified"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : truthAnalysis.verificationStatus === "Likely Verified"
                            ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                            : truthAnalysis.verificationStatus === "Needs Review"
                            ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {truthAnalysis.verificationStatus}
                        </span>

                        <span className="text-[9px] font-mono font-bold text-[#4A4A3A]">
                          Confidence Rating: {Math.round((truthAnalysis.confidence || 0) * 100)}%
                        </span>
                      </div>

                      {/* Outdated Cache Warning */}
                      {truthAnalysis.isOutdated && (
                        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-[9px] p-2 rounded-md flex items-center gap-1.5 leading-snug">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span>Verification may be outdated (changes detected).</span>
                        </div>
                      )}

                      {/* Executive Summary */}
                      <div>
                        <h5 className="text-[8px] font-bold uppercase tracking-wider text-[#A8A297] mb-0.5">Executive Summary</h5>
                        <p className="text-[10px] text-[#4A4A3A] leading-relaxed bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E0D8]/40">
                          {truthAnalysis.verificationSummary}
                        </p>
                      </div>

                      {/* Visual Assessment */}
                      {truthAnalysis.visualAssessment && (
                        <div>
                          <h5 className="text-[8px] font-bold uppercase tracking-wider text-[#A8A297] mb-0.5">Visual Evidence Check</h5>
                          <p className="text-[10px] text-[#4A4A3A] leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {truthAnalysis.visualAssessment}
                          </p>
                        </div>
                      )}

                      {/* Remaining Concerns */}
                      {truthAnalysis.remainingConcerns && truthAnalysis.remainingConcerns.length > 0 && (
                        <div>
                          <h5 className="text-[8px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            Remaining Concerns
                          </h5>
                          <ul className="space-y-1">
                            {truthAnalysis.remainingConcerns.map((concern: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1 text-[10px] text-amber-900 leading-tight">
                                <span className="text-amber-500">•</span>
                                <span>{concern}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendation */}
                      {truthAnalysis.recommendation && (
                        <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-lg p-2.5 text-[10px] text-[#4A4A3A] leading-normal">
                          <span className="font-extrabold uppercase tracking-wider text-[8px] text-[#5A5A40] block mb-0.5">Independent Operational Recommendation</span>
                          <p className="font-medium">{truthAnalysis.recommendation}</p>
                        </div>
                      )}

                      {/* Metadata Timestamp */}
                      <div className="text-[7.5px] font-mono text-[#A8A297] text-right pt-1 border-t border-[#E5E0D8]/10">
                        Audited: {new Date(truthAnalysis.generatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </motion.div>
                  )}
                </div>
              </section>

              {/* Dynamic Resolution Timeline Ledger */}
              <section className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E5E0D8]/60 pb-2.5">
                  <Layers className="h-4.5 w-4.5 text-[#5A5A40]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#5A5A40]">Resolution Timeline Ledger</h4>
                </div>

                <div className="space-y-3.5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E0D8]/50 pl-1">
                  {/* Status history steps oldest first */}
                  <div className="flex gap-3 relative text-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-mono text-[9px] font-bold shrink-0 z-10">
                      ●
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">Issue Ingested</h5>
                      <p className="text-[10px] text-[#7A756D] mt-0.5">Complaint officially logged on decentralized ledger.</p>
                      <p className="text-[8px] text-[#A8A297] font-mono mt-0.5 font-semibold">
                        {selectedIssue.createdAt ? new Date(selectedIssue.createdAt).toLocaleString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}
                      </p>
                    </div>
                  </div>

                  {selectedIssue.statusHistory && [...selectedIssue.statusHistory].reverse().map((historyItem: any) => {
                    const toStatus = historyItem.toStatus || "reported";
                    let stepTitle = "Status Updated";
                    let stepIcon = "✓";
                    let iconColor = "bg-[#A37B5C] border-[#E5E0D8] text-white";
                    
                    if (toStatus === "verified") {
                      stepTitle = "Community Verified";
                      stepIcon = "✓";
                      iconColor = "bg-[#A37B5C] text-white border-transparent";
                    } else if (toStatus === "in_progress") {
                      stepTitle = "Investigation Started";
                      stepIcon = "⚙";
                      iconColor = "bg-sky-600 text-white border-transparent";
                    } else if (toStatus === "resolved") {
                      stepTitle = "Issue Resolved";
                      stepIcon = "✓";
                      iconColor = "bg-emerald-600 text-white border-transparent";
                    } else if (toStatus === "reopened") {
                      stepTitle = "Issue Reopened";
                      stepIcon = "🔄";
                      iconColor = "bg-rose-600 text-white border-transparent";
                    }

                    return (
                      <div key={historyItem.id} className="flex gap-3 relative text-xs">
                        <div className={`w-6 h-6 rounded-full ${iconColor} flex items-center justify-center font-mono text-[9px] font-bold shrink-0 z-10 border`}>
                          {stepIcon}
                        </div>
                        <div>
                          <h5 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">{stepTitle}</h5>
                          <p className="text-[10px] text-[#7A756D] mt-0.5">{historyItem.note || `Status transition from ${historyItem.fromStatus} to ${historyItem.toStatus}.`}</p>
                          {historyItem.changedBy && (
                            <p className="text-[9px] text-[#5A5A40] font-medium">By: {historyItem.changedBy}</p>
                          )}
                          <p className="text-[8px] text-[#A8A297] font-mono mt-0.5 font-semibold">
                            {new Date(historyItem.timestamp).toLocaleString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Active/Pending Step indicator */}
                  {selectedIssue.status !== "resolved" && (
                    <div className="flex gap-3 relative opacity-65 text-xs">
                      <div className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-dashed border-[#A8A297] text-[#A8A297] flex items-center justify-center font-mono text-[9px] font-bold shrink-0 z-10">
                        ...
                      </div>
                      <div>
                        <h5 className="text-[11px] font-bold text-[#7A756D] uppercase tracking-wider">Official Assignment</h5>
                        <p className="text-[10px] text-[#8A8A6F] mt-0.5">Awaiting municipal officer response and field delegation.</p>
                      </div>
                    </div>
                  )}
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
                  <div className="space-y-3.5 divide-y divide-[#E5E0D8]/40 max-h-[350px] overflow-y-auto pr-1.5">
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

      {/* Evidence-Based Resolution Modal */}
      {resolutionModal?.isOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/45 animate-fade-in" onClick={() => !submittingResolution && setResolutionModal(null)} />
          <div className="relative bg-[#FAF9F6] border border-[#E5E0D8] rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 text-left z-10 animate-scale-up">
            
            <div className="flex items-start justify-between border-b border-[#E5E0D8]/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">Evidence-Based Resolution</h3>
                <p className="text-[11px] text-[#7A756D] mt-0.5">
                  Filing resolution evidence for <span className="font-semibold text-[#4A4A3A]">"{resolutionModal.issueTitle}"</span>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => !submittingResolution && setResolutionModal(null)}
                className="text-[#7A756D] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                disabled={submittingResolution}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              {/* After Photo Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4A4A3A] flex items-center gap-1">
                  <span>After Work Photograph</span>
                  <span className="text-rose-500 font-normal">*Required</span>
                </label>
                
                {afterImagePreview ? (
                  <div className="relative border border-[#E5E0D8] rounded-2xl overflow-hidden bg-white group h-40 flex items-center justify-center">
                    <img 
                      src={afterImagePreview} 
                      alt="After work preview" 
                      className="h-full w-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAfterImageFile(null);
                          setAfterImagePreview("");
                        }}
                        className="py-1 px-3 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
                        disabled={submittingResolution}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#C5C0B8] rounded-2xl p-6 bg-white hover:bg-[#FDFDFB] transition-colors flex flex-col items-center justify-center text-center">
                    <ImageIcon className="h-8 w-8 text-[#A8A297] mb-2" />
                    <p className="text-xs font-semibold text-[#4A4A3A]">Select after photo</p>
                    <p className="text-[10px] text-[#A8A297] mt-0.5">JPEG, PNG up to 10MB</p>
                    <label className="mt-3 py-1.5 px-4 bg-[#FAF9F6] border border-[#E5E0D8] hover:bg-[#F5F5F0] text-[#5A5A40] text-xs font-bold rounded-xl transition-all cursor-pointer">
                      <span>Browse Files</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setAfterImageFile(file);
                            setAfterImagePreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden" 
                        disabled={submittingResolution}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Resolution Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4A4A3A] flex items-center gap-1">
                  <span>Resolution Note</span>
                  <span className="text-rose-500 font-normal">*Required</span>
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain what work was performed, what was repaired, and any remaining site observations..."
                  className="w-full text-xs p-3 rounded-2xl bg-white border border-[#E5E0D8] focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] outline-none transition-all placeholder:text-[#A8A297]"
                  disabled={submittingResolution}
                />
              </div>

              {/* Internal Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4A4A3A] flex items-center gap-1.5">
                  <span>Internal Operational Notes</span>
                  <span className="text-[9px] text-[#A8A297] font-normal italic">(Admin Only - Private)</span>
                </label>
                <textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Internal notes, SLA remarks, contractor details, or future follow-up schedules..."
                  className="w-full text-xs p-3 rounded-2xl bg-white border border-[#E5E0D8] focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] outline-none transition-all placeholder:text-[#A8A297]"
                  disabled={submittingResolution}
                />
              </div>

              {/* Error Display */}
              {resolutionError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-rose-700">{resolutionError}</p>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex gap-2.5 pt-2 border-t border-[#E5E0D8]/40">
                <button
                  type="button"
                  onClick={() => setResolutionModal(null)}
                  className="flex-1 py-2.5 px-4 bg-white border border-[#E5E0D8] text-[#7A756D] text-xs font-bold rounded-xl hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                  disabled={submittingResolution}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  disabled={submittingResolution}
                >
                  {submittingResolution ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Complete Resolution</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
