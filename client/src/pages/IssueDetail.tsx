import React, { useState, useEffect } from "react";
import { getIssue, endorseIssue } from "../api";
import { COMMUNITY_VERIFICATION_THRESHOLD } from "../../../server/config/constants";
import { 
  MapPin, 
  Flame, 
  User, 
  Compass, 
  Clock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ThumbsUp, 
  MessageSquare, 
  Layers, 
  ShieldAlert,
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from "lucide-react";

interface IssueDetailProps {
  issueId: string;
  onBack: () => void;
  onViewGroup?: (groupId: string) => void;
}

export default function IssueDetail({ issueId, onBack, onViewGroup }: IssueDetailProps) {
  const [issue, setIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [localToast, setLocalToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [endorsingPending, setEndorsingPending] = useState(false);

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => {
        setLocalToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);

  const handleEndorseClick = async () => {
    if (endorsingPending || !issue) return;

    // Save previous state for rollback
    const prevEndorsed = !!issue.endorsed;
    const prevCount = issue.endorsementCount || 0;
    const prevPriority = issue.priorityScore || 50;
    const prevStatus = issue.status || "reported";

    // Compute optimistic state
    const nextEndorsed = !prevEndorsed;
    const nextCount = nextEndorsed ? prevCount + 1 : Math.max(0, prevCount - 1);
    
    // Optimistic priority score change: each endorsement adds 5 points to priority score
    const priorityDiff = (nextEndorsed ? 1 : -1) * 5;
    const nextPriority = Math.min(100, Math.max(1, prevPriority + priorityDiff));

    // Optimistic status transition
    let nextStatus = prevStatus;
    if (prevCount < COMMUNITY_VERIFICATION_THRESHOLD && nextCount >= COMMUNITY_VERIFICATION_THRESHOLD && prevStatus === "reported") {
      nextStatus = "verified";
    }

    // Set optimistic state immediately
    setIssue((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        endorsed: nextEndorsed,
        endorsementCount: nextCount,
        priorityScore: nextPriority,
        status: nextStatus
      };
    });

    setEndorsingPending(true);
    setLocalToast(null);

    try {
      const res = await endorseIssue(issue.id);
      if (res && res.success) {
        setLocalToast({
          message: res.endorsed 
            ? "Your citizen signature was registered! Urgency score raised."
            : "Your endorsement signature was withdrawn.",
          type: "success"
        });

        // Background fetch of the authoritative issue state to ensure perfect sync
        const freshRes = await getIssue(issue.id);
        if (freshRes && freshRes.success && freshRes.data && freshRes.data.issue) {
          setIssue(freshRes.data.issue);
        }
      } else {
        throw new Error(res?.error || "Ledger rejected endorsement signature.");
      }
    } catch (err: any) {
      console.error("Endorsement failed:", err);
      // Rollback to previous state
      setIssue((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          endorsed: prevEndorsed,
          endorsementCount: prevCount,
          priorityScore: prevPriority,
          status: prevStatus
        };
      });
      setLocalToast({
        message: err.message || "Failed to update endorsement. Please try again.",
        type: "error"
      });
    } finally {
      setEndorsingPending(false);
    }
  };

  useEffect(() => {
    async function loadIssue() {
      try {
        setLoading(true);
        setError(null);
        const res = await getIssue(issueId);
        if (res && res.success && res.data && res.data.issue) {
          setIssue(res.data.issue);
          setActiveImageIndex(0);
        } else {
          setError(res?.error || "Unable to locate this civic issue.");
        }
      } catch (err: any) {
        console.error("Failed to load issue:", err);
        setError("Failed to retrieve issue details. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    loadIssue();
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 flex-grow">
        <Loader2 className="h-8 w-8 animate-spin text-[#5A5A40] mb-3" />
        <p className="text-sm text-[#7A756D]">Fetching live issue telemetry from ledger...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1A1A1A] font-serif">Issue Retrieval Failed</h2>
        <p className="text-xs text-[#7A756D] mt-2 mb-6">{error || "The requested issue does not exist or has been archived."}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Feed</span>
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/50">
            ● Reported
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 border border-sky-200/50">
            ● In Progress
          </span>
        );
      case "assigned":
        return (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 border border-indigo-200/50">
            ● Assigned
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/50">
            ✓ Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-[#F5F5F0] px-2.5 py-1 text-xs font-semibold text-[#4A4A3A] border border-[#E5E0D8]">
            {status}
          </span>
        );
    }
  };

  const getVisibilityBadge = (vis: string) => {
    if (vis === "public") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
          <Eye className="h-3.5 w-3.5" /> Public Ledger
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A37B5C] bg-[#FAF9F6] border border-[#E5E0D8] px-2 py-0.5 rounded-lg">
        <EyeOff className="h-3.5 w-3.5" /> Group Only
      </span>
    );
  };

  const images = issue.imageUrls || [];

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5A5A40] hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Feed</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Main Issue Details */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Photos Showcase */}
          {images.length > 0 && (
            <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4 space-y-3 relative shadow-xs">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center group">
                <img 
                  src={images[activeImageIndex]} 
                  alt="Issue documentation" 
                  className="max-h-full max-w-full object-contain cursor-zoom-in"
                  onClick={() => setIsFullscreenImage(true)}
                />
                
                {/* Carousel indicators/controls if multi-image */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#5A5A40] text-white rounded-full transition-all cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActiveImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#5A5A40] text-white rounded-full transition-all cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => setIsFullscreenImage(true)}
                  className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-[#5A5A40] text-white rounded-xl transition-all cursor-pointer opacity-100 group-hover:scale-105"
                  title="Expand Photo"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {images.map((imgUrl: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-14 w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        idx === activeImageIndex ? "border-[#5A5A40] opacity-100" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={imgUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Issue Core Info */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F5F5F0] pb-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(issue.status)}
                {getVisibilityBadge(issue.visibility)}
              </div>
              <div className="text-[11px] text-[#A8A297] font-semibold uppercase tracking-wider font-mono">
                ID: {issue.id}
              </div>
            </div>

            {/* Author and Group Metadata Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-3">
                {issue.authorPicture ? (
                  <img 
                    src={issue.authorPicture} 
                    alt={issue.authorName} 
                    className="h-10 w-10 rounded-full border border-[#E5E0D8]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-[#F5F5F0] border border-[#E5E0D8] text-[#5A5A40] flex items-center justify-center font-bold text-sm">
                    {issue.authorName?.[0] || "C"}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-[#1A1A1A]">{issue.authorName || "Citizen"}</div>
                  <div className="text-[11px] text-[#A8A297] font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Filed {new Date(issue.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>

              {issue.groupName && (
                <button
                  onClick={() => onViewGroup && onViewGroup(issue.groupId)}
                  className="px-3.5 py-1.5 bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white border border-[#E5E0D8] text-xs font-semibold rounded-xl text-[#5A5A40] transition-colors cursor-pointer"
                >
                  {issue.groupName}
                </button>
              )}
            </div>

            {/* Description Text */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">Reported Complaint</h3>
              <p className="text-sm text-[#4A4A3A] leading-relaxed whitespace-pre-wrap font-sans">
                {issue.description}
              </p>
            </div>

            {/* Exact Location Bar */}
            <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-[#5A5A40] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-grow">
                <div className="text-xs font-bold text-[#1A1A1A]">Exact Landmark Coordinates</div>
                <p className="text-xs text-[#4A4A3A] mt-1 leading-normal">{issue.location.address}</p>
                <div className="text-[10px] text-[#8A8A6F] font-semibold mt-1 font-mono">
                  GPS: {issue.location.latitude != null ? Number(issue.location.latitude).toFixed(6) : "Coordinates Unmapped"}
                  {issue.location.longitude != null ? `, ${Number(issue.location.longitude).toFixed(6)}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* PLACEHOLDER SECTION 1: Community Discussion */}
          <div className="border border-dashed border-[#E5E0D8] bg-[#FAF9F6]/40 rounded-2xl p-6 relative">
            <div className="absolute top-4 right-4 bg-[#F5F5F0] text-[#8A8A6F] px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase border border-[#E5E0D8]/60">
              Future Feature (Phase 2)
            </div>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 bg-[#E5E0D8]/40 border border-[#E5E0D8] rounded-full flex items-center justify-center text-[#A8A297] shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-[#4A4A3A]">Community Discussion Board</h4>
                <p className="text-xs text-[#8A8A6F] mt-1.5 leading-normal">
                  Comment boards, replies, municipal tracking logs, and local consensus-building tools are locked for this phase. Discussion threads will plug in seamlessly in a future release.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Resolution Timeline Ledger */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#5A5A40]">
              <Layers className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Resolution Timeline Ledger</span>
            </div>
            
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E0D8]/50 pl-1">
              {/* Status history steps backwards (oldest to newest) */}
              <div className="flex gap-4 relative">
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 z-10">
                  ●
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">Issue Ingested</h4>
                  <p className="text-[11px] text-[#7A756D] mt-0.5">Complaint officially logged on decentralized ledger.</p>
                  <p className="text-[9px] text-[#A8A297] font-mono mt-1 font-semibold">{new Date(issue.createdAt).toLocaleString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {issue.statusHistory && [...issue.statusHistory].reverse().map((historyItem: any) => (
                <div key={historyItem.id} className="flex gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-[#A37B5C] border border-[#E5E0D8] text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 z-10">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">Community Verified</h4>
                    <p className="text-[11px] text-[#7A756D] mt-0.5">{historyItem.note || "Automatically verified after reaching community endorsement threshold."}</p>
                    <p className="text-[9px] text-[#A8A297] font-mono mt-1 font-semibold">{new Date(historyItem.timestamp).toLocaleString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}

              {/* Pending steps if not resolved */}
              {issue.status !== "resolved" && (
                <div className="flex gap-4 relative opacity-60">
                  <div className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-dashed border-[#A8A297] text-[#A8A297] flex items-center justify-center font-mono text-[10px] font-bold shrink-0 z-10">
                    ...
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#7A756D] uppercase tracking-wider">Official Assignment</h4>
                    <p className="text-[11px] text-[#8A8A6F] mt-0.5">Awaiting municipal officer response and field delegation.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Priority Meter, DNA Audit, Endorsements */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Priority Score Meter */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-center gap-1 text-[#5A5A40]">
              <Flame className="h-4 w-4 fill-[#A37B5C] text-[#A37B5C]" />
              <span className="text-xs font-bold uppercase tracking-wider">Priority Signal</span>
            </div>
            
            {/* Round Ring Meter */}
            <div className="relative h-28 w-28 mx-auto flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90">
                <circle 
                  cx="56" cy="56" r="48" 
                  className="stroke-[#F5F5F0]" strokeWidth="8" fill="transparent" 
                />
                <circle 
                  cx="56" cy="56" r="48" 
                  className="stroke-[#5A5A40]" strokeWidth="8" fill="transparent" 
                  strokeDasharray="301.6"
                  strokeDashoffset={301.6 - (301.6 * (issue.priorityScore || 50)) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black text-[#1A1A1A] font-mono leading-none">{issue.priorityScore || 50}</span>
                <span className="text-[9px] font-bold text-[#A8A297] tracking-wider uppercase mt-1">out of 100</span>
              </div>
            </div>

            <p className="text-[11px] text-[#7A756D] leading-normal font-medium">
              Deterministic score calculated dynamically based on structural reporting completeness and local context.
            </p>
          </div>

          {/* DNA Audit Panel */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#A37B5C]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Issue DNA Audit</span>
            </div>

            <p className="text-[11px] text-[#7A756D] leading-normal">
              Immutable telemetry attributes registered directly on the decentralized ledger.
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-lg">
                <span className="text-[#8A8A6F]">Re-open Count</span>
                <span className="font-bold text-[#1A1A1A]">{issue.dna?.reopenCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-lg">
                <span className="text-[#8A8A6F]">Duplicate Reports</span>
                <span className="font-bold text-[#1A1A1A]">{issue.dna?.duplicateCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#E5E0D8]/40 rounded-lg">
                <span className="text-[#8A8A6F]">Verification Count</span>
                <span className="font-bold text-[#1A1A1A]">{issue.dna?.verificationCount ?? 0}</span>
              </div>
            </div>
          </div>

          {/* PLACEHOLDER: AI Summary / Ingestion */}
          <div className="border border-dashed border-[#E5E0D8] bg-[#FAF9F6]/40 rounded-2xl p-5 relative">
            <div className="absolute top-4 right-4 bg-[#F5F5F0] text-[#8A8A6F] px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider uppercase border border-[#E5E0D8]/60">
              Future Feature
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#4A4A3A]">
                <Sparkles className="h-4 w-4 text-[#A37B5C]" />
                <span>AI Agent Analysis</span>
              </div>
              <p className="text-[11px] text-[#8A8A6F] leading-normal">
                AI summary is currently pending. The **Ingestion Agent** and **Community Intelligence Agents** will evaluate duplicate indicators, auto-verify categories, and suggest corrective actions in Phase 2.
              </p>
            </div>
          </div>

          {/* Real-time Endorsement System Interface */}
          <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#5A5A40]">
                <ThumbsUp className={`h-4 w-4 ${issue.endorsed ? "fill-[#A37B5C] text-[#A37B5C]" : ""}`} />
                <span className="text-xs font-bold uppercase tracking-wider">Citizen Endorsements</span>
              </div>
              <span className="text-[10px] font-mono text-[#5A5A40] bg-[#F5F5F0] border border-[#E5E0D8] px-2 py-0.5 rounded-full font-bold">
                {issue.endorsementCount || 0} Signatures
              </span>
            </div>

            <p className="text-[11px] text-[#7A756D] leading-normal font-medium">
              Validate this report with your secure civic endorsement. Issues crossing {COMMUNITY_VERIFICATION_THRESHOLD} community signatures are automatically verified and fast-tracked to municipal departments.
            </p>

            {/* Verification Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-[#8A8A6F]">
                <span>Ledger Verification Progress</span>
                <span>{issue.endorsementCount || 0} / {COMMUNITY_VERIFICATION_THRESHOLD}</span>
              </div>
              <div className="w-full bg-[#F5F5F0] h-2 rounded-full overflow-hidden border border-[#E5E0D8]/40">
                <div 
                  className="bg-[#A37B5C] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, ((issue.endorsementCount || 0) / COMMUNITY_VERIFICATION_THRESHOLD) * 100)}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleEndorseClick}
              disabled={endorsingPending}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                issue.endorsed
                  ? "bg-[#FAF9F6] border-[#A37B5C]/40 text-[#A37B5C] hover:bg-[#F5F5F0]"
                  : "bg-[#5A5A40] hover:bg-[#4A4A30] text-white border-transparent"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {endorsingPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Registering Signature...</span>
                </>
              ) : issue.endorsed ? (
                <>
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Endorsed</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>Endorse Report</span>
                </>
              )}
            </button>

            {/* Local Toast/Banner Notification */}
            {localToast && (
              <div 
                className={`p-3 rounded-xl border text-[11px] font-semibold text-center transition-all animate-fade-in ${
                  localToast.type === "success"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-rose-50 border-rose-100 text-rose-800"
                }`}
              >
                {localToast.message}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Full-Screen Image Modal */}
      {isFullscreenImage && images.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsFullscreenImage(false)}
        >
          <img 
            src={images[activeImageIndex]} 
            alt="Fullscreen issue" 
            className="max-h-full max-w-full object-contain"
          />
          <button 
            onClick={() => setIsFullscreenImage(false)}
            className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-sm font-bold transition-all cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      )}
    </div>
  );
}
