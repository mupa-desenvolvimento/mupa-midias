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
  Tv,
  ScanBarcode,
  Network,
  Lock,
  DollarSign,
  CheckCircle2,
  Play,
  Trophy,
  HeartHandshake,
  QrCode,
  ShoppingBag
} from "lucide-react";
import { Slide } from "@/types/presentation";

// Configuração dos slides
export const INITIAL_SLIDES: Slide[] = [
  // Slide 1: Capa
  {
    id: 1,
    layout: "landing-hero",
    title: "MUPA + Hardware",
    subtitle: "A Solução Completa",
    description: "Transforme televisores e terminais em experiências inteligentes de comunicação.",
    image: null,
    icon: Monitor
  },
  // Slide 2: Gestão Centralizada
  {
    id: 2,
    layout: "feature-list",
    title: "Gestão Centralizada",
    subtitle: "Controle Total",
    description: "Gerencie 1 ou 10.000 telas de um único dashboard na nuvem.",
    points: [
      "Atualização remota em segundos",
      "Agendamento por dia/hora",
      "Monitoramento de status (Online/Offline)",
      "Prova de execução (Screenshot remoto)"
    ],
    icon: Network
  },
  // Slide 3: O Desafio (Hardware Sozinho)
  {
    id: 3,
    layout: "problem",
    title: "O Desafio do Hardware",
    subtitle: "Uma tela preta não vende",
    description: "Vender apenas o equipamento entrega uma solução incompleta. O cliente precisa de gestão, conteúdo e inteligência para ver valor no investimento.",
    points: [
      "Telas desligadas ou com pen-drive",
      "Dificuldade de atualização de conteúdo",
      "Sem métricas de retorno (ROI)",
      "Manutenção presencial custosa"
    ],
    video: "/terminal_video_concorrente.mp4",
    icon: Tv
  },
  // Slide 4: A Solução MUPA (NEW LAYOUT: BENTO GRID)
  {
    id: 4,
    layout: "bento-grid",
    title: "A Solução MUPA",
    subtitle: "O Cérebro da Operação",
    description: "O sistema operacional que dá vida ao hardware. Compatível com Android, Windows, Linux e WebOS.",
    features: [
      { icon: WifiOff, text: "100% Offline", desc: "Nunca para de rodar, mesmo sem internet" },
      { icon: Layers, text: "Playlists Dinâmicas", desc: "Agendamento inteligente por dia e hora" },
      { icon: Lock, text: "Segurança Enterprise", desc: "Criptografia e proteção de dados" },
      { icon: Zap, text: "Integração Rápida", desc: "Setup em menos de 5 minutos" }
    ],
    icon: Brain
  },
  // Slide 5: Ecossistema de Hardware
  {
    id: 5,
    layout: "grid",
    title: "Ecossistema Completo",
    subtitle: "Um sistema, múltiplos dispositivos",
    description: "O MUPA se adapta a qualquer formato de tela que você vende.",
    items: [
      { title: "Smart TVs", desc: "Menu board, Mídia Indoor, Corporativo", icon: Tv },
      { title: "Terminais Zebra", desc: "Verificadores de Preço, Totens", icon: ScanBarcode },
      { title: "Tablets/Android", desc: "Gôndolas, Caixas, Quiosques", icon: Smartphone },
      { title: "Painéis LED", desc: "Fachadas, Grandes Formatos", icon: Monitor }
    ],
    icon: Layers
  },
  // Slide 6: Diferencial IA (NEW LAYOUT: IMMERSIVE SPLIT)
  {
    id: 6,
    layout: "immersive-split",
    title: "Inteligência Artificial",
    subtitle: "Sua tela agora tem olhos",
    description: "Análise de audiência em tempo real, sem gravar imagens (GDPR/LGPD).",
    image: "/terminal-woman.jpg",
    stats: [
      { label: "Gênero e Idade", value: "Perfil" },
      { label: "Emoções", value: "Reação" },
      { label: "Atenção", value: "Foco" }
    ],
    icon: Eye
  },
  // Slide 7: Análise de Comportamento
  {
    id: 7,
    layout: "case",
    title: "Análise de Comportamento",
    subtitle: "Insights em Toda a Jornada",
    description: "Entenda como seu cliente reage em cada interação, do corredor ao checkout.",
    benefits: [
      "Consulta de Produto: O app capta a emoção exata ao ver o preço.",
      "Mídia Indoor (TVs): Câmeras medem quantas pessoas olharam e o tempo.",
      "Métricas de Atenção: Saiba quais conteúdos retêm mais o olhar.",
      "Vantagem Competitiva: Transforme dados de comportamento em vendas."
    ],
    color: "bg-indigo-600",
    icon: ScanBarcode
  },
  // Slide 8: TVs com Visão Computacional
  {
    id: 8,
    layout: "visual-right",
    title: "TVs que Veem",
    subtitle: "Métricas de Atenção",
    description: "Transforme suas telas em sensores de audiência. Saiba exatamente quem está olhando para sua vitrine ou gôndola.",
    images: ["/captura_pessoas1.jpg", "/captura_pessoas2.png"],
    stats: [
      { label: "Tráfego", value: "Pessoas no Local" },
      { label: "Conversão", value: "% que Olhou" },
      { label: "Engajamento", value: "Tempo Médio" }
    ],
    icon: Monitor
  },
  // Slide 9: Demo Interativa (QR Code)
  {
    id: 9,
    layout: "qr-demo",
    title: "Experiência Mobile",
    subtitle: "IA na palma da mão",
    description: "Escaneie o QR Code para testar a análise de perfil e recomendação de produtos em tempo real no seu celular.",
    image: null,
    items: [
      { icon: ScanBarcode, title: "1. Aponte", desc: "Abra a câmera do seu celular e aponte para o QR Code." },
      { icon: Brain, title: "2. Analise", desc: "Nossa IA identificará seu perfil de forma anônima e segura." },
      { icon: ShoppingBag, title: "3. Descubra", desc: "Receba recomendações personalizadas instantaneamente." }
    ],
    icon: QrCode
  },
  // Slide 10: Dashboard em Tempo Real
  {
    id: 10,
    layout: "dashboard-demo",
    title: "Dashboard em Tempo Real",
    subtitle: "Visão 360º da Operação",
    description: "Acompanhe métricas vitais de todos os seus dispositivos em um único painel intuitivo.",
    stats: [
      { label: "Online", value: "1,240" },
      { label: "Offline", value: "8" }
    ],
    items: [
      { title: "Loja Shopping SP", desc: "98" },
      { title: "Flagship Av. Paulista", desc: "85" },
      { title: "Quiosque Aeroporto", desc: "72" },
      { title: "Loja Centro RJ", desc: "65" },
      { title: "Supermercado Barra", desc: "54" }
    ],
    icon: BarChart3
  },
  // Slide 11: Case Varejo (Terminais de Preço)
  {
    id: 11,
    layout: "case",
    title: "Varejo & Supermercados",
    subtitle: "Muito além do preço",
    description: "Transforme o verificador de preço em um ponto de mídia digital.",
    benefits: [
      "Exiba ofertas quando ocioso",
      "Sugira produtos complementares ao bipar",
      "Venda espaço publicitário para marcas",
      "Pesquisa de satisfação na tela"
    ],
    color: "bg-blue-600",
    icon: Store
  },
  // Slide 12: Case Corporativo (TVs)
  {
    id: 12,
    layout: "case",
    title: "Corporativo & Mídia",
    subtitle: "Comunicação Interna Eficaz",
    description: "Substitua murais de papel por TV Corporativa dinâmica.",
    benefits: [
      "Aniversariantes do mês automáticos",
      "Metas e indicadores em tempo real",
      "Notícias e clima",
      "Treinamentos e vídeos institucionais"
    ],
    color: "bg-purple-600",
    icon: Users
  },
  // Slide 13: MUPA em Ação (Vídeo)
  {
    id: 13,
    layout: "video-showcase",
    title: "MUPA em Ação",
    subtitle: "Fluidez e Performance",
    description: "Veja como o sistema se comporta em tempo real. Transições suaves e resposta imediata.",
    video: "/terminal_video_mupa.mp4",
    icon: Play
  },
  // Slide 14: Comparativo Visual
  {
    id: 14,
    layout: "comparison",
    title: "Comparativo de Qualidade",
    subtitle: "Não é apenas uma tela",
    description: "A percepção de valor do seu hardware muda completamente com o software certo.",
    comparison: {
      left: { label: "Concorrência / Genérico", image: "/terminal_foto_concorrente_compara1.jpeg", color: "text-red-400" },
      right: { label: "Experiência MUPA", image: "/terminal_foto_mupa_compara1.jpeg", color: "text-green-400" }
    },
    icon: Trophy
  },
  // Slide 15: Argumentos de Venda
  {
    id: 15,
    layout: "sales",
    title: "Por que vender MUPA?",
    subtitle: "Agregue valor ao seu hardware",
    description: "Ao oferecer a solução completa, você foge da guerra de preços do hardware.",
    reasons: [
      { title: "Receita Recorrente", desc: "Possibilidade de ganho no SaaS" },
      { title: "Fidelização", desc: "O cliente depende da sua solução" },
      { title: "Diferenciação", desc: "Não venda tela, venda inteligência" },
      { title: "Suporte Simplificado", desc: "Tudo remoto, menos visitas técnicas" }
    ],
    icon: DollarSign
  },
  // Slide 16: Encerramento (NEW LAYOUT: MINIMAL CENTERED)
  {
    id: 16,
    layout: "minimal-centered",
    title: "Vamos Começar?",
    subtitle: "Parceria MUPA + Seu Hardware",
    description: "O futuro do Digital Signage é inteligente. Leve essa inovação para seus clientes.",
    cta: "Cadastrar Vendedor",
    icon: CheckCircle2
  },
  // Slide 17: Obrigado
  {
    id: 17,
    layout: "hero",
    title: "Obrigado!",
    subtitle: "Boas Vendas",
    description: "Estamos à disposição para transformar seu negócio.",
    icon: HeartHandshake
  },
  // Slide 18: MUPA LITE
  {
    id: 18,
    layout: "plan-details",
    title: "MUPA LITE",
    subtitle: "Simples. Estável. 100% Offline.",
    description: "Terminal de consulta rápido, funcional e independente de internet. Ideal para operações que precisam de estabilidade e baixo custo.",
    planTheme: "zinc",
    icon: Monitor,
    planDetails: [
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
  // Slide 19: MUPA FLOW
  {
    id: 19,
    layout: "plan-details",
    title: "MUPA FLOW",
    subtitle: "Controle total. Simples. Escalável.",
    description: "Gerencie todas as telas da sua rede com máxima performance, organização hierárquica e estabilidade offline.",
    planTheme: "green",
    icon: Zap,
    planDetails: [
      {
        title: "Distribuição e Gestão",
        items: [
          "Motor hierárquico (Campanha → Região → Loja → Grupo → Dispositivo)",
          "Playlists por campanha",
          "Múltiplas campanhas por dispositivo",
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
  // Slide 20: MUPA INSIGHT
  {
    id: 20,
    layout: "plan-details",
    title: "MUPA INSIGHT",
    subtitle: "Dados reais. Decisões inteligentes.",
    description: "Descubra quem olha para suas telas, quais produtos despertam interesse e quais campanhas realmente performam.",
    planTheme: "blue",
    icon: BarChart3,
    planDetails: [
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
  // Slide 21: MUPA IMPACT
  {
    id: 21,
    layout: "plan-details",
    title: "MUPA IMPACT",
    subtitle: "Personalização em tempo real. Monetização de audiência.",
    description: "Transforme cada tela em um ativo estratégico de vendas com personalização dinâmica e inteligência artificial.",
    planTheme: "purple",
    icon: Brain,
    planDetails: [
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
