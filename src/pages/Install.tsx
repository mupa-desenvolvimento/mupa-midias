import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { 
  Download, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Monitor, 
  CheckCircle2,
  RefreshCw,
  CloudOff,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const Install = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erro na instalação:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const features = [
    {
      icon: CloudOff,
      title: "Funciona Offline",
      description: "Acesse o aplicativo mesmo sem internet. Dados são sincronizados automaticamente."
    },
    {
      icon: Zap,
      title: "Acesso Rápido",
      description: "Inicie diretamente da tela inicial do seu dispositivo, como um app nativo."
    },
    {
      icon: RefreshCw,
      title: "Atualizações Automáticas",
      description: "Receba as últimas versões automaticamente, sem precisar reinstalar."
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Status de conexão */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full w-fit mx-auto ${
          isOnline ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <img 
            src="https://storage.googleapis.com/gpt-engineer-file-uploads/kqrRuPz304ckV2bn5HmQpveeQQo1/uploads/1762457442618-Logo_branca_vertical.png"
            alt="MupaMídias"
            className={`w-24 h-24 mx-auto ${resolvedTheme === 'light' ? 'invert' : ''}`}
          />
          <p className="text-muted-foreground">
            Sistema de Digital Signage com IA
          </p>
        </div>

        {/* Install Card */}
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {isInstalled ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Aplicativo Instalado
                </>
              ) : (
                <>
                  <Download className="w-6 h-6" />
                  Instalar Aplicativo
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isInstalled 
                ? "O MupaMídias está instalado e pronto para uso offline."
                : "Instale o MupaMídias para acesso rápido e funcionamento offline."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 text-green-500 p-4 rounded-lg text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-medium">Tudo pronto!</p>
                  <p className="text-sm opacity-80">
                    Você pode acessar o app pela tela inicial do seu dispositivo.
                  </p>
                </div>
                <Button onClick={() => navigate('/')} className="w-full">
                  Ir para o Dashboard
                </Button>
              </div>
            ) : deferredPrompt ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Smartphone className="w-8 h-8 text-primary" />
                    <span className="text-xs text-muted-foreground">Mobile</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Monitor className="w-8 h-8 text-primary" />
                    <span className="text-xs text-muted-foreground">Desktop</span>
                  </div>
                </div>
                <Button 
                  onClick={handleInstall} 
                  className="w-full gap-2"
                  disabled={isInstalling}
                >
                  {isInstalling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Instalando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Instalar Agora
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground space-y-2">
                <p className="text-sm">
                  A instalação não está disponível neste navegador.
                </p>
                <p className="text-xs">
                  Use Chrome, Edge ou Safari no iOS para instalar o aplicativo.
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg text-left text-sm">
                  <p className="font-medium mb-2">Como instalar manualmente:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Chrome/Edge:</strong> Menu → Instalar app</li>
                    <li>• <strong>Safari iOS:</strong> Compartilhar → Adicionar à Tela Inicial</li>
                    <li>• <strong>Firefox:</strong> Menu → Instalar</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card/50">
              <CardContent className="pt-6 text-center">
                <feature.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Back link */}
        <div className="text-center">
          <Button variant="link" onClick={() => navigate('/')}>
            Voltar para o site
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
