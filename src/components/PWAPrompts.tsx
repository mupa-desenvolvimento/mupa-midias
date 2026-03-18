import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, X, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAUpdatePrompt() {
  const { toast } = useToast();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  const showBanner = needRefresh && !dismissed;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] px-3 py-2 sm:px-4 sm:py-3"
        >
          <div className="max-w-4xl mx-auto rounded-b-xl border border-accent/30 bg-accent/10 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Nova versão disponível!
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Atualize para acessar os novos recursos e melhorias.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </Button>
                <button
                  onClick={() => setDismissed(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
