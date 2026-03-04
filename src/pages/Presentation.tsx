import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Monitor, 
  Wifi, 
  WifiOff, 
  Users, 
  BarChart3, 
  Layers, 
  Store, 
  Smartphone,
  Eye,
  Brain,
  Zap,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Tv,
  ScanBarcode,
  Network,
  Lock,
  DollarSign,
  CheckCircle2,
  Play,
  XCircle,
  Trophy,
  HeartHandshake,
  QrCode,
  ShoppingBag,
  Edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
import logoHorizontal from "@/assets/logo_horizontal.svg";
import { Slide } from "@/types/presentation";
import { SlideEditor } from "@/components/presentation/SlideEditor";
import { usePresentationConfig } from "@/hooks/usePresentationConfig";
import { useTheme } from "@/hooks/useTheme";
import { INITIAL_SLIDES } from "@/data/presentation-slides";

// --- THEME SYSTEM ---
type Theme = {
  id: string;
  name: string;
  bg: string;
  bgEffects: React.ReactNode;
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  accentGradient: string;
  cardBg: string;
  cardBorder: string;
  cardHover: string;
  buttonPrimary: string;
  buttonSecondary: string;
  iconBg: string;
  iconColor: string;
  progressBar: string;
  font: string;
  logoClass: string;
};

const themes: Record<string, Theme> = {
  default: {
    id: "default",
    name: "MUPA Creative",
    bg: "bg-black",
    bgEffects: (
      <>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(120,0,255,0.2),transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(0,100,255,0.1),transparent_50%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
      </>
    ),
    textPrimary: "text-white",
    textSecondary: "text-gray-400",
    textAccent: "text-purple-400",
    accentGradient: "bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text",
    cardBg: "bg-white/5",
    cardBorder: "border-white/10",
    cardHover: "hover:bg-white/10 hover:border-purple-500/30",
    buttonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20",
    buttonSecondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    iconBg: "bg-white/5",
    iconColor: "text-purple-400",
    progressBar: "bg-gradient-to-r from-blue-500 to-purple-500",
    font: "selection:bg-purple-500/30 font-sans",
    logoClass: "brightness-0 invert"
  },
  neon: {
    id: "neon",
    name: "Tech Growth",
    bg: "bg-slate-950",
    bgEffects: (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
        <div className="absolute top-0 w-full h-full bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
      </>
    ),
    textPrimary: "text-emerald-50",
    textSecondary: "text-slate-400",
    textAccent: "text-emerald-400",
    accentGradient: "bg-gradient-to-r from-emerald-400 to-cyan-400 text-transparent bg-clip-text",
    cardBg: "bg-slate-900/60 backdrop-blur-md",
    cardBorder: "border-emerald-500/20",
    cardHover: "hover:border-emerald-500/50 hover:bg-slate-800/80 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]",
    buttonPrimary: "bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    buttonSecondary: "bg-slate-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    progressBar: "bg-gradient-to-r from-emerald-500 to-cyan-500",
    font: "selection:bg-emerald-500/30 font-sans tracking-tight",
    logoClass: "brightness-0 invert"
  },
  light: {
    id: "light",
    name: "Clean Enterprise",
    bg: "bg-slate-50",
    bgEffects: (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50" />
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50 to-transparent opacity-80" />
      </>
    ),
    textPrimary: "text-slate-900",
    textSecondary: "text-slate-500",
    textAccent: "text-blue-600",
    accentGradient: "bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text",
    cardBg: "bg-white",
    cardBorder: "border-slate-200",
    cardHover: "hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all duration-300",
    buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20",
    buttonSecondary: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    progressBar: "bg-blue-600",
    font: "selection:bg-blue-100 font-sans",
    logoClass: ""
  }
};


// Configuração dos slides removida daqui e movida para src/data/presentation-slides.ts

export default function Presentation() {
  const { resolvedTheme } = useTheme();
  const { config } = usePresentationConfig();

  const filterSlides = (cfg: typeof config) => {
    let slides = INITIAL_SLIDES.filter(slide => {
      if (slide.title === "MUPA LITE" && !cfg.showLite) return false;
      if (slide.title === "MUPA FLOW" && !cfg.showFlow) return false;
      if (slide.title === "MUPA INSIGHT" && !cfg.showInsight) return false;
      if (slide.title === "MUPA IMPACT" && !cfg.showImpact) return false;
      if (slide.layout === "comparison" && !cfg.showComparison) return false;
      return true;
    });

    if (cfg.slideOrder && cfg.slideOrder.length > 0) {
      slides.sort((a, b) => {
        const indexA = cfg.slideOrder.indexOf(a.id);
        const indexB = cfg.slideOrder.indexOf(b.id);
        
        // If slide is not in order array, put it at the end
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });
    }

    return slides;
  };

  const [slides, setSlides] = useState<Slide[]>(() => filterSlides(config));
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const filtered = filterSlides(config);
    setSlides(filtered);
    if (currentSlide >= filtered.length) {
      setCurrentSlide(Math.max(0, filtered.length - 1));
    }
  }, [config]);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [searchParams] = useSearchParams();
  
  const themeParam = searchParams.get("theme");
  
  // Map numeric theme params to theme IDs
  const themeMap: Record<string, string> = {
    "1": "default",
    "2": "neon",
    "3": "light"
  };

  const currentThemeId = themeParam && (themes[themeParam] || themeMap[themeParam]) 
    ? (themeMap[themeParam] || themeParam) 
    : (resolvedTheme === 'light' ? 'light' : 'default');
  
  const slide = slides[currentSlide];
  const theme = themes[currentThemeId];
  const logoSrc = currentThemeId === "light" ? "/logo_background_branco.png" : logoHorizontal;

  const handleUpdateSlide = (updatedSlide: Slide) => {
    const newSlides = [...slides];
    newSlides[currentSlide] = updatedSlide;
    setSlides(newSlides);
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: Math.max(...slides.map(s => s.id)) + 1,
      layout: "landing-hero",
      title: "Novo Slide",
      subtitle: "Subtítulo do Slide",
      description: "Descrição do novo slide.",
      points: ["Ponto 1", "Ponto 2"],
    };
    const newSlides = [...slides];
    newSlides.splice(currentSlide + 1, 0, newSlide);
    setSlides(newSlides);
    setCurrentSlide(currentSlide + 1);
    setIsEditorOpen(true); // Keep editor open for the new slide
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) return; // Prevent deleting the last slide
    const newSlides = slides.filter((_, index) => index !== currentSlide);
    setSlides(newSlides);
    if (currentSlide >= newSlides.length) {
      setCurrentSlide(newSlides.length - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);

  const nextSlide = () => {
    setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
  };

  const prevSlide = () => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  };

  // Variantes de Animação
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100
      }
    }
  };

  return (
    <div className={`h-screen w-screen overflow-hidden relative ${theme.bg} ${theme.textPrimary} ${theme.font} transition-colors duration-500`}>
      {/* Background Effects */}
      <div className="absolute inset-0 transition-opacity duration-500 pointer-events-none">
        {theme.bgEffects}
      </div>
      
      {/* Navigation Controls */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4">
        <span className={`${theme.textSecondary} font-mono text-sm`}>
          {currentSlide + 1} / {slides.length}
        </span>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsEditorOpen(true)}
            className={`rounded-full w-10 h-10 ${theme.buttonSecondary}`}
            title="Editar Slide"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={prevSlide} 
            disabled={currentSlide === 0}
            className={`rounded-full w-10 h-10 ${theme.buttonSecondary}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={nextSlide} 
            disabled={currentSlide === slides.length - 1}
            className={`rounded-full w-10 h-10 ${theme.buttonSecondary}`}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Slide Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentSlide}-${currentThemeId}`}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="h-full w-full flex flex-col p-6 md:p-8 lg:p-12 relative z-10"
        >
          {/* Header Comum */}
          <div className="flex justify-between items-center mb-6 shrink-0">
            <img src={logoSrc} alt="MUPA" className={`h-8 md:h-10 ${theme.logoClass} opacity-80`} />
            <div className={`flex items-center gap-2 ${theme.textSecondary} text-sm font-medium`}>
              {slide.icon && <slide.icon className="w-4 h-4" />}
              <span className="hidden md:inline">Apresentação Comercial</span>
            </div>
          </div>

          {/* Layout Switcher - Flex 1 to fill available space */}
          <div className="flex-1 flex flex-col justify-center w-full min-h-0 relative">
            
            {/* LANDING HERO LAYOUT */}
            {(slide.layout === "landing-hero" || slide.layout === "hero") && (
              <div className="grid lg:grid-cols-2 gap-12 items-center h-full max-w-[1800px] mx-auto w-full px-6">
                {/* Text column */}
                <div className="text-left z-10">
                  <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-medium text-gray-300">Nova Versão 2.0 Disponível</span>
                  </motion.div>
                  
                  <motion.h1 variants={itemVariants} className={`text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight ${theme.textPrimary}`}>
                    {slide.title.split('+')[0]} <br/>
                    <span className={`${theme.accentGradient} drop-shadow-lg`}>
                      {slide.subtitle || "Digital Signage"}
                    </span>
                  </motion.h1>
                  
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} mb-8 max-w-xl leading-relaxed`}>
                    {slide.description}
                  </motion.p>
                  
                  <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
                     <Button size="lg" className={`h-14 px-8 text-lg rounded-full border-0 ${theme.buttonPrimary} hover:scale-105 transition-transform duration-300 shadow-lg shadow-purple-500/20`} onClick={nextSlide}>
                        <Zap className="mr-2 h-5 w-5 fill-current" />
                        {slide.cta || "Começar Agora"}
                      </Button>
                      <Button size="lg" variant="outline" className={`h-14 px-8 text-lg rounded-full ${theme.cardBorder} bg-white/5 hover:bg-white/10 ${theme.textPrimary} backdrop-blur-sm`} onClick={nextSlide}>
                        <Play className="mr-2 h-5 w-5" />
                        Ver Demo
                      </Button>
                  </motion.div>
                </div>

                {/* Hero Visual */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: 1, delay: 0.2, type: "spring" }}
                  className="relative hidden lg:block perspective-1000"
                >
                  {slide.image ? (
                    <div className={`relative z-10 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 border ${theme.cardBorder} bg-black/50 backdrop-blur-xl transform rotate-y-12 transition-transform duration-500 hover:rotate-y-0 h-[600px]`}>
                      <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                  <div className={`relative z-10 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 border ${theme.cardBorder} bg-black/50 backdrop-blur-xl transform rotate-y-12 transition-transform duration-500 hover:rotate-y-0`}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 pointer-events-none" />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <div className="text-xs text-gray-500 font-mono">dashboard.mupa.ai</div>
                      </div>
                      
                      {/* Mock Dashboard UI */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="col-span-2 h-32 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/5 p-4 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <span className="text-xs text-green-400">+12%</span>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-white">1,248</div>
                            <div className="text-xs text-gray-400">Displays Ativos</div>
                          </div>
                        </div>
                        <div className="h-32 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-900/20 border border-purple-500/30 p-4 flex flex-col justify-between relative overflow-hidden">
                          <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
                          <Users className="w-5 h-5 text-purple-400 relative z-10" />
                          <div className="relative z-10">
                            <div className="text-2xl font-bold text-white">85k</div>
                            <div className="text-xs text-gray-400">Alcance Hoje</div>
                          </div>
                        </div>
                      </div>
                      <div className="h-40 rounded-lg bg-white/5 border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm font-medium text-gray-300">Audiência em Tempo Real</div>
                          <BarChart3 className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex items-end justify-between gap-2 h-24">
                          {[40, 65, 45, 80, 55, 70, 40, 60, 75, 50, 65, 85].map((h, i) => (
                            <motion.div 
                              key={i}
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              transition={{ duration: 1, delay: 0.5 + (i * 0.05) }}
                              className="w-full bg-blue-500/50 rounded-t-sm hover:bg-blue-400 transition-colors cursor-pointer" 
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                  
                  {/* Floating Elements */}
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-10 -right-10 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl z-20 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">IA Ativa</div>
                      <div className="text-xs text-gray-400">Detectando emoções...</div>
                    </div>
                  </motion.div>

                  <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-5 -left-5 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl z-20 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Wifi className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Sincronizado</div>
                      <div className="text-xs text-gray-400">Todos os dispositivos online</div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            )}

            {/* QR DEMO LAYOUT */}
            {slide.layout === "qr-demo" && (
              <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto text-center gap-12">
                <div className="space-y-6">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-sm font-medium">Demonstração Interativa</span>
                  </motion.div>
                  <motion.h2 variants={itemVariants} className={`text-5xl md:text-7xl font-black ${theme.textPrimary}`}>
                    {slide.title}
                  </motion.h2>
                  <motion.p variants={itemVariants} className={`text-2xl ${theme.textSecondary} max-w-2xl mx-auto`}>
                    {slide.description}
                  </motion.p>
                </div>

                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                  <div className="relative bg-white p-6 rounded-xl">
                     <QRCode 
                       value="https://mupa-midias.lovable.app/mobile-demo"
                      size={256}
                      level="H"
                    />
                  </div>
                  
                  {/* Scan me indicator */}
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-white font-bold flex flex-col items-center gap-2"
                  >
                    <ArrowRight className="w-6 h-6 rotate-[-90deg] text-purple-400" />
                    <span className="text-sm tracking-widest uppercase text-purple-300">Escaneie Agora</span>
                  </motion.div>
                </motion.div>

                <div className="grid grid-cols-3 gap-8 text-left mt-8 max-w-3xl">
                  {slide.items?.map((step: any, i: number) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + (i * 0.1) }}
                      className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder}`}
                    >
                      <div className={`w-10 h-10 rounded-full ${theme.iconBg} flex items-center justify-center mb-3`}>
                        {step.icon ? <step.icon className={`w-5 h-5 ${theme.iconColor}`} /> : <ScanBarcode className={`w-5 h-5 ${theme.iconColor}`} />}
                      </div>
                      <h4 className={`font-bold ${theme.textPrimary} mb-1`}>{step.title}</h4>
                      <p className={`text-sm ${theme.textSecondary}`}>{step.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* PROBLEM / FEATURE LIST LAYOUT */}
            {(slide.layout === "problem" || slide.layout === "feature-list") && (
              <div className="grid md:grid-cols-2 gap-8 items-center h-full max-w-[1600px] mx-auto overflow-hidden">
                <div className="flex flex-col justify-center h-full overflow-y-auto custom-scrollbar pr-2">
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-4 leading-tight ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.h3 variants={itemVariants} className={`text-xl md:text-2xl ${theme.textAccent} mb-6 font-light tracking-wide`}>{slide.subtitle}</motion.h3>
                  <motion.p variants={itemVariants} className={`text-lg ${theme.textSecondary} mb-8 leading-relaxed max-w-lg`}>{slide.description}</motion.p>
                </div>
                <div className="flex flex-col h-full justify-center gap-4 py-2 min-h-0">
                  <div className="space-y-3 shrink-0">
                    {slide.points?.map((point, i) => (
                      <motion.div
                        key={i}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, x: 10 }}
                        className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex items-center gap-4 ${theme.cardHover} transition-all duration-300 shadow-lg backdrop-blur-sm group`}
                      >
                        <div className={`w-3 h-3 rounded-full ${slide.layout === 'problem' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]'} shrink-0 group-hover:scale-125 transition-transform duration-300`} />
                        <span className={`text-lg font-medium ${theme.textPrimary} group-hover:translate-x-1 transition-transform`}>{point}</span>
                      </motion.div>
                    ))}
                  </div>
                  {slide.video && (
                    <motion.div
                      variants={itemVariants}
                      className={`rounded-2xl overflow-hidden border ${theme.cardBorder} bg-black relative w-full flex-1 min-h-0 flex items-center justify-center shadow-2xl`}
                    >
                      <video 
                        src={slide.video}
                        className="w-full h-full object-contain"
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                      />
                      <div className="absolute top-2 right-2 bg-black/60 text-xs px-2 py-1 rounded text-white/70 backdrop-blur-sm">
                        Exemplo Real
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* BENTO GRID LAYOUT (NEW) */}
            {slide.layout === "bento-grid" && (
              <div className="h-full flex flex-col justify-center max-w-[1400px] mx-auto w-full">
                <div className="text-center mb-8 shrink-0">
                   <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-2 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                   <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} max-w-2xl mx-auto`}>{slide.description}</motion.p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
                   {slide.features?.map((feat, i) => (
                     <motion.div
                       key={i}
                       variants={itemVariants}
                       className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col justify-between ${theme.cardHover} transition-all group ${i === 0 || i === 3 ? 'md:col-span-2' : ''}`}
                     >
                        <div className={`w-12 h-12 rounded-xl ${theme.iconBg} flex items-center justify-center mb-4 ${theme.iconColor} group-hover:scale-110 transition-transform`}>
                          {feat.icon ? <feat.icon className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                       </div>
                        <div>
                           <h3 className={`text-2xl font-bold mb-2 ${theme.textPrimary}`}>{feat.text}</h3>
                           <p className={`${theme.textSecondary} text-sm leading-relaxed`}>{feat.desc}</p>
                        </div>
                     </motion.div>
                   ))}
                </div>
              </div>
            )}

            {/* PLAN DETAILS LAYOUT (NEW) */}
            {slide.layout === "plan-details" && (
              <div className="h-full flex flex-col justify-center max-w-[1600px] mx-auto w-full px-6">
                <div className="text-center mb-6 shrink-0">
                   <motion.div 
                     variants={itemVariants}
                     className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${
                       slide.planTheme === 'zinc' ? 'bg-zinc-500/10 text-zinc-400' :
                       slide.planTheme === 'green' ? 'bg-green-500/10 text-green-400' :
                       slide.planTheme === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                       'bg-purple-500/10 text-purple-400'
                     }`}
                   >
                      {slide.icon && <slide.icon className="w-7 h-7" />}
                   </motion.div>
                   <motion.h2 variants={itemVariants} className={`text-4xl md:text-5xl font-black mb-2 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                   <motion.div 
                     variants={itemVariants}
                     className={`text-lg font-bold tracking-wider uppercase mb-4 ${
                       slide.planTheme === 'zinc' ? 'text-zinc-400' :
                       slide.planTheme === 'green' ? 'text-green-400' :
                       slide.planTheme === 'blue' ? 'text-blue-400' :
                       'text-purple-400'
                     }`}
                   >
                     {slide.subtitle}
                   </motion.div>
                   <motion.p variants={itemVariants} className={`text-lg ${theme.textSecondary} max-w-3xl mx-auto leading-relaxed`}>{slide.description}</motion.p>
                </div>

                {config.showDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
                   {slide.planDetails?.map((section, i) => (
                     <motion.div
                       key={i}
                       variants={itemVariants}
                       className={`p-4 rounded-xl border ${
                         slide.planTheme === 'zinc' ? 'bg-zinc-900/40 border-zinc-500/20' :
                         slide.planTheme === 'green' ? 'bg-green-900/20 border-green-500/20' :
                         slide.planTheme === 'blue' ? 'bg-blue-900/20 border-blue-500/20' :
                         'bg-purple-900/20 border-purple-500/20'
                       } backdrop-blur-sm hover:bg-opacity-80 transition-all`}
                     >
                        <h4 className={`text-base font-bold mb-2 flex items-center gap-2 ${theme.textPrimary}`}>
                          {section.title.includes("Inclui tudo") ? (
                            <span className={`${theme.textSecondary} italic`}>{section.title}</span>
                          ) : (
                            section.title
                          )}
                        </h4>
                        <ul className="space-y-2">
                          {section.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${
                                 slide.planTheme === 'zinc' ? 'text-zinc-500' :
                                 slide.planTheme === 'green' ? 'text-green-500' :
                                 slide.planTheme === 'blue' ? 'text-blue-500' :
                                 'text-purple-500'
                               }`} />
                              <span className="leading-tight text-sm">{item}</span>
                            </li>
                          ))}
                        </ul>
                     </motion.div>
                   ))}
                </div>
                )}
              </div>
            )}

            {/* IMMERSIVE SPLIT LAYOUT (NEW) */}
            {slide.layout === "immersive-split" && (
               <div className="absolute inset-0 flex flex-col md:flex-row h-full w-full">
                  {/* Left Content */}
                  <div className="w-full md:w-1/2 h-full p-8 md:p-16 flex flex-col justify-center relative z-10 bg-gradient-to-r from-black via-black/90 to-transparent">
                     <motion.div variants={itemVariants} className={`inline-block px-3 py-1 rounded-full ${theme.iconBg} ${theme.textAccent} text-xs font-bold tracking-wide mb-6 w-fit`}>
                        MUPA INTELLIGENCE
                     </motion.div>
                     <motion.h2 variants={itemVariants} className={`text-5xl md:text-7xl font-black mb-6 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                     <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} mb-10 max-w-md leading-relaxed`}>{slide.description}</motion.p>
                     
                     <div className="grid gap-6">
                        {slide.stats?.map((stat, i) => (
                           <motion.div key={i} variants={itemVariants} className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full ${theme.progressBar} flex items-center justify-center text-white font-bold`}>
                                 {i+1}
                              </div>
                              <div>
                                 <div className={`text-2xl font-bold ${theme.textPrimary}`}>{stat.label}</div>
                                 <div className={`text-sm ${theme.textSecondary}`}>{stat.value}</div>
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  </div>
                  
                  {/* Right Visual */}
                  <div className="absolute md:relative w-full md:w-1/2 h-full inset-0 z-0">
                     {slide.image && (
                        <div className="w-full h-full relative">
                           <img src={slide.image} alt="Immersive" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black via-transparent to-transparent" />
                           
                           {/* Face Detection Overlay Simulation */}
                           <motion.div 
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute top-1/3 right-1/3 w-32 h-32 border-2 border-green-400 rounded-lg shadow-[0_0_20px_rgba(74,222,128,0.5)]"
                           >
                              <div className="absolute -top-8 left-0 bg-green-500/90 text-black px-2 py-1 rounded text-xs font-mono">
                                 ID: 8492 • 98%
                              </div>
                           </motion.div>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* MINIMAL CENTERED LAYOUT (NEW) */}
            {slide.layout === "minimal-centered" && (
               <div className="h-full flex flex-col justify-center items-center text-center max-w-5xl mx-auto">
                  <motion.div 
                     variants={itemVariants}
                     className={`w-24 h-24 rounded-full ${theme.iconBg} flex items-center justify-center mb-8 ${theme.iconColor} shadow-2xl`}
                  >
                     {slide.icon && <slide.icon className="w-12 h-12" />}
                  </motion.div>
                  <motion.h2 variants={itemVariants} className={`text-6xl md:text-8xl font-black mb-8 ${theme.textPrimary} tracking-tight`}>
                     {slide.title}
                  </motion.h2>
                  <motion.h3 variants={itemVariants} className={`text-3xl md:text-4xl ${theme.textAccent} mb-8 font-light`}>
                     {slide.subtitle}
                  </motion.h3>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} mb-12 max-w-2xl`}>
                     {slide.description}
                  </motion.p>
                  {slide.cta && (
                     <motion.div variants={itemVariants}>
                        <Button size="lg" className={`h-16 px-12 text-xl rounded-full ${theme.buttonPrimary} hover:scale-105 transition-all shadow-xl`}>
                           {slide.cta} <ArrowRight className="ml-2 w-6 h-6" />
                        </Button>
                     </motion.div>
                  )}
               </div>
            )}

            {/* SOLUTION GRID */}
            {slide.layout === "solution" && (
              <div className="text-center h-full flex flex-col justify-center max-w-[1600px] mx-auto w-full">
                <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-4 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} max-w-4xl mx-auto mb-10 leading-relaxed font-light`}>{slide.description}</motion.p>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 min-h-0 content-center">
                  {slide.features?.map((feat, i) => (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col items-center gap-4 transition-all duration-300 ${theme.cardHover} backdrop-blur-md shadow-xl group h-full justify-center`}
                    >
                      <div className={`w-16 h-16 rounded-2xl ${theme.iconBg} flex items-center justify-center mb-2 ${theme.iconColor} border ${theme.cardBorder} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                        <feat.icon className="w-8 h-8" />
                      </div>
                      <span className={`text-lg font-bold ${theme.textPrimary}`}>{feat.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* GRID ITEMS */}
            {slide.layout === "grid" && (
              <div className="h-full flex flex-col justify-center max-w-[1600px] mx-auto w-full">
                <div className="text-center mb-10 shrink-0">
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-4 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} font-light`}>{slide.description}</motion.p>
                </div>
                <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2">
                  {slide.items?.map((item, i) => (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.08)" }}
                      className={`flex items-start gap-6 p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} transition-all cursor-pointer ${theme.cardHover} shadow-lg backdrop-blur-md group`}
                    >
                      <div className={`w-14 h-14 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0 border ${theme.cardBorder} group-hover:rotate-6 transition-transform duration-300`}>
                        <item.icon className={`w-7 h-7 ${theme.iconColor}`} />
                      </div>
                      <div>
                        <h4 className={`text-xl font-bold mb-2 ${theme.textPrimary}`}>{item.title}</h4>
                        <p className={`text-base ${theme.textSecondary} leading-relaxed`}>{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* VIDEO SHOWCASE */}
            {slide.layout === "video-showcase" && (
              <div className="grid lg:grid-cols-2 gap-8 items-center h-full max-w-[1600px] mx-auto w-full">
                <div className="flex flex-col justify-center">
                  <motion.div variants={itemVariants} className={`inline-block px-3 py-1 rounded-full ${theme.iconBg} ${theme.textAccent} text-sm font-medium mb-4 w-fit`}>
                    Performance Real
                  </motion.div>
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-5xl font-bold mb-4 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.h3 variants={itemVariants} className={`text-2xl ${theme.textAccent} mb-4`}>{slide.subtitle}</motion.h3>
                  <motion.p variants={itemVariants} className={`text-lg ${theme.textSecondary} mb-8 leading-relaxed`}>{slide.description}</motion.p>
                  
                  <motion.div variants={itemVariants} className="flex gap-4">
                    <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} text-center w-32`}>
                      <span className={`block text-2xl font-bold ${theme.textPrimary} mb-1`}>60fps</span>
                      <span className={`text-xs ${theme.textSecondary}`}>Fluidez</span>
                    </div>
                    <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} text-center w-32`}>
                      <span className={`block text-2xl font-bold ${theme.textPrimary} mb-1`}>4K</span>
                      <span className={`text-xs ${theme.textSecondary}`}>Resolução</span>
                    </div>
                  </motion.div>
                </div>
                <motion.div 
                  variants={itemVariants}
                  className={`relative rounded-3xl overflow-hidden border ${theme.cardBorder} shadow-2xl bg-black w-full flex-1 h-full min-h-[40vh] max-h-[70vh] flex items-center justify-center`}
                >
                  {slide.video && (
                    <video 
                      src={slide.video} 
                      className="w-full h-full object-contain" 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-medium text-white">Live Preview</span>
                  </div>
                </motion.div>
              </div>
            )}

            {/* COMPARISON */}
            {slide.layout === "comparison" && (
              <div className="text-center h-full flex flex-col max-w-[1600px] mx-auto w-full">
                <div className="mb-8 shrink-0">
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-4 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} font-light`}>{slide.description}</motion.p>
                </div>
                
                <div className="flex-1 grid md:grid-cols-2 gap-8 min-h-0 relative pb-4">
                   {/* VS Badge */}
                   <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex w-16 h-16 rounded-full bg-white text-black items-center justify-center font-black text-xl border-4 border-black shadow-2xl">
                     VS
                   </div>

                  {/* Left: Competitor */}
                  <motion.div 
                    variants={itemVariants}
                    className={`relative group rounded-[2rem] overflow-hidden border ${theme.cardBorder} ${theme.cardBg} flex flex-col h-full shadow-2xl transition-transform hover:scale-[1.01] duration-500`}
                  >
                    <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent p-6 z-10 flex justify-between items-start">
                      <Badge variant="outline" className="border-red-500/50 text-red-400 bg-red-500/10 px-4 py-1 text-base backdrop-blur-md">
                        {slide.comparison?.left.label}
                      </Badge>
                      <XCircle className="w-8 h-8 text-red-500 drop-shadow-lg" />
                    </div>
                    <div className="flex-1 relative bg-black flex items-center justify-center p-6 grayscale group-hover:grayscale-0 transition-all duration-700">
                      <img 
                        src={slide.comparison?.left.image} 
                        alt="Concorrente" 
                        className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-500 rounded-lg" 
                      />
                    </div>
                  </motion.div>

                  {/* Right: MUPA */}
                  <motion.div 
                    variants={itemVariants}
                    className={`relative group rounded-[2rem] overflow-hidden border-2 ${currentThemeId === 'neon' ? 'border-emerald-500/50' : 'border-green-500/30'} ${theme.cardBg} flex flex-col shadow-2xl shadow-green-900/20 h-full hover:scale-[1.01] transition-transform duration-500`}
                  >
                    <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent p-6 z-10 flex justify-between items-start">
                      <Badge variant="default" className={`${currentThemeId === 'neon' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700'} text-white border-none px-4 py-1 text-base shadow-lg shadow-green-500/20`}>
                        {slide.comparison?.right.label}
                      </Badge>
                      <CheckCircle2 className={`w-8 h-8 ${currentThemeId === 'neon' ? 'text-emerald-500' : 'text-green-500'} drop-shadow-lg`} />
                    </div>
                    <div className="flex-1 relative bg-black flex items-center justify-center p-6">
                      <img 
                        src={slide.comparison?.right.image} 
                        alt="MUPA" 
                        className="w-full h-full object-contain opacity-100 transition-opacity duration-500 rounded-lg" 
                      />
                    </div>
                  </motion.div>
                </div>
              </div>
            )}

            {/* VISUAL RIGHT (AI) */}
            {slide.layout === "visual-right" && (
              <div className="grid lg:grid-cols-2 gap-8 items-center h-full max-w-[1600px] mx-auto overflow-hidden">
                <div className="flex flex-col justify-center">
                  <motion.div variants={itemVariants} className={`inline-block px-4 py-1.5 rounded-full ${theme.iconBg} ${theme.textAccent} text-sm font-bold tracking-wide mb-6 w-fit border ${theme.cardBorder}`}>
                    MUPA AI VISION
                  </motion.div>
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-6xl font-black mb-6 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.h3 variants={itemVariants} className={`text-2xl md:text-3xl ${theme.textAccent} mb-6 font-light`}>{slide.subtitle}</motion.h3>
                  <motion.p variants={itemVariants} className={`text-lg ${theme.textSecondary} mb-10 leading-relaxed max-w-lg`}>{slide.description}</motion.p>
                  
                  <div className="space-y-4">
                    {slide.stats?.map((stat, i) => (
                      <motion.div 
                        key={i} 
                        variants={itemVariants}
                        className={`flex items-center justify-between border-b ${theme.cardBorder} pb-3 hover:border-purple-500/50 transition-colors group`}
                      >
                        <span className={`text-base ${theme.textSecondary} group-hover:text-white transition-colors`}>{stat.value}</span>
                        <span className={`text-lg font-bold ${theme.textPrimary}`}>{stat.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <motion.div 
                  variants={itemVariants}
                  className={`relative rounded-[2rem] overflow-hidden border ${theme.cardBorder} shadow-2xl flex-1 h-full min-h-0 max-h-[70vh] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm`}
                >
                  {slide.images ? (
                      <div className="flex flex-col gap-4 p-4 w-full h-full bg-black/50">
                        {slide.images.map((img, i) => (
                          <div key={i} className="relative flex-1 rounded-xl overflow-hidden border border-white/10 group shadow-lg min-h-0">
                            <img 
                              src={img} 
                              alt={`Vision ${i}`} 
                              className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" 
                            />
                           <motion.div 
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 3, repeat: Infinity, delay: i * 1.5 }}
                              className="absolute top-1/4 left-1/4 w-16 h-16 border-2 border-green-500 rounded-lg"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-green-400 border border-green-500/30">
                              ID: {9823 + i} • Conf: {(0.9 + (i * 0.05)).toFixed(2)}
                            </div>
                         </div>
                       ))}
                     </div>
                  ) : slide.image && (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img 
                        src={slide.image} 
                        alt="AI Vision" 
                        className="w-full h-full object-contain opacity-80" 
                      />
                      {/* Overlays simulados */}
                      <motion.div 
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute top-1/4 left-1/4 w-24 h-24 border-2 border-green-500 rounded-lg"
                      >
                        <div className="absolute -top-6 left-0 bg-green-500 text-black text-xs font-bold px-2 py-1 rounded">
                          Mulher, 35-36 • Feliz
                        </div>
                      </motion.div>
                      
                      {/* Scan Line */}
                      <motion.div 
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 w-full h-px bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                      />
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* DASHBOARD DEMO */}
            {slide.layout === "dashboard-demo" && (
              <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
                <div className="text-center mb-6 shrink-0">
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-5xl font-bold mb-2 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>

                <motion.div 
                  variants={itemVariants}
                  className={`flex-1 min-h-0 bg-[#0F172A] border ${theme.cardBorder} rounded-3xl p-6 shadow-2xl overflow-hidden relative flex flex-col gap-6`}
                >
                  {/* Dashboard Header */}
                  <div className="flex justify-between items-center border-b border-slate-800 pb-4 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                        <BarChart3 className="text-white w-6 h-6" />
                      </div>
                      <div className="text-white font-bold text-xl">MUPA Analytics</div>
                    </div>
                    <div className="flex gap-4 text-sm text-slate-400">
                      {slide.stats?.map((stat, i) => (
                         <span key={i}>{stat.label}: {stat.value}</span>
                      ))}
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                    <div className="col-span-2 bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col">
                      <h4 className="text-sm font-medium text-slate-300 mb-4">Audiência Semanal</h4>
                      <div className="flex-1 flex items-end justify-between gap-2">
                        {[45, 70, 55, 85, 65, 90, 60, 75, 50, 80, 70, 95].map((h1, i) => {
                          const h2 = 10 + Math.random() * 40;
                          return (
                            <div key={i} className="flex-1 flex flex-col justify-end gap-1 h-full group relative">
                              <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: `${h2}%` }}
                                transition={{ duration: 0.5, delay: i * 0.02 }}
                                className="w-full bg-purple-500/80 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity"
                              />
                              <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: `${h1}%` }}
                                transition={{ duration: 0.5, delay: 0.2 + i * 0.02 }}
                                className="w-full bg-blue-500 rounded-sm group-hover:bg-blue-400 transition-colors"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Side List */}
                    <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-hidden flex flex-col">
                      <h4 className="text-sm font-medium text-slate-300 mb-4">Lojas com Maior Tráfego</h4>
                      <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                        {slide.items?.map((store: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300">{store.title}</span>
                                <span className="text-slate-500">{store.desc}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, parseInt(store.desc) || 50)}%` }}
                                  transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                                  className="h-full bg-blue-500 rounded-full"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* CASES */}
            {slide.layout === "case" && (
              <div className="grid md:grid-cols-2 gap-8 items-center h-full max-w-[1600px] mx-auto overflow-hidden">
                 <motion.div 
                    variants={itemVariants}
                    className={`p-10 rounded-[2.5rem] ${slide.color} bg-opacity-10 border border-white/10 h-full flex flex-col justify-center relative overflow-hidden`}
                 >
                    <div className={`absolute top-0 right-0 w-64 h-64 ${slide.color} bg-opacity-20 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none`} />
                    <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-white">{slide.title}</h2>
                    <h3 className="text-xl lg:text-2xl text-white/80 mb-8">{slide.subtitle}</h3>
                    <p className="text-white/70 leading-relaxed text-lg">{slide.description}</p>
                 </motion.div>
                 <div className="grid gap-4 content-center h-full overflow-y-auto custom-scrollbar p-2">
                    {slide.benefits?.map((benefit, i) => (
                      <motion.div
                        key={i}
                        variants={itemVariants}
                        className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex items-center gap-4 ${theme.cardHover} transition-colors`}
                      >
                        <CheckCircle2 className={`w-6 h-6 ${currentThemeId === 'neon' ? 'text-emerald-400' : 'text-green-400'} shrink-0`} />
                        <span className={`text-lg ${theme.textPrimary}`}>{benefit}</span>
                      </motion.div>
                    ))}
                 </div>
              </div>
            )}

            {/* SALES */}
            {slide.layout === "sales" && (
              <div className="h-full flex flex-col justify-center max-w-[1600px] mx-auto w-full">
                <div className="text-center mb-10 shrink-0">
                  <motion.h2 variants={itemVariants} className={`text-4xl md:text-5xl font-bold mb-4 ${theme.textPrimary}`}>{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textAccent}`}>{slide.subtitle}</motion.p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 min-h-0 content-center">
                  {slide.reasons?.map((reason, i) => (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      whileHover={{ y: -5 }}
                      className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} transition-all text-center flex flex-col items-center ${theme.cardHover} h-full justify-center`}
                    >
                      <div className={`w-14 h-14 rounded-full ${theme.iconBg} flex items-center justify-center mb-4 border ${theme.cardBorder}`}>
                        <DollarSign className={`w-7 h-7 ${theme.iconColor}`} />
                      </div>
                      <h4 className={`text-lg font-bold mb-2 ${theme.textPrimary}`}>{reason.title}</h4>
                      <p className={`text-sm ${theme.textSecondary} leading-relaxed`}>{reason.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Progress */}
          <div className="mt-6 shrink-0 h-1 w-full bg-white/10 rounded-full overflow-hidden max-w-3xl mx-auto">
            <motion.div 
              className={`h-full ${theme.progressBar}`}
              initial={{ width: 0 }}
              animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <SlideEditor 
        slide={slide} 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        onUpdate={handleUpdateSlide}
        onAdd={handleAddSlide}
        onDelete={handleDeleteSlide}
      />
    </div>
  );
}
