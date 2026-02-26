import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, CircleDollarSign, TrendingUp, Monitor, BarChart3, Brain, Clock, Target, FileBarChart2, Layers, LayoutGrid, ShieldCheck, Users, Globe, Store, Handshake, Calendar, Zap } from "lucide-react";
import { LeadFormModal } from "@/components/landing/LeadFormModal";
import { useState } from "react";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`w-full px-6 md:px-10 lg:px-16 ${className}`}>{children}</section>
);

const SectionHeader = ({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) => (
  <div className="max-w-5xl mx-auto text-center space-y-4">
    {eyebrow && <div className="text-xs tracking-widest uppercase text-primary/80">{eyebrow}</div>}
    <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">{title}</h2>
    {subtitle && <p className="text-white/60 text-lg md:text-xl">{subtitle}</p>}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center">
    <div className="text-3xl md:text-4xl font-bold text-white">{value}</div>
    <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
  </div>
);

const Feature = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
    <CardHeader className="space-y-2">
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <CardTitle className="text-white">{title}</CardTitle>
      <CardDescription className="text-white/70">{desc}</CardDescription>
    </CardHeader>
  </Card>
);

const ComparisonRow = ({ left, right }: { left: string; right: string }) => (
  <div className="grid grid-cols-2 text-sm">
    <div className="py-2 px-3 border-b border-r border-white/10 text-white/70">{left}</div>
    <div className="py-2 px-3 border-b border-white/10 text-white">{right}</div>
  </div>
);

export default function RetailMedia() {
  const [openDemo, setOpenDemo] = useState<null | "demo" | "proposal">(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <LeadFormModal isOpen={openDemo === "demo"} onClose={() => setOpenDemo(null)} type="demo" />
      <LeadFormModal isOpen={openDemo === "proposal"} onClose={() => setOpenDemo(null)} type="impact" />

      <Section className="pt-24 pb-16 relative overflow-hidden">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center gap-6">
            <Badge variant="outline" className="border-primary/50 text-primary">Retail Media Inteligente</Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
              Transforme suas lojas em veículos de mídia rentáveis
            </h1>
            <p className="text-white/70 text-lg md:text-xl max-w-3xl">
              A Mupa converte suas telas em inventário publicitário inteligente, com gestão completa de campanhas, dados e monetização.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={() => setOpenDemo("demo")}>
                Solicitar Demonstração <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <a href="#como-funciona" className="inline-flex">
                <Button size="lg" variant="outline">
                  Ver Como Funciona
                </Button>
              </a>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-8">
              <Stat label="Ocupação de Slots" value="82%" />
              <Stat label="Receita Mensal" value="R$ 142k" />
              <Stat label="Campanhas Ativas" value="47" />
            </div>
            <div className="mt-10 w-full">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/50 to-zinc-900/20 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-black/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Ocupação de Inventário</CardTitle>
                      <CardDescription className="text-white/60">Distribuição por loja</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end gap-2 h-40">
                      {[64, 88, 75, 92, 81].map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div className="w-8 bg-primary/70 rounded-t-md" style={{ height: `${v}%` }} />
                          <span className="text-xs text-white/40 mt-2">L{i + 1}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="bg-black/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Receita por Loja</CardTitle>
                      <CardDescription className="text-white/60">Top 5</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { s: "Loja Centro", v: "R$ 38.200" },
                        { s: "Loja Norte", v: "R$ 31.900" },
                        { s: "Loja Sul", v: "R$ 27.400" },
                        { s: "Loja Leste", v: "R$ 24.150" },
                        { s: "Loja Oeste", v: "R$ 20.880" },
                      ].map((r) => (
                        <div key={r.s} className="flex justify-between text-sm">
                          <span className="text-white/70">{r.s}</span>
                          <span className="text-white font-medium">{r.v}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="bg-black/40 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Relatório de Campanha</CardTitle>
                      <CardDescription className="text-white/60">Entrega certificada</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-primary" />
                        <div className="text-sm">
                          <div className="text-white">Impressões</div>
                          <div className="text-white/60 text-xs">2.4M</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <div className="text-sm">
                          <div className="text-white">Frequência</div>
                          <div className="text-white/60 text-xs">9.3</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <div className="text-sm">
                          <div className="text-white">Horários</div>
                          <div className="text-white/60 text-xs">Prime Time</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                        <Target className="w-4 h-4 text-primary" />
                        <div className="text-sm">
                          <div className="text-white">Segmentos</div>
                          <div className="text-white/60 text-xs">Perfil IA</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Section>

      <Section className="py-16">
        <SectionHeader
          eyebrow="Posicionamento"
          title="Digital Signage + Monetização + Dados + IA"
          subtitle="A Mupa transforma telas em ativos financeiros com gestão comercial ponta a ponta."
        />
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 mt-10">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Digital Signage Comum</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ComparisonRow left="Exibe vídeos" right="" />
              <ComparisonRow left="Organiza playlists" right="" />
              <ComparisonRow left="Relatório simples" right="" />
              <ComparisonRow left="Tela é custo" right="" />
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Mupa Retail Media</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ComparisonRow left="" right="Monetiza inventário" />
              <ComparisonRow left="" right="Vende slots" />
              <ComparisonRow left="" right="Relatório comercial" />
              <ComparisonRow left="" right="Tela vira receita" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section className="py-16" id="como-funciona">
        <SectionHeader
          eyebrow="Operação"
          title="Como Funciona"
          subtitle="Do inventário à prova de exibição, tudo integrado."
        />
        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-4 mt-10">
          {[
            { icon: LayoutGrid, t: "Criar Inventário", d: "Slots por loja e tela" },
            { icon: CircleDollarSign, t: "Definir Preços", d: "Por loja ou região" },
            { icon: Handshake, t: "Vender Campanhas", d: "Para marcas e fornecedores" },
            { icon: Layers, t: "Distribuição Automática", d: "Engine prioriza entregas" },
            { icon: FileBarChart2, t: "Relatórios", d: "Prova de exibição certificada" },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-white font-medium">{t}</div>
              <div className="text-white/60 text-sm">{d}</div>
            </div>
          ))}
        </div>
        <div className="max-w-4xl mx-auto mt-10 grid grid-cols-5 items-center gap-2 text-white/70">
          <Brand /> <Arrow /> <Platform /> <Arrow /> <StoreScreen /> <Arrow /> <Report />
        </div>
      </Section>

      <Section className="py-16">
        <SectionHeader eyebrow="Capacidades" title="Recursos do Módulo" />
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-10">
          <Feature icon={LayoutGrid} title="Gestão de Inventário" desc="Slots por tela, loja e região." />
          <Feature icon={CircleDollarSign} title="Precificação Dinâmica" desc="Por loja, horário e demanda." />
          <Feature icon={Zap} title="Slot Premium" desc="Destaques com prioridade comercial." />
          <Feature icon={Handshake} title="Campanhas Cooperadas" desc="Divisão de custo entre marcas." />
          <Feature icon={Globe} title="Segmentação" desc="Por região, loja e horário." />
          <Feature icon={Target} title="Motor de Prioridade" desc="Entrega conforme metas comerciais." />
          <Feature icon={FileBarChart2} title="Relatórios White Label" desc="Prontos para o anunciante." />
          <Feature icon={TrendingUp} title="Simulador de Receita" desc="Projeções por ocupação." />
          <Feature icon={Monitor} title="Dashboard de Ocupação" desc="Acompanhamento em tempo real." />
          <Feature icon={Building2} title="Integração ERP" desc="Dados de lojas e contas." />
          <Feature icon={Users} title="Lift de Vendas" desc="Análise de impacto por produto." />
          <Feature icon={Brain} title="Reconhecimento Facial" desc="Segmentos por perfil detectado." />
        </div>
      </Section>

      <Section className="py-16">
        <SectionHeader
          eyebrow="IA"
          title="Inteligência que Monetiza"
          subtitle="Ajuste por horário, segmentação por perfil, otimização por performance e redistribuição automática."
        />
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 mt-10">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Otimização por Horário</CardTitle>
              <CardDescription className="text-white/70">Entrega adaptada a picos de fluxo.</CardDescription>
            </CardHeader>
            <CardContent className="h-36 flex items-end gap-2">
              {[20, 35, 28, 48, 52, 70, 60].map((v, i) => (
                <div key={i} className="flex-1">
                  <div className="w-full bg-primary/70 rounded-t" style={{ height: `${v}%` }} />
                  <div className="text-[10px] text-white/40 mt-1 text-center">{["06h","09h","12h","15h","18h","20h","22h"][i]}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Segmentação por Perfil</CardTitle>
              <CardDescription className="text-white/70">Exibição por audiência detectada.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-36">
              <div className="w-40 h-40 rounded-full border border-white/10 grid place-items-center">
                <div className="w-28 h-28 rounded-full bg-primary/30 grid place-items-center">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Otimização por Performance</CardTitle>
              <CardDescription className="text-white/70">Mais entrega para o que performa melhor.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-36">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">+27%</div>
                <div className="text-white/60 text-sm">Incremento médio de receita por otimização</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section className="py-16">
        <SectionHeader eyebrow="Resultados" title="Resultados para o Varejo" />
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 mt-10">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="space-y-2">
              <CardTitle className="text-white">Nova Receita Mensal</CardTitle>
              <CardDescription className="text-white/70">Monetização de telas já instaladas.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="space-y-2">
              <CardTitle className="text-white">Dados para Marcas</CardTitle>
              <CardDescription className="text-white/70">Relatórios de entrega e alcance.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="space-y-2">
              <CardTitle className="text-white">Diferencial Competitivo</CardTitle>
              <CardDescription className="text-white/70">Retail media como vantagem estratégica.</CardDescription>
            </CardHeader>
          </Card>
        </div>
        <div className="max-w-4xl mx-auto text-center mt-10 text-xl text-white/80">
          Sua loja deixa de ser apenas ponto de venda e passa a ser ponto de mídia.
        </div>
      </Section>

      <Section className="py-16">
        <SectionHeader eyebrow="Para Marcas" title="Para Marcas e Fornecedores" />
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-10">
          <Feature icon={LayoutGrid} title="Painel do Anunciante" desc="Acesso dedicado para marcas." />
          <Feature icon={Target} title="Compra Segmentada" desc="Por loja, região e perfil." />
          <Feature icon={ShieldCheck} title="Relatórios Certificados" desc="Prova de exibição." />
          <Feature icon={Clock} title="Controle de Frequência" desc="Gestão por horários." />
          <Feature icon={Globe} title="Alcance Nacional" desc="Expansão por regiões." />
          <Feature icon={Calendar} title="Agendamento" desc="Campanhas com janelas comerciais." />
        </div>
      </Section>

      <Section className="py-20">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-br from-primary/20 to-primary/10 p-10 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white">Pronto para transformar suas telas em receita?</h3>
          <p className="text-white/70 text-lg mt-2">Fale com um especialista ou solicite uma proposta agora mesmo.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button size="lg" onClick={() => setOpenDemo("proposal")}>Solicitar Proposta</Button>
            <Button size="lg" variant="outline" onClick={() => setOpenDemo("demo")}>Agendar Demonstração</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 justify-center">
      <Badge variant="outline" className="border-white/20 text-white/80">Marca</Badge>
    </div>
  );
}

function Platform() {
  return (
    <div className="flex items-center gap-2 justify-center">
      <Badge variant="outline" className="border-primary/40 text-primary">Plataforma</Badge>
    </div>
  );
}

function StoreScreen() {
  return (
    <div className="flex items-center gap-2 justify-center">
      <Store className="w-4 h-4 text-white/70" />
      <span className="text-white/80 text-sm">Loja/Tela</span>
    </div>
  );
}

function Report() {
  return (
    <div className="flex items-center gap-2 justify-center">
      <FileBarChart2 className="w-4 h-4 text-white/70" />
      <span className="text-white/80 text-sm">Relatório</span>
    </div>
  );
}

function Arrow() {
  return <ArrowRight className="w-5 h-5 text-white/30 mx-auto" />;
}
