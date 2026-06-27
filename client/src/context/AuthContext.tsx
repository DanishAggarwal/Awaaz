import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle as fbSignInWithGoogle, signOutUser as fbSignOutUser } from "../firebase";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: () => Promise<any>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<any>;
  signOutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && result.data.user) {
            setUser(result.data.user);
          }
        }
      } catch (error) {
        console.error("Error refreshing user in context:", error);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setLoading(true);
          const token = await firebaseUser.getIdToken();
          
          // Sync user auth credentials with Firestore on the backend
          const response = await fetch("/api/auth/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            }
          });

          if (!response.ok) {
            throw new Error(`Auth sync failed with status: ${response.status}`);
          }

          const result = await response.json();
          if (result.success && result.data && result.data.user) {
            // Store the returned Firestore user profile in context state
            setUser(result.data.user);
          } else {
            // Fallback if structure is unexpected
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "",
              email: firebaseUser.email || "",
              photoURL: firebaseUser.photoURL || "",
              role: "citizen"
            });
          }
        } catch (error) {
          console.error("Auth sync error:", error);
          // Fallback to basic details on network or parsing failure
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "",
            role: "citizen"
          });
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await fbSignInWithGoogle();
      return result.user;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setLoading(false);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      setLoading(true);
      await fbSignOutUser();
      setUser(null);
    } catch (error) {
      console.error("Sign-Out Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const value = {
    user,
    loading,
    login: signInWithGoogle, // Alias for backward compatibility
    logout: signOutUser,    // Alias for backward compatibility
    signInWithGoogle,
    signOutUser,
    getToken,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
