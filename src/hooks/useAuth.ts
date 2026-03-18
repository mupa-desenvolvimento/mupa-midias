import { useState, useEffect } from 'react';
// @ts-ignore - platform version mismatch
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// @ts-ignore - platform version mismatch
const auth = supabase.auth as any;

export type AppRole = 'admin_global' | 'admin_regional' | 'admin_loja' | 'operador_conteudo' | 'tecnico';

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isAdminGlobal: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    isLoading: true,
    isAdmin: false,
    isAdminGlobal: false,
  });

  useEffect(() => {
    let cancelled = false;

    const isInvalidRefreshToken = (error: any) => {
      const message = String(error?.message ?? '');
      const name = String(error?.name ?? '');
      const status = Number(error?.status ?? 0);
      return (
        status === 400 &&
        (message.toLowerCase().includes('invalid refresh token') ||
          message.toLowerCase().includes('refresh token') ||
          name === 'AuthApiError')
      );
    };

    const resetAuthState = () => {
      setAuthState({
        user: null,
        session: null,
        roles: [],
        isLoading: false,
        isAdmin: false,
        isAdminGlobal: false,
      });
    };

    const { data: { subscription } } = auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          resetAuthState();
        }
      }
    );

    (async () => {
      const { data: { session }, error } = await auth.getSession();

      if (cancelled) return;

      if (error && isInvalidRefreshToken(error)) {
        await auth.signOut();
        if (cancelled) return;
        resetAuthState();
        return;
      }

      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;

      const roles = (data?.map(r => r.role) || []) as AppRole[];
      const isAdminGlobal = roles.includes('admin_global');
      const isAdmin = isAdminGlobal || roles.includes('admin_regional');

      setAuthState(prev => ({
        ...prev,
        roles,
        isAdmin,
        isAdminGlobal,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  };
}
