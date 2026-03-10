import { useRef } from "react";
import Autoplay from "embla-carousel-autoplay";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Zap, BarChart3, Brain, Monitor, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlansCarouselProps {
  onPlanSelect: (plan: 'lite' | 'flow' | 'insight' | 'impact') => void;
  visiblePlans?: string[];
}

export function PlansCarousel({ onPlanSelect, visiblePlans }: PlansCarouselProps) {
  const plugin = useRef(
    Autoplay({ delay: 6000, stopOnInteraction: true })
  );

  const themeStyles = {
    neutral: {
      pillText: "text-secondary",
      check: "text-secondary",
      button: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20",
      glow: "bg-accent",
    },
    zinc: {
      pillText: "text-muted-foreground",
      check: "text-muted-foreground",
      button: "bg-foreground hover:bg-foreground/90 text-background shadow-foreground/10",
      glow: "bg-muted",
    },
    green: {
      pillText: "text-secondary",
      check: "text-secondary",
      button: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20",
      glow: "bg-secondary",
    },
    blue: {
      pillText: "text-accent",
      check: "text-accent",
      button: "bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent/20",
      glow: "bg-accent",
    },
    purple: {
      pillText: "text-accent",
      check: "text-accent",
      button: "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-accent/30",
      glow: "bg-accent",
    },
  } as const;

  const allSlides = [
    {
      id: "intro",
      theme: "neutral",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full p-6 md:p-12 space-y-6">
          <Badge variant="outline" className="px-4 py-1 text-sm border-border/50 text-muted-foreground">
            Maturidade Digital
          </Badge>
          <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            Não é apenas TV.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-accent">
              É Inteligência de Vendas.
            </span>
          </h3>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Do terminal offline mais robusto do mercado à inteligência artificial que personaliza ofertas em tempo real. Qual é o seu momento?
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl mt-8">
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/20 border border-border/40">
              <Monitor className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground/80">Estabilidade</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/20 border border-border/40">
              <Zap className="w-6 h-6 text-secondary" />
              <span className="text-sm font-bold text-foreground/80">Agilidade</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/20 border border-border/40">
              <BarChart3 className="w-6 h-6 text-accent" />
              <span className="text-sm font-bold text-foreground/80">Dados</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/20 border border-border/40">
              <Brain className="w-6 h-6 text-accent" />
              <span className="text-sm font-bold text-foreground/80">IA Real</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "lite",
      theme: "zinc",
      planId: 'lite',
      title: "MUPA LITE",
      headline: "Sua tela preta está queimando dinheiro.",
      description: "Internet cai? O sistema trava? Não com o Mupa Lite. A solução blindada que garante sua oferta visível 100% do tempo.",
      painPoints: ["Chega de telas pretas", "Fim da dependência de internet", "Zero custo de servidor"],
      cta: "Quero estabilidade total",
      icon: Monitor,
      gradient: "from-muted to-border"
    },
    {
      id: "flow",
      theme: "green",
      planId: 'flow',
      title: "MUPA FLOW",
      headline: "Ainda usa Pen Drive? Sua concorrência agradece.",
      description: "Atualize 100 lojas em segundos, não semanas. Centralize sua gestão, agende campanhas e elimine o erro humano.",
      painPoints: ["Fim da logística de pen drive", "Campanhas no ar em segundos", "Controle total da rede"],
      cta: "Automatizar minha rede",
      icon: Zap,
      gradient: "from-primary to-secondary"
    },
    {
      id: "insight",
      theme: "blue",
      planId: 'insight',
      title: "MUPA INSIGHT",
      headline: "Pare de chutar. Comece a lucrar.",
      description: "Quantas pessoas olharam sua vitrine hoje? O Mupa Insight transforma 'acho que' em 'eu sei que'. Dados reais para decisões que imprimem dinheiro.",
      painPoints: ["Saiba quem olha sua vitrine", "Descubra o produto campeão", "ROI comprovado com dados"],
      cta: "Descobrir meus números",
      icon: BarChart3,
      gradient: "from-accent to-secondary"
    },
    {
      id: "impact",
      theme: "purple",
      planId: 'impact',
      title: "MUPA IMPACT",
      headline: "Venda para quem está comprando. AGORA.",
      description: "Uma tela que sabe quem está olhando e muda a oferta na hora. Homem, 30 anos? Tênis. Mulher, 25? Bolsa. Aumente sua conversão em até 40%.",
      painPoints: ["Oferta certa na hora certa", "Personalização via IA", "O topo da tecnologia"],
      cta: "Quero vender com IA",
      icon: Brain,
      gradient: "from-primary to-accent"
    }
  ];

  const slides = visiblePlans 
    ? allSlides.filter(slide => slide.id === 'intro' || (slide.planId && visiblePlans.includes(slide.planId)))
    : allSlides;

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <Carousel
        plugins={[plugin.current as any]}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={index}>
              <Card className={cn(
                "border-0 bg-gradient-to-br min-h-[600px] flex items-center justify-center relative overflow-hidden",
                "bg-sidebar border border-border/40"
              )}>
                {/* Background Effects */}
                {slide.gradient && (
                  <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", slide.gradient)} />
                )}
                
                <CardContent className="p-0 w-full h-full relative z-10 flex flex-col items-center justify-center">
                  {slide.content ? (
                    slide.content
                  ) : (
                    <div className="grid md:grid-cols-2 gap-8 p-6 md:p-12 w-full h-full items-center">
                      <div className="space-y-6 text-left">
                        <div className={cn(
                          "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-card/20 border border-border/40",
                          themeStyles[slide.theme as keyof typeof themeStyles].pillText
                        )}>
                          {slide.icon && <slide.icon className="w-4 h-4" />}
                          {slide.title}
                        </div>
                        
                        <h3 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
                          {slide.headline}
                        </h3>
                        
                        <p className="text-lg text-muted-foreground leading-relaxed">
                          {slide.description}
                        </p>

                        <ul className="space-y-3 pt-4">
                          {slide.painPoints?.map((point, i) => (
                            <li key={i} className="flex items-center gap-3 text-foreground/80">
                              <CheckCircle2 className={cn("w-5 h-5", themeStyles[slide.theme as keyof typeof themeStyles].check)} />
                              {point}
                            </li>
                          ))}
                        </ul>

                        <div className="pt-6">
                          <Button 
                            size="lg"
                            onClick={() => slide.planId && onPlanSelect(slide.planId as any)}
                            className={cn(
                              "text-lg h-14 px-8 rounded-full font-bold shadow-lg transition-all hover:scale-105",
                              themeStyles[slide.theme as keyof typeof themeStyles].button
                            )}
                          >
                            {slide.cta}
                            <ArrowRight className="ml-2 w-5 h-5" />
                          </Button>
                        </div>
                      </div>

                      {/* Right Side / Visual Side */}
                      <div className="hidden md:flex flex-col items-center justify-center relative">
                        <div className={cn(
                          "w-64 h-64 rounded-full blur-3xl opacity-20 absolute",
                          themeStyles[slide.theme as keyof typeof themeStyles].glow
                        )} />
                        
                        {/* Abstract Visual Representation */}
                        <div className="relative z-10 p-8 rounded-3xl bg-card/20 border border-border/40 backdrop-blur-xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                           {slide.theme === 'zinc' && (
                              <div className="text-center space-y-4">
                                <AlertTriangle className="w-16 h-16 text-secondary mx-auto mb-2" />
                                <div className="text-sm text-muted-foreground">Sem internet?</div>
                                <div className="text-2xl font-bold text-secondary">Funcionando.</div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full w-full bg-secondary" />
                                </div>
                              </div>
                           )}
                           {slide.theme === 'green' && (
                              <div className="space-y-3 w-48">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Loja 01</span> <span className="text-secondary">Ok</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Loja 02</span> <span className="text-secondary">Ok</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Loja 99</span> <span className="text-secondary">Ok</span>
                                </div>
                                <div className="pt-2 border-t border-border/40 text-center">
                                  <span className="text-xs font-bold text-foreground">Upload Concluído</span>
                                </div>
                              </div>
                           )}
                           {slide.theme === 'blue' && (
                              <div className="space-y-4 text-center">
                                <div className="flex justify-center items-end gap-2 h-24">
                                  <div className="w-4 bg-primary/30 h-[40%] rounded-t" />
                                  <div className="w-4 bg-primary/40 h-[60%] rounded-t" />
                                  <div className="w-4 bg-accent h-[100%] rounded-t shadow-[0_0_15px_rgba(8,92,240,0.35)]" />
                                  <div className="w-4 bg-primary/40 h-[70%] rounded-t" />
                                </div>
                                <div className="text-xl font-bold text-foreground">+142%</div>
                                <div className="text-xs text-muted-foreground">Engajamento Real</div>
                              </div>
                           )}
                           {slide.theme === 'purple' && (
                              <div className="relative">
                                <div className="absolute -top-6 -right-6 bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded-full animate-pulse">
                                  Detectado
                                </div>
                                <div className="w-20 h-20 rounded-full border-2 border-accent mx-auto flex items-center justify-center mb-4">
                                  <Brain className="w-10 h-10 text-accent" />
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground">Perfil: Jovem/Masc</div>
                                  <div className="text-sm font-bold text-foreground mt-1">Oferta: Sneakers</div>
                                </div>
                              </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-12 border-border/40 bg-card/20 hover:bg-card/30 text-foreground" />
        <CarouselNext className="hidden md:flex -right-12 border-border/40 bg-card/20 hover:bg-card/30 text-foreground" />
      </Carousel>
    </div>
  );
}
