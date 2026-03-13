import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PlansSection } from "@/components/landing/PlansSection";
import { InkySection } from "@/components/landing/InkySection";
import { LeadFormModal, LeadFormType } from "@/components/landing/LeadFormModal";
import { theme } from "@/styles/theme";
import {
  Monitor,
  BarChart3,
  Image,
  Users,
  Play,
  Calendar,
  Wifi,
  Shield,
  Zap,
  Eye,
  Settings,
  Store,
  Layers,
  Video,
  CheckCircle2,
  ArrowRight,
  Brain,
  Smartphone,
  LucideIcon,
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
  WifiOff,
  ChevronsDown,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
} as const;

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
    },
  },
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return { r, g, b };
};

const headerRgb = hexToRgb(theme.colors.primaryDark);
const borderRgb = hexToRgb(theme.colors.grayLight);

const FadeInUp = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const Navbar = () => {
  const { scrollY } = useScroll();
  const { scrollYProgress } = useScroll();
  const backgroundOpacity = useTransform(scrollY, [0, 100], [0, 0.9]);
  const backdropBlur = useTransform(scrollY, [0, 100], ["0px", "10px"]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.1]);
  const logoSrc = "/logo-landing.svg";

  return (
    <motion.header
      style={{
        backgroundColor: useTransform(
          backgroundOpacity,
          (o) => `rgba(${headerRgb.r}, ${headerRgb.g}, ${headerRgb.b}, ${o})`
        ),
        backdropFilter: useTransform(backdropBlur, (b) => `blur(${b})`),
        borderBottom: useTransform(
          borderOpacity,
          (o) => `1px solid rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${o})`
        ),
      }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    >
      <motion.div 
        className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-accent via-primary to-secondary origin-left" 
        style={{ scaleX: scrollYProgress }} 
      />
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.img
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            src={logoSrc}
            alt="MupaMídias"
            className="h-10 scale-[1.15] origin-left transition-transform group-hover:scale-[1.2]"
          />
        </Link>
        <div className="flex items-center space-x-6">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-foreground/80">
            {[
              { href: "#features", label: "Recursos" },
              { href: "#ai", label: "Inteligência Artificial" },
              { href: "#inky", label: "Inky" },
              { href: "#analytics", label: "Analytics" },
              { href: "#plans", label: "Planos" },
            ].map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground transition-colors relative group py-1">
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hidden md:block">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">Entrar</Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:bg-accent/10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-sidebar border-border text-foreground pt-20">
                <nav className="flex flex-col gap-6">
                  <a href="#features" className="text-xl font-medium hover:text-accent transition-colors">
                    Recursos
                  </a>
                  <a href="#ai" className="text-xl font-medium hover:text-accent transition-colors">
                    Inteligência Artificial
                  </a>
                  <a href="#inky" className="text-xl font-medium hover:text-accent transition-colors">
                    Inky 🐙
                  </a>
                  <a href="#analytics" className="text-xl font-medium hover:text-accent transition-colors">
                    Analytics
                  </a>
                  <a href="#plans" className="text-xl font-medium hover:text-accent transition-colors">
                    Planos
                  </a>
                  <Link to="/auth" className="w-full pt-4">
                    <Button className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
                      Entrar
                    </Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

const Hero = () => {
  const [leadFormType, setLeadFormType] = useState<LeadFormType | null>(null);
  const [heroVideos, setHeroVideos] = useState<string[]>([]);
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/hero_videos/manifest.json", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as unknown;
      })
      .then((data) => {
        if (cancelled) return;
        const list = (data as any)?.videos;
        if (Array.isArray(list) && list.every((v) => typeof v === "string")) {
          setHeroVideos(list);
          setHeroVideoIndex(0);
          return;
        }
        setHeroVideos(["/hero_videos/IMG_4595.mp4"]);
        setHeroVideoIndex(0);
      })
      .catch(() => {
        if (cancelled) return;
        setHeroVideos(["/hero_videos/IMG_4595.mp4"]);
        setHeroVideoIndex(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = heroVideoRef.current;
    if (!el) return;
    el.load();
    const p = el.play();
    if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => undefined);
  }, [heroVideoIndex, heroVideos]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <LeadFormModal isOpen={!!leadFormType} onClose={() => setLeadFormType(null)} type={leadFormType || "general"} />
      {/* Background Elements */}
      <div className="absolute inset-0 bg-black">
        <video
          ref={heroVideoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={heroVideos[heroVideoIndex] ?? "/hero_videos/IMG_4595.mp4"}
          autoPlay
          muted
          loop={heroVideos.length <= 1}
          playsInline
          preload="metadata"
          onEnded={() => {
            if (heroVideos.length <= 1) return;
            setHeroVideoIndex((idx) => (idx + 1) % heroVideos.length);
          }}
          onError={() => {
            if (heroVideos.length <= 1) return;
            setHeroVideoIndex((idx) => (idx + 1) % heroVideos.length);
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(8,92,240,0.22),transparent_55%)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100vh-5rem)]">
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/35 border border-white/15 mb-7 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-white/85">A nova infraestrutura de mídia para o varejo</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl md:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight text-white"
          >
            <span className="text-[#AFE9FD]">
              Digital signage, retail media e trade marketing
            </span>
            <br />
            em uma única plataforma
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg sm:text-xl text-white/75 mb-10 max-w-3xl mx-auto leading-relaxed">
            Monetize TVs no ponto de venda, gerencie campanhas e transforme telas em canais de comunicação e receita — da loja ao corporativo.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button
              size="lg"
              onClick={() => setLeadFormType("general")}
              className="w-full sm:w-auto min-h-[3.5rem] h-auto py-4 px-6 sm:px-10 text-base sm:text-lg rounded-full bg-primary hover:bg-primary/90 border-0 shadow-lg shadow-black/30 whitespace-normal leading-tight text-primary-foreground"
            >
              <Zap className="mr-2 h-5 w-5 fill-current shrink-0" />
              <span>Começar Agora</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLeadFormType("demo")}
              className="w-full sm:w-auto min-h-[3.5rem] h-auto py-4 px-6 sm:px-10 text-base sm:text-lg rounded-full border-white/30 bg-black/20 hover:bg-black/30 text-white backdrop-blur-sm whitespace-normal leading-tight"
            >
              <Play className="mr-2 h-5 w-5 shrink-0" />
              <span>Ver demo</span>
            </Button>
          </motion.div>

          {/* Floating Elements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-20 group"
            onClick={() => {
              const featuresSection = document.getElementById('features');
              if (featuresSection) {
                featuresSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <span className="text-xs text-white/70 group-hover:text-white transition-colors font-medium tracking-widest uppercase">
              Descubra Mais
            </span>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="p-2 rounded-full bg-black/30 border border-white/15 group-hover:bg-black/40 group-hover:border-white/25 transition-all backdrop-blur-sm"
            >
              <ChevronsDown className="w-5 h-5 text-white" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Hero Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 1, delay: 0.2, type: "spring" }}
          className="hidden"
        >
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 rounded-2xl overflow-hidden shadow-2xl shadow-accent/20 border border-border/40 bg-sidebar/70 backdrop-blur-xl transform rotate-y-12 transition-transform duration-500 hover:rotate-y-0"
          >
            {/* Header do Dashboard */}
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/10 to-primary/10 pointer-events-none" />
            <div className="border-b border-border/30 bg-card/20 p-4 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sidebar/60 border border-border/40">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-mono">dashboard.mupa.ai</span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/30 relative overflow-hidden group hover:border-accent/50 transition-all">
                  <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Users className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Audiência Total</div>
                  <div className="text-2xl font-bold text-foreground flex items-baseline gap-2">
                    12.4k
                    <span className="text-xs text-green-400 flex items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                      <TrendingUp className="w-3 h-3 mr-1" /> +12%
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full bg-card/30 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "65%" }}
                      transition={{ duration: 1.5, delay: 0.5 }}
                      className="h-full bg-accent" 
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 relative overflow-hidden group hover:border-primary/50 transition-all">
                  <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Monitor className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">Displays Ativos</div>
                  <div className="text-2xl font-bold text-foreground flex items-baseline gap-2">
                    142
                    <span className="text-xs text-secondary flex items-center bg-secondary/10 px-1.5 py-0.5 rounded">
                      98% Online
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[1,1,1,1,0].map((s, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${s ? 'bg-accent' : 'bg-card/40'}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Chart Area */}
              <div className="p-4 rounded-xl bg-card/20 border border-border/30 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground/90">Engajamento por Hora</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-[10px] text-muted-foreground">Hoje</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between gap-1 h-32 pt-4 border-t border-border/30">
                  {[35, 55, 45, 70, 60, 85, 95, 75, 60, 50, 65, 80].map((h, i) => (
                    <div key={i} className="w-full bg-card/30 hover:bg-card/40 rounded-sm relative group cursor-pointer transition-colors">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.05 }}
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary to-accent rounded-sm group-hover:from-primary/90 group-hover:to-accent/90 transition-all"
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-sidebar text-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border/40">
                        {h * 12} views
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inky Assistant Widget */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  borderColor: [
                    `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, 0.2)`,
                    "rgba(8,92,240,0.55)",
                    `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, 0.2)`
                  ]
                }}
                transition={{ 
                  opacity: { delay: 1.5 },
                  y: { delay: 1.5 },
                  borderColor: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }
                }}
                className="bg-gradient-to-r from-primary/40 to-sidebar/80 p-3 rounded-xl border border-border/40 flex items-start gap-3 relative overflow-hidden shadow-lg shadow-accent/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-secondary/10" />
                <div className="relative z-10 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 border border-accent/30">
                  <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                    <Sparkles className="w-4 h-4 text-accent" />
                  </motion.div>
                </div>
                <div className="relative z-10 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-secondary">Inky Assistant</span>
                    <span className="text-[10px] text-muted-foreground">Agora mesmo</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Detectei um aumento de <span className="text-foreground font-medium">jovens (18-24)</span> na Loja Centro. Sugiro ativar a campanha "Tech Week" agora.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-1 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/30 text-[10px] text-secondary transition-colors">
                      Aplicar Sugestão
                    </button>
                    <button className="px-3 py-1 rounded-md bg-card/20 hover:bg-card/30 border border-border/30 text-[10px] text-muted-foreground transition-colors">
                      Ignorar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Floating Live Indicator */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 bg-sidebar/80 backdrop-blur-md border border-border/40 p-3 rounded-xl shadow-2xl z-20 flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute inset-0 opacity-75" />
              <div className="w-3 h-3 rounded-full bg-red-500 relative z-10" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground uppercase tracking-wider">Ao Vivo</div>
              <div className="text-[10px] text-muted-foreground">Monitorando...</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const Features = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const features = [
    {
      icon: Brain,
      title: "Visão Computacional Avançada",
      description:
        "Nossa IA detecta idade, gênero e emoções de quem olha para a tela, permitindo métricas precisas de audiência sem violar a privacidade.",
    },
    {
      icon: Zap,
      title: "Mídia Programática Real-Time",
      description:
        "O conteúdo muda instantaneamente quando seu público-alvo se aproxima. Mostre o anúncio certo para a pessoa certa no momento exato.",
    },
    {
      icon: Search,
      title: "Terminal de Consulta Inteligente",
      description:
        "Muito mais que preço. Ao ler um código de barras, exiba vídeos, avaliações e produtos relacionados para aumentar o ticket médio.",
    },
    {
      icon: WifiOff,
      title: "Operação Offline-First",
      description:
        "Sua rede nunca para. O player baixa todo o conteúdo e continua rodando perfeitamente mesmo se a internet cair por dias.",
    },
    {
      icon: Monitor,
      title: "Gestão de Dispositivos Remota",
      description:
        "Comandos de reboot, atualização de app, limpeza de cache e logs em tempo real, tudo controlado pelo painel administrativo.",
    },
    {
      icon: BarChart3,
      title: "Analytics de Atenção",
      description:
        "Saiba exatamente quanto tempo as pessoas olham para cada anúncio e qual a efetividade real das suas campanhas em cada ponto de venda.",
    },
  ];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % features.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + features.length) % features.length);
  };

  return (
    <section id="features" className="py-12 md:py-24 bg-sidebar relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Poderoso. Simples. <span className="text-accent">Inteligente.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Uma suíte completa de ferramentas projetada para escalar sua operação de digital signage.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 z-10 p-2 rounded-full bg-card/30 hover:bg-card/40 text-foreground transition-all backdrop-blur-sm border border-border/30"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 z-10 p-2 rounded-full bg-card/30 hover:bg-card/40 text-foreground transition-all backdrop-blur-sm border border-border/30"
            aria-label="Próximo"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* Carousel Content */}
          <div className="overflow-hidden px-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-sm shadow-2xl shadow-purple-900/10"
              >
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                  <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 flex items-center justify-center shrink-0 border border-white/10 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                    {(() => {
                      const Icon = features[currentIndex].icon;
                      return <Icon className="w-16 h-16 md:w-24 md:h-24 text-white" strokeWidth={1.5} />;
                    })()}
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                      <span className="text-sm font-mono text-purple-400">
                        {String(currentIndex + 1).padStart(2, '0')} / {String(features.length).padStart(2, '0')}
                      </span>
                      <div className="h-px w-12 bg-purple-500/50" />
                    </div>
                    
                    <h3 className="text-2xl md:text-4xl font-bold text-white mb-4">
                      {features[currentIndex].title}
                    </h3>
                    <p className="text-lg text-white/70 leading-relaxed">
                      {features[currentIndex].description}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots Indicators */}
          <div className="flex justify-center gap-2 mt-8">
            {features.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-8 bg-purple-500" : "bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const AISection = () => {
  return (
    <section id="ai" className="py-12 md:py-24 bg-[#050505] relative overflow-hidden">
      {/* Background Glow */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px]" 
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <FadeInUp>
            <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium mb-6">
              MUPA AI Vision
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Sua tela agora tem <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                olhos inteligentes
              </span>
            </h2>
            <p className="text-lg text-white/70 mb-8 leading-relaxed">
              Não apenas exiba conteúdo. Entenda como ele performa. Nossa tecnologia de visão computacional analisa
              anonimamente quem está olhando para sua tela em tempo real.
            </p>

            <div className="space-y-6">
              {[
                { title: "Detecção de Emoções", desc: "Saiba se seu público está feliz, surpreso ou neutro." },
                { title: "Demografia em Tempo Real", desc: "Identifique idade e gênero para segmentar anúncios." },
                { title: "Mapa de Calor de Atenção", desc: "Descubra quais áreas da tela chamam mais atenção." },
              ].map((item, i) => (
                <FadeInUp key={i} delay={i * 0.1} className="flex gap-4 group cursor-default">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-purple-500/50 group-hover:bg-purple-500/10 transition-all duration-300">
                    <Eye className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg group-hover:text-purple-300 transition-colors">{item.title}</h4>
                    <p className="text-white/70">{item.desc}</p>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </FadeInUp>

          <div className="relative">
            <FadeInUp delay={0.2}>
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group hover:shadow-purple-500/20 transition-all duration-500">
                {/* Simulated Camera Feed UI */}
                <div className="aspect-video bg-gray-900 relative overflow-hidden">
                  <img src="/terminal-woman.jpg" alt="Crowd Analysis" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                  {/* AI Overlays */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-green-500/80 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  >
                    <div className="absolute -top-6 left-0 flex gap-2">
                      <div className="bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                        Mulher, 25-34
                      </div>
                      <div className="bg-green-500/20 backdrop-blur-md text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30">
                        98% Conf.
                      </div>
                    </div>
                    {/* Face landmarks mock */}
                    <div className="absolute top-1/3 left-1/4 w-1 h-1 bg-green-400 rounded-full opacity-80" />
                    <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-green-400 rounded-full opacity-80" />
                    <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-400 rounded-full opacity-80" />
                  </motion.div>

                  {/* Scan Line Animation */}
                  <motion.div
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 w-full h-px bg-accent shadow-[0_0_20px_rgba(8,92,240,0.8)] opacity-50"
                  />
                </div>

                {/* Data Panel */}
                <div className="bg-sidebar/70 backdrop-blur-md p-4 border-t border-border/40 grid grid-cols-3 gap-4 divide-x divide-border/40">
                  <div className="text-center px-2">
                    <div className="text-2xl font-bold text-foreground mb-1">42</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Pessoas</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="text-2xl font-bold text-green-400 mb-1">8.5s</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Tempo Médio</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="text-2xl font-bold text-accent mb-1">Happy</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Emoção</div>
                  </div>
                </div>
              </div>
            </FadeInUp>
          </div>
        </div>
      </div>
    </section>
  );
};

const Index = () => {
  const logoSrc = "/logo-landing.svg";
  const whatsappPhoneE164 = "5551995643344";
  const whatsappHref = `https://wa.me/${whatsappPhoneE164}?text=${encodeURIComponent(
    "Olá! Gostaria de saber mais sobre a Mupa."
  )}`;
  const phoneDisplay = "(51) 99564-3344";
  const phoneTelHref = `tel:+${whatsappPhoneE164}`;
  const email = "contato@mupa.app";
  const year = new Date().getFullYear();

  return (
    <div className="dark min-h-screen bg-sidebar text-foreground selection:bg-accent/30">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <AISection />
        <InkySection />
        <PlansSection />
      </main>

      <footer className="py-10 md:py-14 border-t border-border/40 bg-sidebar">
        <FadeInUp className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <img
                  src={logoSrc}
                  alt="MupaMídias"
                  className="h-9 scale-[1.15] origin-left opacity-80 grayscale hover:grayscale-0 transition-all"
                />
              </div>

              <p className="text-sm text-muted-foreground max-w-xl">
                Plataforma completa de digital signage com inteligência de público, conteúdo automatizado e analytics para transformar telas em resultados.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageSquare />
                    Falar no WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <a href={`mailto:${email}`}>
                    Enviar email
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold text-foreground">Produto</div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
                <a href="#ai" className="hover:text-foreground transition-colors">Inteligência Artificial</a>
                <a href="#inky" className="hover:text-foreground transition-colors">Inky</a>
                <a href="#plans" className="hover:text-foreground transition-colors">Planos</a>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold text-foreground">Contato</div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href={phoneTelHref} className="hover:text-foreground transition-colors">
                  {phoneDisplay}
                </a>
                <a href={`mailto:${email}`} className="hover:text-foreground transition-colors">
                  {email}
                </a>
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
                  WhatsApp: {phoneDisplay}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              © {year} Mupa Desenvolvimento de Solucoes Tecnologicas Ltda — Todos os direitos reservados.
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a href={`mailto:${email}?subject=${encodeURIComponent("Privacidade")}`} className="hover:text-foreground transition-colors">
                Privacidade
              </a>
              <a href={`mailto:${email}?subject=${encodeURIComponent("Termos de uso")}`} className="hover:text-foreground transition-colors">
                Termos
              </a>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
                Suporte
              </a>
            </div>
          </div>
        </FadeInUp>
      </footer>
    </div>
  );
};

export default Index;
