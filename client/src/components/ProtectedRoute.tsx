import React from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, LogIn } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F5F5F0]" id="loading-spinner">
        <Loader2 className="h-10 w-10 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F5F5F0] p-4" id="auth-screen">
        <div className="w-full max-w-md rounded-2xl border border-[#E5E0D8] bg-white p-8 shadow-xs">
          <div className="flex flex-col items-center text-center">
            {/* Logo placeholder */}
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5A5A40] text-3xl font-bold text-white shadow-md">
              आ
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] font-serif">Welcome to Awaaz</h1>
            <p className="mt-2 text-sm text-[#7A756D] leading-relaxed">
              India's civic accountability platform. Report local problems, build consensus, and verify resolution.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={() => login()}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5A5A40] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#4A4A32] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:ring-offset-2 cursor-pointer"
              id="google-signin-btn"
            >
              <LogIn className="h-5 w-5" />
              Sign In with Google
            </button>
            
            <p className="text-center text-xs text-[#A8A297] font-medium leading-relaxed">
              By signing in, you agree to connect your Google Account for verifying your citizenship reports.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
