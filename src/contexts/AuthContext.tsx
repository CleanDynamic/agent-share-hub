import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  website_url: string | null;
  twitter_handle: string | null;
  is_admin: boolean;
  is_creator: boolean;
  is_curator: boolean;
  curator_application_status: string | null;
  account_type: string;
  user_interests: string[];
  follower_count: number;
  following_count: number;
  joined_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  /** The stored session is known (SV-03: no longer waits for the profile). */
  loading: boolean;
  /** The profile of the signed-in reader is on its way. `isCreator`, `isAdmin` and `profile` are not settled until it is false. */
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const profileFor = useRef<string | null>(null);
  const inFlight = useRef<{ userId: string; done: Promise<void> } | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, bio, website_url, twitter_handle, is_admin, is_creator, is_curator, curator_application_status, account_type, user_interests, follower_count, following_count, joined_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  /* The profile for a reader, asked for once while a read for them is still out, and flagged as loading only the first
     time for that reader, so a token refresh reads it again quietly. */
  const loadProfile = useCallback(
    (userId: string) => {
      if (inFlight.current?.userId === userId) return inFlight.current.done;
      if (profileFor.current !== userId) {
        profileFor.current = userId;
        setProfileLoading(true);
      }
      const done = fetchProfile(userId).finally(() => {
        if (inFlight.current?.done === done) inFlight.current = null;
        if (profileFor.current === userId) setProfileLoading(false);
      });
      inFlight.current = { userId, done };
      return done;
    },
    [fetchProfile],
  );

  useEffect(() => {
    // Set up listener BEFORE getSession per Supabase best practice
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          const userId = newSession.user.id;
          // The reader changed: the profile is on its way before anything can read the old one as theirs.
          if (profileFor.current !== userId) {
            profileFor.current = userId;
            setProfileLoading(true);
          }
          // Defer profile fetch to avoid deadlock with auth state change
          setTimeout(() => void loadProfile(userId), 0);
        } else {
          profileFor.current = null;
          setProfile(null);
          setProfileLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        void loadProfile(s.user.id);
      } else {
        profileFor.current = null;
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    profileFor.current = null;
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    isLoggedIn: !!session?.user,
    isAdmin: profile?.is_admin ?? false,
    isCreator: profile?.is_creator ?? false,
    loading,
    profileLoading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
