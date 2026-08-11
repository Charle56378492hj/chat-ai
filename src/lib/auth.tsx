import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Merchant } from './types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  merchant: Merchant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshMerchant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const skipMerchantLoad = useRef(false);

  async function loadMerchant(uid: string): Promise<Merchant | null> {
    const { data: mId, error: rpcErr } = await supabase.rpc('get_or_create_merchant');
    if (rpcErr || !mId) {
      // eslint-disable-next-line no-console
      console.error('get_or_create_merchant failed:', rpcErr?.message);
      setMerchant(null);
      return null;
    }
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', mId as string)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('merchant select failed:', error.message);
      setMerchant(null);
      return null;
    }
    const m = data as Merchant | null;
    setMerchant(m);
    return m;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadMerchant(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setMerchant(null);
        setLoading(false);
        return;
      }

      if (newSession?.user) {
        if (skipMerchantLoad.current) {
          setLoading(false);
          return;
        }
        loadMerchant(newSession.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, metadata: Record<string, string>) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMerchant(null);
  }

  async function refreshMerchant() {
    if (user) await loadMerchant(user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user, merchant, loading, signIn, signUp, signOut, refreshMerchant }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
