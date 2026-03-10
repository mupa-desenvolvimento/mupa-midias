import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  BarChart3, 
  Brain, 
  ArrowRight,
  LucideIcon,
  Scale,
  Monitor,
  LayoutTemplate,
  Presentation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { usePresentationConfig } from "@/hooks/usePresentationConfig";
import { LeadFormModal, LeadFormType } from "./LeadFormModal";
import { PlansComparisonModal } from "./PlansComparisonModal";
import { PlansCarousel } from "./PlansCarousel";

// Types for Plan Data
interface PlanFeature {
  title: string;
  items: string[];
}

interface Plan {
  id: string;
  name: string;
  theme: "green" | "blue" | "purple" | "zinc";
  tagline: string;
  description: string;
  buttonText: string;
  details: PlanFeature[];
}

const plans: Plan[] = [
  {
    id: "lite",
    name: "MUPA LITE",
    theme: "zinc",
    tagline: "Simples. Estável. 100% Offline.",
    description: "Terminal de consulta rápido, funcional e independente de internet. Ideal para operações que precisam de estabilidade e baixo custo.",
    buttonText: "Quero uma solução offline",
    details: [
      {
        title: "Operação Offline Total",
        items: [
          "Funciona sem conexão com internet",
          "Sem sincronização com nuvem",
          "Sem dependência de servidor externo",
          "Base de dados local embarcada"
        ]
      },
      {
        title: "Consulta de Produto Simplificada",
        items: [
          "Leitura de código de barras",
          "Exibição de nome e preço",
          "Banco de dados local com resposta instantânea",
          "Nota: Sem imagens ou sugestões inteligentes"
        ]
      },
      {
        title: "Conteúdo Estático Limitado",
        items: [
          "Até 3 imagens estáticas fixas",
          "Rotação simples entre imagens",
          "Definidas na instalação (sem campanhas dinâmicas)"
        ]
      },
      {
        title: "Performance Máxima",
        items: [
          "Carregamento imediato",
          "Alta estabilidade para alto fluxo",
          "Baixo consumo de recursos",
          "Atualização manual via arquivo"
        ]
      }
    ]
  },
  {
    id: "flow",
    name: "MUPA FLOW",
    theme: "green",
    tagline: "Controle total. Simples. Escalável.",
    description: "Gerencie todas as telas da sua rede com máxima performance, organização hierárquica e estabilidade offline.",
    buttonText: "Quero organizar minhas telas",
    details: [
      {
        title: "Distribuição e Gestão",
        items: [
          "Motor hierárquico (Canal → Região → Loja → Grupo → Dispositivo)",
          "Playlists por canal",
          "Múltiplos canais por dispositivo",
          "Agendamento de campanhas",
          "Upload de imagens e vídeos otimizados",
          "Links únicos por dispositivo",
          "Ativação por código",
          "Revogação remota"
        ]
      },
      {
        title: "Performance",
        items: [
          "Player offline-first com cache inteligente",
          "Atualização por versionamento",
          "Lazy loading",
          "Loop contínuo sem travamentos",
          "Otimização automática de mídia"
        ]
      },
      {
        title: "Monitoramento",
        items: [
          "Status online/offline",
          "Visualização da mídia atual",
          "Histórico de atualizações"
        ]
      }
    ]
  },
  {
    id: "insight",
    name: "MUPA INSIGHT",
    theme: "blue",
    tagline: "Dados reais. Decisões inteligentes.",
    description: "Descubra quem olha para suas telas, quais produtos despertam interesse e quais campanhas realmente performam.",
    buttonText: "Quero entender meu público",
    details: [
      {
        title: "Inclui tudo do Flow +",
        items: []
      },
      {
        title: "Analytics de Consulta de Produtos",
        items: [
          "Registro de cada leitura de produto",
          "Quantidade de consultas por item",
          "Ranking de produtos mais consultados",
          "Relatórios por loja, setor, dia e horário"
        ]
      },
      {
        title: "Audience Analytics",
        items: [
          "Contagem de pessoas por tela",
          "Tempo médio de atenção",
          "Idade aproximada",
          "Gênero",
          "Emoção predominante"
        ]
      },
      {
        title: "Correlação Mídia x Público",
        items: [
          "Registro da mídia exibida no momento da visualização",
          "Ranking de mídias mais vistas",
          "Heatmap de atenção por horário"
        ]
      },
      {
        title: "Performance de Campanha",
        items: [
          "Score automático de performance",
          "Comparativo entre lojas",
          "Exportação de relatórios"
        ]
      }
    ]
  },
  {
    id: "impact",
    name: "MUPA IMPACT",
    theme: "purple",
    tagline: "Personalização em tempo real. Monetização de audiência.",
    description: "Transforme cada tela em um ativo estratégico de vendas com personalização dinâmica e inteligência artificial.",
    buttonText: "Quero transformar minhas telas em ativo estratégico",
    details: [
      {
        title: "Inclui tudo do Insight +",
        items: []
      },
      {
        title: "Fidelidade Inteligente",
        items: [
          "Cadastro de clientes",
          "Histórico de compras",
          "Perfil comportamental",
          "Sugestão personalizada de produtos"
        ]
      },
      {
        title: "Recomendação Automática",
        items: [
          "Cross-sell após consulta",
          "Sugestão por margem ou campanha ativa",
          "Produtos complementares"
        ]
      },
      {
        title: "Segmentação Dinâmica",
        items: [
          "Alteração automática de mídia conforme perfil detectado",
          "Priorização por idade, gênero, emoção e horário"
        ]
      },
      {
        title: "Trade Marketing",
        items: [
          "Dashboard exclusivo para fornecedores",
          "Audiência por campanha",
          "Perfil demográfico por mídia",
          "Comparação entre lojas e regiões"
        ]
      },
      {
        title: "Monetização de Tela",
        items: [
          "Valoração por audiência real",
          "Estimativa de valor por horário",
          "Relatórios para negociação comercial"
        ]
      },
      {
        title: "Insights com IA",
        items: [
          "Análises automáticas de comportamento",
          "Sugestões de melhoria de campanhas",
          "Identificação de padrões de consumo"
        ]
      }
    ]
  }
];

const PlanCard = ({ plan, onAction, showDetails = true }: { plan: Plan; onAction: () => void; showDetails?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const themeClasses = {
    zinc: {
      gradient: "from-border to-border",
      border: "border-border/40 hover:border-border/70",
      ring: "ring-border/70",
      tagline: "text-muted-foreground",
      icon: "bg-card/30 text-muted-foreground",
      check: "text-muted-foreground",
    },
    green: {
      gradient: "from-secondary to-accent",
      border: "border-accent/30 hover:border-accent/60",
      ring: "ring-accent",
      tagline: "text-secondary",
      icon: "bg-accent/15 text-accent",
      check: "text-accent",
    },
    blue: {
      gradient: "from-primary to-accent",
      border: "border-primary/40 hover:border-primary/70",
      ring: "ring-primary",
      tagline: "text-secondary",
      icon: "bg-primary/20 text-secondary",
      check: "text-secondary",
    },
    purple: {
      gradient: "from-accent to-primary",
      border: "border-accent/40 hover:border-accent/70",
      ring: "ring-accent",
      tagline: "text-accent",
      icon: "bg-accent/15 text-accent",
      check: "text-accent",
    },
  } as const;

  const buttonStyles: Record<string, string> = {
    lite: "bg-white hover:bg-background text-foreground border border-border shadow-sm font-bold",
    flow: "bg-primary hover:bg-primary/90 text-primary-foreground border border-border/40 shadow-sm",
    insight: "bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 border-0",
    impact: "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-xl shadow-accent/30 border-0 font-bold tracking-wide"
  };

  const iconMap: Record<string, LucideIcon> = {
    zinc: Monitor,
    green: Zap,
    blue: BarChart3,
    purple: Brain
  };

  const Icon = iconMap[plan.theme];

  return (
    <motion.div 
      layout
      className={cn(
        "relative rounded-2xl border bg-sidebar/40 backdrop-blur-sm overflow-hidden transition-all duration-300 h-full",
        themeClasses[plan.theme].border,
        isExpanded ? "ring-2 ring-offset-0 ring-offset-transparent ring-opacity-50 z-20" : "hover:border-opacity-50 z-10",
        isExpanded && themeClasses[plan.theme].ring,
        plan.id === "impact" && !isExpanded && "border-accent/60 shadow-accent/10 shadow-2xl"
      )}
    >
      {/* Top Gradient Line */}
      <div className={cn("h-1 w-full bg-gradient-to-r", themeClasses[plan.theme].gradient)} />

      <div className="p-4 sm:p-6 md:p-8 flex flex-col h-full">
        {/* Header */}
        <div className="mb-6">
          <div className={cn("inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4", themeClasses[plan.theme].icon)}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight">{plan.name}</h3>
          <p className={cn("text-sm font-medium uppercase tracking-wider mb-4 min-h-[44px] flex items-center", themeClasses[plan.theme].tagline)}>
            {plan.tagline}
          </p>
          <p className="text-muted-foreground leading-relaxed min-h-[100px] mb-4">
            {plan.description}
          </p>
          
          {/* Support Badge */}
          <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-secondary/10 border border-secondary/20 px-3 py-1.5 rounded-full w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Suporte técnico remoto incluso
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto space-y-4">
          {showDetails && (
            <Button 
              variant="outline" 
              className="w-full border-border/40 hover:bg-card/20 text-foreground group"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 ml-2 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
              )}
            </Button>
          )}

          {!isExpanded && (
            <Button 
              className={cn("w-full font-medium h-auto py-3 whitespace-normal leading-tight", buttonStyles[plan.id])}
              onClick={onAction}
            >
              {plan.buttonText}
            </Button>
          )}
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-8 border-t border-border/40 mt-6 space-y-8">
                {plan.details.map((section, idx) => (
                  <div key={idx}>
                    <h4 className="text-foreground font-semibold mb-3 flex items-center gap-2">
                      {section.title.includes("Inclui tudo") ? (
                        <span className="text-muted-foreground italic">{section.title}</span>
                      ) : (
                        section.title
                      )}
                    </h4>
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", themeClasses[plan.theme].check)} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <Button 
                  className={cn("w-full h-12 text-lg font-medium mt-4", buttonStyles[plan.id])}
                  onClick={onAction}
                >
                  {plan.id === 'lite' ? 'Solicitar proposta Lite' : plan.buttonText}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const PlansSection = () => {
  const { config } = usePresentationConfig();
  const [leadFormType, setLeadFormType] = useState<LeadFormType | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');

  // Filter visible plans based on config
  const visiblePlansList = plans.filter(plan => {
    if (plan.id === 'lite' && !config.showLite) return false;
    if (plan.id === 'flow' && !config.showFlow) return false;
    if (plan.id === 'insight' && !config.showInsight) return false;
    if (plan.id === 'impact' && !config.showImpact) return false;
    return true;
  });

  const visiblePlanIds = visiblePlansList.map(p => p.id);

  const handlePlanAction = (planId: string) => {
    // Map plan IDs to form types
    if (planId === "lite") setLeadFormType("lite");
    if (planId === "flow") setLeadFormType("flow");
    if (planId === "insight") setLeadFormType("insight");
    if (planId === "impact") setLeadFormType("impact");
  };

  return (
    <section className="py-24 bg-sidebar relative overflow-hidden" id="plans">
      <LeadFormModal 
        isOpen={!!leadFormType} 
        onClose={() => setLeadFormType(null)} 
        type={leadFormType || "general"} 
      />
      
      <PlansComparisonModal 
        isOpen={isComparisonOpen} 
        onClose={() => setIsComparisonOpen(false)}
        onSelectPlan={(plan) => {
          setIsComparisonOpen(false);
          setLeadFormType(plan);
        }}
      />

      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(8,92,240,0.10),transparent_70%)]" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
              Transforme suas telas em <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary via-accent to-primary">
                inteligência de vendas
              </span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Escolha o nível de tecnologia ideal para sua operação e evolua do controle total à personalização inteligente.
            </p>

            {/* View Toggle */}
            <div className="flex justify-center mb-12">
              <ToggleGroup type="single" value={viewMode} onValueChange={(val) => val && setViewMode(val as 'carousel' | 'grid')} className="bg-card/20 p-1 rounded-full border border-border/40">
                <ToggleGroupItem value="carousel" className="rounded-full px-4 data-[state=on]:bg-card/30 data-[state=on]:text-foreground text-muted-foreground">
                  <Presentation className="w-4 h-4 mr-2" />
                  Apresentação
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" className="rounded-full px-4 data-[state=on]:bg-card/30 data-[state=on]:text-foreground text-muted-foreground">
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Grade
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </motion.div>
        </div>

        {/* Plans Display */}
        <AnimatePresence mode="wait">
          {viewMode === 'carousel' ? (
            <motion.div
              key="carousel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-20"
            >
              <PlansCarousel onPlanSelect={handlePlanAction} visiblePlans={visiblePlanIds} />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-20"
            >
              {visiblePlansList.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="h-full"
                >
                  <PlanCard plan={plan} onAction={() => handlePlanAction(plan.id)} showDetails={config.showDetails} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Support Note */}
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <p className="text-muted-foreground text-sm md:text-base border border-border/40 bg-card/20 rounded-full px-6 py-3 inline-block">
            <span className="text-secondary font-bold">Nota:</span> Todos os planos Mupa incluem suporte técnico remoto imediato para garantir máxima disponibilidade e agilidade no atendimento.
          </p>
        </div>

        {/* Intermediate CTA - Comparison */}
        {config.showComparison && (
          <div className="text-center mb-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex flex-col items-center gap-4"
            >
              <h3 className="text-2xl text-foreground/80 font-medium">Ainda não sabe qual plano escolher?</h3>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setIsComparisonOpen(true)}
                className="h-14 px-8 text-lg rounded-full border-border/50 hover:bg-card/20 text-foreground gap-2"
              >
                <Scale className="w-5 h-5" />
                Comparar planos
              </Button>
            </motion.div>
          </div>
        )}

        {/* Bottom CTA Block */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-3xl overflow-hidden border border-border/40 bg-gradient-to-b from-primary/40 to-sidebar text-center p-8 md:p-20"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(8,92,240,0.16),transparent_70%)]" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-6">
              Pronto para transformar suas telas em inteligência de mercado?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
              A Mupa vai além do digital signage tradicional. Entregamos dados reais de comportamento, análise de audiência e personalização estratégica para o varejo moderno.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => setLeadFormType("general")}
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Falar com especialista Mupa
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => setLeadFormType("demo")}
                className="w-full sm:w-auto h-14 px-8 text-lg rounded-full border-border/50 hover:bg-card/20 text-foreground"
              >
                Agendar reunião executiva
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
