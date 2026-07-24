import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, registerHouseholdFn } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  flatId: string | null;
  loading: boolean;
  /** Set when a verified email isn't a recognized flat (phone/email didn't match, or the flat is already claimed). */
  registrationError: string | null;
  /** Called by Login right after OTP verification succeeds, with the phone number the person typed in. */
  completeRegistration: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setFlatId((data.session?.user.app_metadata.flat_id as string | undefined) ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setFlatId((newSession?.user.app_metadata.flat_id as string | undefined) ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Called once, right after the person verifies their emailed OTP code —
  // this is what actually checks their phone+email against the pre-approved
  // list and claims the flat. See supabase/functions/register-household.
  const completeRegistration = async (phoneNumber: string) => {
    setRegistrationError(null);
    try {
      await registerHouseholdFn(phoneNumber);
      const { data } = await supabase.auth.refreshSession(); // pulls down the new flat_id claim
      setSession(data.session);
      setFlatId((data.session?.user.app_metadata.flat_id as string | undefined) ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'This phone number and email are not a registered flat.';
      setRegistrationError(message);
      await supabase.auth.signOut();
      setSession(null);
      setFlatId(null);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, flatId, loading, registrationError, completeRegistration, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
