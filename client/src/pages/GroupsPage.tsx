import React, { useState, useEffect, useCallback } from "react";
import { Plus, Users, Compass, AlertCircle, Loader2 } from "lucide-react";
import { getGroups } from "../api";
import GroupSearchBar from "../components/groups/GroupSearchBar";
import GroupFilter from "../components/groups/GroupFilter";
import GroupCard from "../components/groups/GroupCard";
import EmptyGroupsState from "../components/groups/EmptyGroupsState";
import CreateGroupModal from "../components/groups/CreateGroupModal";

interface GroupsPageProps {
  joinedGroupIds: string[];
  onJoinGroup: (groupId: string) => Promise<void>;
  onViewGroup: (groupId: string) => void;
  onCreateGroup?: (groupId: string) => Promise<void>;
}

export default function GroupsPage({ joinedGroupIds, onJoinGroup, onViewGroup, onCreateGroup }: GroupsPageProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch groups matching search and selected type
  const fetchGroupsList = useCallback(async (search: string, type: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getGroups({ search, type });
      if (res && res.success && res.data && res.data.groups) {
        setGroups(res.data.groups);
      } else {
        setError(res?.error || "Unable to fetch communities. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to load groups:", err);
      setError("Failed to load communities. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupsList(searchQuery, selectedType);
  }, [searchQuery, selectedType, fetchGroupsList]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterSelect = (type: string) => {
    setSelectedType(type);
  };

  const handleCreateSuccess = async (newGroup: any) => {
    setToast({
      message: `Successfully established community "${newGroup.name}"!`,
      type: "success"
    });

    if (onCreateGroup) {
      try {
        await onCreateGroup(newGroup.id);
      } catch (err) {
        console.error("Error invoking onCreateGroup callback:", err);
      }
    }

    // Refresh local list
    fetchGroupsList(searchQuery, selectedType);

    // Direct navigation
    if (newGroup && newGroup.id) {
      onViewGroup(newGroup.id);
    }
  };

  const handleJoin = async (groupId: string) => {
    try {
      await onJoinGroup(groupId);
      
      const targetGroup = groups.find((g) => g.id === groupId);
      setToast({
        message: `Successfully joined ${targetGroup ? `"${targetGroup.name}"` : "community"}!`,
        type: "success"
      });

      // Refresh group counts after joining
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return { ...g, memberCount: (g.memberCount || 0) + 1 };
        }
        return g;
      }));
    } catch (err: any) {
      console.error("Failed to join:", err);
      setToast({
        message: err.message || "Failed to join community.",
        type: "error"
      });
    }
  };

  return (
    <div className="flex-grow flex flex-col min-w-0" id="groups-page-container">
      {/* Header */}
      <header className="border-b border-[#E5E0D8] bg-white p-5 sticky top-0 z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] font-serif flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#5A5A40]" />
            <span>Civic Communities</span>
          </h2>
          <p className="text-xs text-[#7A756D]">Discover and join hyperlocal groups taking action near you</p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          id="btn-establish-community"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white hover:bg-[#4A4A3A] transition-all rounded-xl text-xs font-semibold shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Establish Community</span>
        </button>
      </header>

      {/* Main content split */}
      <div className="p-6 space-y-6 overflow-y-auto flex-grow bg-[#FAF9F6]">
        {/* Search & Filter bar */}
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-4.5 space-y-4 shadow-2xs">
          <GroupSearchBar onSearch={handleSearch} initialValue={searchQuery} />
          <GroupFilter selectedType={selectedType} onSelectType={handleFilterSelect} />
        </div>

        {/* Groups Grid or States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3" id="groups-loading">
            <Loader2 className="h-7 w-7 text-[#5A5A40] animate-spin" />
            <p className="text-xs text-[#7A756D] font-mono">RETRIEVING HYPERLOCAL DIRECTORY...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-red-100 p-8 max-w-md mx-auto" id="groups-error">
            <AlertCircle className="h-10 w-10 mx-auto text-red-600 mb-3" />
            <h3 className="text-base font-bold text-red-800 font-serif">Something went wrong</h3>
            <p className="text-xs text-red-600 mt-1.5">{error}</p>
            <button
              onClick={() => fetchGroupsList(searchQuery, selectedType)}
              className="mt-4 px-4 py-1.5 bg-[#FAF9F6] border border-[#E5E0D8] rounded-lg text-xs font-semibold text-[#5A5A40] hover:bg-[#F5F5F0]"
            >
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyGroupsState 
            isSearch={!!(searchQuery || selectedType)} 
            onCreateClick={() => setIsCreateModalOpen(true)} 
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#7A756D] font-semibold px-1">
              <span>Found {groups.length} active {groups.length === 1 ? "community" : "communities"}</span>
              <span className="font-mono text-[10px]">SORTED BY memberCount DESC</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="groups-grid">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isJoined={joinedGroupIds.includes(group.id)}
                  onJoin={handleJoin}
                  onView={onViewGroup}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Establishment Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Custom Toast Alert */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-2xl shadow-xl border text-xs font-semibold animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            toast.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200/60" 
              : "bg-rose-50 text-rose-800 border-rose-200/60"
          }`}
          id="groups-toast-message"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"} shrink-0 animate-pulse`}></div>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
