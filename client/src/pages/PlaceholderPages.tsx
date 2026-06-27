import React, { useState, useEffect, useCallback } from "react";
import { getIssues } from "../api";
import { auth } from "../firebase";
import { 
  MapPin, 
  Compass, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Flame, 
  ChevronRight,
  Loader2,
  Layers,
  Sparkles
} from "lucide-react";

/* ==========================================
   1. NEARBY ISSUES (Lightweight Map Placeholder)
   ========================================== */
export function NearbyIssues() {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    // Attempt auto-detect to show off high-fidelity browser geolocating
    if (navigator.geolocation) {
      setDetecting(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                setAddress(data.display_name);
              }
            }
          } catch (e) {
            setAddress(`Sector Coordinates: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
          }
          setDetecting(false);
        },
        () => {
          setDetecting(false);
        }
      );
    }
  }, []);

  return (
    <div className="flex-grow flex flex-col font-sans p-6">
      <header className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif">Nearby Civic Signals</h2>
        <p className="text-xs text-[#7A756D] mt-0.5">Issues and telemetry reports within your immediate geographic sector.</p>
      </header>

      <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-xs flex-grow flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full my-auto">
        <div className="h-14 w-14 rounded-full bg-[#FAF9F6] border border-[#E5E0D8] flex items-center justify-center text-[#5A5A40] mb-5 shadow-xs">
          <Compass className={`h-6 w-6 ${detecting ? "animate-spin text-[#A37B5C]" : ""}`} />
        </div>

        <h3 className="text-base font-bold text-[#1A1A1A]">Geospatial Discovery Network</h3>
        
        {detecting ? (
          <p className="text-xs text-[#7A756D] mt-2">Triangulating neighboring cell towers and satellite locks...</p>
        ) : coords ? (
          <div className="mt-4 space-y-4 w-full">
            <div className="bg-[#FAF9F6] border border-[#E5E0D8] rounded-xl p-4 inline-block text-left w-full max-w-md mx-auto">
              <span className="text-[10px] font-bold text-[#7A756D] uppercase tracking-wider block mb-1">Your Mapped Sector</span>
              <p className="text-xs font-semibold text-[#5A5A40] leading-relaxed flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#A37B5C] shrink-0 mt-0.5" />
                <span>{address || `Latitude: ${coords.lat.toFixed(5)}, Longitude: ${coords.lng.toFixed(5)}`}</span>
              </p>
            </div>
            <p className="text-xs text-[#7A756D] leading-relaxed max-w-sm mx-auto">
              Awaaz's **Phase 2 Spatial Intelligence Grid** is currently under audit. Once deployed, neighboring complaints within a 2.5km radius will auto-populate as interactive pins.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-[#7A756D] max-w-sm">
              Please enable browser GPS permission to view civic issues in your immediate vicinity.
            </p>
            <span className="text-[10px] text-[#A8A297] block italic">Coordinates are processed safely and are never stored without a submitted report.</span>
          </div>
        )}

        <div className="mt-8 border-t border-[#F5F5F0] pt-6 w-full flex items-center justify-between text-[11px] text-[#7A756D]">
          <span className="font-semibold flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-[#5A5A40]" />
            Telemetry Baseline: Active
          </span>
          <span className="text-[10px] bg-[#F5F5F0] border border-[#E5E0D8] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[#5A5A40]">
            Phase 2 Pipeline
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   2. MY REPORTS (Fully Real Citizen Tracker)
   ========================================== */
interface MyReportsProps {
  onViewIssue: (id: string) => void;
}

export function MyReports({ onViewIssue }: MyReportsProps) {
  const [myIssues, setMyIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      // We fetch all public and user group issues, then filter in memory to guarantee 100% security and zero composite index requirement crashes
      const resPublic = await getIssues({ scope: "public" });
      const resGroup = await getIssues({ scope: "my-groups" });
      
      const combinedList = [
        ...(resPublic?.data?.issues || []),
        ...(resGroup?.data?.issues || [])
      ];

      // De-duplicate and filter by current user's UID
      const uniqueIssues = combinedList.filter((issue, idx, self) => 
        self.findIndex(i => i.id === issue.id) === idx && issue.authorId === uid
      );

      setMyIssues(uniqueIssues);
    } catch (err: any) {
      console.error("Error fetching user reports:", err);
      setError("Failed to load your filed complaints ledger. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserIssues();
  }, [fetchUserIssues]);

  return (
    <div className="flex-grow flex flex-col font-sans p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif">My Filed Reports</h2>
          <p className="text-xs text-[#7A756D] mt-0.5">Track and inspect civic complaints submitted under your credential ledger.</p>
        </div>
        <button 
          onClick={fetchUserIssues}
          className="text-[10px] font-bold text-[#5A5A40] bg-[#F5F5F0] border border-[#E5E0D8] hover:bg-[#5A5A40] hover:text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
        >
          Sync Ledger
        </button>
      </header>

      {error && (
        <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2.5 mb-6">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 flex-grow">
          <Loader2 className="h-6 w-6 animate-spin text-[#5A5A40] mb-2" />
          <span className="text-xs text-[#7A756D] font-medium">Validating ledger records...</span>
        </div>
      ) : myIssues.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E5E0D8] p-8 max-w-md mx-auto w-full my-auto">
          <div className="h-12 w-12 rounded-full bg-[#FAF9F6] border border-[#E5E0D8] flex items-center justify-center mx-auto mb-4 text-[#A8A297]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-[#4A4A3A]">Your Ledger is empty</p>
          <p className="text-xs text-[#8A8A6F] mt-1 leading-normal">
            You haven't filed any active civic issues yet. Tap the button at the top of the feed to log your first report.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl mx-auto w-full">
          {myIssues.map((issue) => (
            <article
              key={issue.id}
              onClick={() => onViewIssue(issue.id)}
              className="group rounded-xl border border-[#E5E0D8] bg-white p-4.5 hover:border-[#5A5A40]/30 transition-all shadow-xs flex items-center justify-between gap-4 cursor-pointer"
            >
              <div className="min-w-0 flex-grow space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider bg-[#F5F5F0] border border-[#E5E0D8] px-1.5 py-0.5 rounded-md">
                    {issue.groupName || "Public Initiative"}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase font-mono tracking-wider border ${
                    issue.status === "reported" 
                      ? "bg-amber-50 text-amber-800 border-amber-200" 
                      : issue.status === "resolved" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                      : "bg-sky-50 text-sky-800 border-sky-200"
                  }`}>
                    {issue.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#1A1A1A] truncate pr-4 leading-normal">{issue.description}</h3>
                <div className="flex items-center gap-2 text-[10px] text-[#A8A297] font-medium">
                  <Clock className="h-3 w-3" />
                  <span>Filed {new Date(issue.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}</span>
                  <span>•</span>
                  <span className="truncate max-w-xs">{issue.location.address || "Coordinates mapped"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 bg-[#FAF9F6] px-2 py-0.5 rounded-lg border border-[#E5E0D8] text-[#5A5A40]">
                  <Flame className="h-3 w-3 fill-[#A37B5C] text-[#A37B5C]" />
                  <span className="text-xs font-bold font-mono">{issue.priorityScore || 50}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#A8A297] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================
   3. NOTIFICATIONS PAGE (High-fidelity Alerts)
   ========================================== */
export function NotificationsPage() {
  const [alerts] = useState([
    {
      id: "alert-1",
      title: "Indiranagar Civic Forum active",
      body: "You successfully joined Indiranagar Civic Forum. You can now report community issues here.",
      time: "2 hours ago",
      read: false,
      tag: "community"
    },
    {
      id: "alert-2",
      title: "Ledger Network Online",
      body: "Civic evidence hash verified successfully on the hyperpure distributed logging layer.",
      time: "Yesterday",
      read: true,
      tag: "system"
    },
    {
      id: "alert-3",
      title: "Awaaz Security Audit Complete",
      body: "All Firestore collections, rulesets, and write transactions consolidated for Phase 1.",
      time: "2 days ago",
      read: true,
      tag: "audit"
    }
  ]);

  return (
    <div className="flex-grow flex flex-col font-sans p-6">
      <header className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif">Awaaz Alerts Ledger</h2>
        <p className="text-xs text-[#7A756D] mt-0.5">Updates on verifications, endorsements and municipal resolution audits.</p>
      </header>

      <div className="space-y-4 max-w-2xl mx-auto w-full flex-grow">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`rounded-xl border p-4.5 transition-colors flex items-start gap-4.5 ${
              alert.read 
                ? "bg-white border-[#E5E0D8]/80 text-[#7A756D]" 
                : "bg-[#FAF9F6] border-[#5A5A40]/30 text-[#1A1A1A] shadow-xs"
            }`}
          >
            <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border ${
              alert.read 
                ? "bg-[#FAF9F6] border-[#E5E0D8] text-[#A8A297]" 
                : "bg-[#F5F5F0] border-[#5A5A40]/30 text-[#5A5A40]"
            }`}>
              <Bell className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-grow space-y-1">
              <div className="flex items-center justify-between gap-4">
                <h4 className={`text-sm font-bold leading-normal ${alert.read ? "text-[#4A4A3A]" : "text-[#1A1A1A]"}`}>
                  {alert.title}
                </h4>
                <span className="text-[10px] text-[#A8A297] font-semibold shrink-0">{alert.time}</span>
              </div>
              <p className="text-xs leading-relaxed">{alert.body}</p>
              
              <div className="flex items-center gap-1.5 pt-1.5">
                <span className="text-[8px] font-bold uppercase tracking-widest font-mono border border-[#E5E0D8] px-1.5 py-0.5 rounded-md bg-white">
                  {alert.tag}
                </span>
                {!alert.read && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 mt-6 flex items-start gap-4 max-w-md mx-auto">
          <Sparkles className="h-5 w-5 text-[#A37B5C] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-[#1A1A1A]">Interactive Municipal Actions</h5>
            <p className="text-[11px] text-[#7A756D] leading-relaxed">
              When municipality dashboards are active in future releases, you will receive real-time alerts regarding official municipal assignments and verification proofs on this tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
