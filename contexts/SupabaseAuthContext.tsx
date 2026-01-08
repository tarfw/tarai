import React, { createContext, useContext, useState, useEffect } from "react";
import { createClient, Session, User, AuthError } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/config/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_SESSION_KEY = "@tarai_supabase_session";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

interface SupabaseAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  supabase: typeof supabase;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(
  undefined
);

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session on mount
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (e) {
        console.error("Failed to load Supabase session", e);
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        setIsLoading(false);
      }
    })();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      setSession(data.session);
      setUser(data.user);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Sign in failed";
      setError(errorMessage);
      console.error("Email sign in error:", e);
      throw e;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      // Note: If email confirmation is enabled in Supabase, user needs to verify email first
      setSession(data.session);
      setUser(data.user);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Sign up failed";
      setError(errorMessage);
      console.error("Email sign up error:", e);
      throw e;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Sign out failed";
      setError(errorMessage);
      console.error("Sign out error:", e);
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        isAuthenticated: !!session,
        isLoading,
        user,
        session,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        error,
        supabase,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider"
    );
  }
  return context;
}

export { supabase };
