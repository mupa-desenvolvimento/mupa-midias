import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight,
  ChevronLeft,
  Monitor,
  Users,
  BarChart3,
  TrendingUp,
  Target,
  Globe,
  Store,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
  Zap,
  ShoppingBag,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "@/types/presentation";
import { ASSAI_SLIDES } from "@/data/assai-slides";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Assaí Theme
const theme = {
  bg: "bg-slate-950",
  bgEffects: (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
      <div className="absolute top-0 w-full h-full bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
      {/* Assaí Colors: Orange and Blue accents */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
    </>
  ),
  textPrimary: "text-white",
  textSecondary: "text-slate-400",
  accent: "text-orange-500",
  accentGradient: "bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text",
  cardBg: "bg-white/5",
  cardBorder: "border-white/10",
  buttonPrimary: "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white",
  buttonSecondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
};

export default function AssaiPresentation() {
  const [slides] = useState<Slide[]>(ASSAI_SLIDES);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  const slide = slides[currentSlide];

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 100 }
    }
  };

  return (
    <div className={`h-screen w-screen overflow-hidden relative ${theme.bg} ${theme.textPrimary} font-sans selection:bg-orange-500/30`}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {theme.bgEffects}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4">
        <span className={`${theme.textSecondary} font-mono text-sm`}>
          {currentSlide + 1} / {slides.length}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevSlide} disabled={currentSlide === 0} className={`rounded-full w-10 h-10 ${theme.buttonSecondary}`}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextSlide} disabled={currentSlide === slides.length - 1} className={`rounded-full w-10 h-10 ${theme.buttonSecondary}`}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="h-full w-full flex flex-col p-6 md:p-12 relative z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8 shrink-0">
            <div className="flex items-center gap-3">
              {/* Placeholder for Assaí Logo if needed, using text for now or generic logo */}
              <div className="text-2xl font-bold tracking-tighter">
                <span className="text-blue-500">GRUPO</span><span className="text-orange-500">ASSAÍ</span>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${theme.textSecondary} text-sm font-medium uppercase tracking-widest`}>
              {slide.icon && <slide.icon className="w-4 h-4" />}
              <span>Apresentação Executiva</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col justify-center w-full min-h-0 relative">
            
            {/* 1. LANDING HERO */}
            {slide.layout === "landing-hero" && (
              <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
                <motion.div variants={itemVariants} className="mb-6">
                  <span className="px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium">
                    Proposta de Retail Media
                  </span>
                </motion.div>
                <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-black mb-8 leading-tight">
                  {slide.title}
                </motion.h1>
                <motion.p variants={itemVariants} className={`text-2xl md:text-3xl ${theme.textSecondary} max-w-3xl mb-12`}>
                  {slide.description}
                </motion.p>
                <motion.div variants={itemVariants}>
                  <Button size="lg" className={`h-14 px-10 text-lg rounded-full ${theme.buttonPrimary}`} onClick={nextSlide}>
                    Iniciar Apresentação <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
              </div>
            )}

            {/* 2. BIG NUMBERS */}
            {slide.layout === "big-numbers" && (
              <div className="max-w-6xl mx-auto w-full">
                <div className="text-center mb-16">
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {slide.stats?.map((stat, i) => (
                    <motion.div 
                      key={i}
                      variants={itemVariants}
                      className={`p-8 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} text-center group hover:bg-white/10 transition-colors`}
                    >
                      <div className="flex justify-center mb-4">
                        {stat.icon && <stat.icon className="w-8 h-8 text-orange-500" />}
                      </div>
                      <div className="text-5xl font-black text-white mb-2">{stat.value}</div>
                      <div className="text-sm uppercase tracking-wider text-slate-400">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. CHART & 4. ATTENTION (General Chart Layout) */}
            {slide.layout === "chart" && (
              <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto w-full">
                <div>
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-6">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary} mb-8`}>{slide.description}</motion.p>
                  <motion.ul variants={itemVariants} className="space-y-4">
                    {slide.points?.map((point, i) => (
                      <li key={i} className="flex items-start gap-3 text-lg text-slate-300">
                        <CheckCircle2 className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                        {point}
                      </li>
                    ))}
                  </motion.ul>
                </div>
                <motion.div variants={itemVariants} className={`h-[400px] p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={slide.chartData} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" />
                      <YAxis dataKey="name" type="category" stroke="#fff" width={100} tick={{fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} 
                        itemStyle={{ color: '#fff' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {slide.chartData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f97316' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>
            )}

            {/* 6. COMPARISON */}
            {slide.layout === "comparison" && (
              <div className="max-w-6xl mx-auto w-full">
                <div className="text-center mb-12">
                  <motion.h2 variants={itemVariants} className="text-4xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: Traditional */}
                  <motion.div variants={itemVariants} className="p-8 rounded-2xl bg-red-950/20 border border-red-900/30">
                    <div className="flex items-center gap-3 mb-6">
                      <XCircle className="w-8 h-8 text-red-500" />
                      <h3 className="text-2xl font-bold text-red-100">{slide.leftTitle}</h3>
                    </div>
                    <ul className="space-y-4">
                      {slide.leftPoints?.map((p, i) => (
                        <li key={i} className="flex items-center gap-3 text-red-200/70">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                  {/* Right: Assaí */}
                  <motion.div variants={itemVariants} className="p-8 rounded-2xl bg-green-950/20 border border-green-900/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 bg-green-500/20 rounded-bl-xl border-l border-b border-green-500/30">
                      <span className="text-xs font-bold text-green-400 uppercase">Recomendado</span>
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <h3 className="text-2xl font-bold text-green-100">{slide.rightTitle}</h3>
                    </div>
                    <ul className="space-y-4">
                      {slide.rightPoints?.map((p, i) => (
                        <li key={i} className="flex items-center gap-3 text-green-200/90 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </div>
              </div>
            )}

            {/* 7. FEATURE LIST */}
            {slide.layout === "feature-list" && (
              <div className="max-w-5xl mx-auto w-full">
                <div className="text-center mb-16">
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                <div className="grid gap-6">
                  {slide.points?.map((point, i) => (
                    <motion.div 
                      key={i} 
                      variants={itemVariants}
                      className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex items-center gap-4 hover:border-orange-500/50 transition-colors`}
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Target className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="text-xl text-slate-200">{point}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. GRID (Monetization) */}
            {slide.layout === "grid" && (
              <div className="max-w-6xl mx-auto w-full">
                <div className="text-center mb-16">
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {slide.items?.map((item, i) => (
                    <motion.div 
                      key={i} 
                      variants={itemVariants}
                      className={`p-8 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} hover:bg-white/10 transition-all`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-blue-500/10 shrink-0">
                          {item.icon && <item.icon className="w-6 h-6 text-blue-400" />}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                          <p className="text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. ROI CALCULATOR */}
            {slide.layout === "roi-calculator" && (
              <div className="max-w-5xl mx-auto w-full">
                <div className="text-center mb-12">
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-6 mb-12">
                   {slide.stats?.map((stat, i) => (
                     <motion.div key={i} variants={itemVariants} className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                       <div className="text-4xl font-black text-orange-500 mb-1">{stat.value}</div>
                       <div className="text-sm text-orange-200/70 uppercase font-medium">{stat.label}</div>
                     </motion.div>
                   ))}
                </div>

                {/* Points */}
                <div className="grid md:grid-cols-2 gap-4">
                  {slide.points?.map((point, i) => (
                    <motion.div key={i} variants={itemVariants} className={`p-4 rounded-lg ${theme.cardBg} border ${theme.cardBorder} flex items-center gap-3`}>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-lg">{point}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. QUOTE (Conclusion) */}
            {slide.layout === "quote" && (
              <div className="max-w-4xl mx-auto text-center">
                <motion.div variants={itemVariants} className="mb-8 flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-orange-500" />
                  </div>
                </motion.div>
                <motion.h2 variants={itemVariants} className="text-3xl md:text-5xl font-medium leading-tight mb-12 italic text-slate-200">
                  "{slide.description}"
                </motion.h2>
              </div>
            )}

            {/* TABLE LAYOUT */}
            {slide.layout === "table" && slide.tableData && (
              <div className="max-w-6xl mx-auto w-full">
                <div className="text-center mb-12">
                  <motion.h2 variants={itemVariants} className="text-5xl font-bold mb-4">{slide.title}</motion.h2>
                  <motion.p variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>{slide.description}</motion.p>
                </div>
                
                <motion.div variants={itemVariants} className={`rounded-xl overflow-hidden border ${theme.cardBorder} ${theme.cardBg}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          {slide.tableData.headers.map((header, i) => (
                            <th key={i} className="p-4 text-sm font-bold uppercase tracking-wider text-orange-400">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.tableData.rows.map((row, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            {row.map((cell, j) => (
                              <td key={j} className="p-4 text-slate-300">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </div>
            )}

            {/* 11. THANK YOU */}
            {slide.layout === "thank-you" && (
              <div className="flex flex-col items-center justify-center text-center h-full max-w-4xl mx-auto">
                <motion.div variants={itemVariants} className="mb-8">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </motion.div>
                <motion.h1 variants={itemVariants} className="text-7xl md:text-9xl font-black mb-6 tracking-tight">
                  {slide.title}
                </motion.h1>
                <motion.p variants={itemVariants} className="text-2xl md:text-4xl text-orange-400 font-medium mb-12">
                  {slide.subtitle}
                </motion.p>
                <motion.div variants={itemVariants} className={`text-xl ${theme.textSecondary}`}>
                  {slide.description}
                </motion.div>
              </div>
            )}

          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
