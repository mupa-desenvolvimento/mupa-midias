import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export function PWAUpdatePrompt() {
  const { toast } = useToast();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        }).catch(() => {});
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => caches.delete(k));
        }).catch(() => {});
      }
      return;
    }
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      console.log('[PWA] Service Worker registrado:', registration);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (!cancelled) setNeedRefresh(true);
          } else if (newWorker.state === 'activated' && !navigator.serviceWorker.controller) {
            if (!cancelled) setOfflineReady(true);
          }
        });
      });
    }).catch((err) => {
      console.log('[PWA] SW not available:', err);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (offlineReady) {
      toast({
        title: "Pronto para uso offline",
        description: "O aplicativo está pronto para funcionar sem internet.",
      });
      setOfflineReady(false);
    }
  }, [offlineReady, toast]);

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: "Atualização disponível",
        description: (
          <div className="flex flex-col gap-2">
            <span>Uma nova versão está disponível.</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar agora
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNeedRefresh(false)}
              >
                Depois
              </Button>
            </div>
          </div>
        ),
        duration: 0,
      });
    }
  }, [needRefresh, toast]);

  return null;
}

export function InstallPrompt() {
  const { toast } = useToast();

  useEffect(() => {
    let deferredPrompt: BeforeInstallPromptEvent | null = null;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;

      toast({
        title: "Instalar aplicativo",
        description: (
          <div className="flex flex-col gap-2">
            <span>Instale o MupaMídias para acesso rápido e offline.</span>
            <Button
              size="sm"
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  console.log('[PWA] Instalação:', outcome);
                  deferredPrompt = null;
                }
              }}
              className="gap-1 w-fit"
            >
              <Download className="w-3 h-3" />
              Instalar
            </Button>
          </div>
        ),
        duration: 10000,
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [toast]);

  return null;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}
