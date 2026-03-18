import { useEffect, useState, useRef } from 'react';
// @ts-ignore - platform version mismatch
import type { Session } from '@supabase/supabase-js';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CanvaCallback() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const [status, setStatus] = useState<'processing' | 'waiting_session' | 'success' | 'error'>('processing');
   const hasProcessed = useRef(false);
   const [errorMessage, setErrorMessage] = useState<string>('');
 
   // First effect: Wait for session to be ready
   useEffect(() => {
     const code = searchParams.get('code');
     const state = searchParams.get('state');
     const error = searchParams.get('error');
 
     // Check for OAuth errors immediately
    if (error) {
      console.error('[Canva Callback] OAuth error:', error);
      setStatus('error');
      const errorDesc = searchParams.get('error_description');
      setErrorMessage(errorDesc ? `Erro: ${error} - ${errorDesc}` : `Erro: ${error} - Autorização cancelada ou negada pelo Canva`);
      return;
    }
 
     if (!code || !state) {
       console.error('[Canva Callback] Missing code or state');
       setStatus('error');
       setErrorMessage('Parâmetros de callback inválidos');
       return;
     }
 
     // Wait for session with retry logic
     setStatus('waiting_session');
   }, [searchParams]);
 
   // Second effect: Process callback once we have params
   useEffect(() => {
     if (status !== 'waiting_session' || hasProcessed.current) return;
 
     const processCallback = async () => {
       const code = searchParams.get('code');
       const state = searchParams.get('state');
 
       if (!code || !state) {
         return;
       }
 
        // Retry getting a valid session for up to 5 seconds
        let session: Session | null = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!session && attempts < maxAttempts) {
          const { data } = await (supabase.auth as any).getSession();
          let currentSession = data.session;

          if (currentSession?.expires_at && currentSession.expires_at * 1000 <= Date.now() + 60_000) {
            const { data: refreshedData } = await (supabase.auth as any).refreshSession();
            currentSession = refreshedData.session;
          }

          if (currentSession) {
            const { data: userData, error: userError } = await (supabase.auth as any).getUser();

            if (!userError && userData.user) {
              session = currentSession;
              break;
            }

            const { data: refreshedData } = await supabase.auth.refreshSession();
            currentSession = refreshedData.session;

            if (currentSession) {
              const { data: refreshedUserData, error: refreshedUserError } = await supabase.auth.getUser();
              if (!refreshedUserError && refreshedUserData.user) {
                session = currentSession;
                break;
              }
            }
          }

          attempts++;
          console.log(`[Canva Callback] Waiting for valid session... attempt ${attempts}/${maxAttempts}`);
          await new Promise(r => setTimeout(r, 500));
        }

        if (!session) {
          console.error('[Canva Callback] No session found after retries');
          setStatus('error');
          setErrorMessage('Sessão expirada. Por favor, faça login novamente.');
          return;
        }

        const activeSession = session;
        hasProcessed.current = true;
        setStatus('processing');

        try {
          // Exchange the code for tokens
          // Use window.location.origin to match the redirect URI used in get_auth_url
          const redirectUri = `${window.location.origin}/admin/canva/callback`;

          console.log('[Canva Callback] Exchanging code for tokens with redirect_uri:', redirectUri);

          const exchangeRequest = async (accessToken: string) => {
            return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canva-auth?action=exchange_code`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code,
                state,
                redirect_uri: redirectUri,
              }),
            });
          };

          let response = await exchangeRequest(activeSession.access_token);
        let result = await response.json();

        if (response.status === 401) {
          const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshedSessionData.session) {
            response = await exchangeRequest(refreshedSessionData.session.access_token);
            result = await response.json();
          }
        }
 
         if (result.success) {
           console.log('[Canva Callback] Token exchange successful');
           setStatus('success');
           // Redirect to Canva integration page after a short delay
           setTimeout(() => {
             navigate('/admin/canva', { replace: true });
           }, 1500);
         } else {
           console.error('[Canva Callback] Token exchange failed:', result.error);
           setStatus('error');
           setErrorMessage(result.error || 'Falha ao trocar código por tokens');
         }
       } catch (error) {
         console.error('[Canva Callback] Error processing callback:', error);
         setStatus('error');
         setErrorMessage('Erro ao processar callback do Canva');
       }
     };
 
     processCallback();
   }, [status, searchParams, navigate]);
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-background p-4">
       <Card className="w-full max-w-md">
         <CardHeader className="text-center">
           <CardTitle className="flex items-center justify-center gap-2">
             {status === 'processing' && (
               <>
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                 Conectando ao Canva...
               </>
             )}
             {status === 'waiting_session' && (
               <>
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                 Restaurando sessão...
               </>
             )}
             {status === 'success' && (
               <>
                <CheckCircle2 className="h-6 w-6 text-primary" />
                 Conectado com sucesso!
               </>
             )}
             {status === 'error' && (
               <>
                 <XCircle className="h-6 w-6 text-destructive" />
                 Erro na conexão
               </>
             )}
           </CardTitle>
           <CardDescription>
             {status === 'processing' && 'Trocando código por tokens...'}
             {status === 'waiting_session' && 'Aguardando restauração da sessão...'}
             {status === 'success' && 'Você será redirecionado em instantes...'}
             {status === 'error' && errorMessage}
           </CardDescription>
         </CardHeader>
         {status === 'error' && (
           <CardContent className="flex flex-col gap-3">
             <Button onClick={() => navigate('/admin/canva', { replace: true })}>
               Voltar para Integrações
             </Button>
             <Button variant="outline" onClick={() => navigate('/auth', { replace: true })}>
               Fazer Login Novamente
             </Button>
           </CardContent>
         )}
       </Card>
     </div>
   );
 }