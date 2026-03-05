import { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, TrendingUp, Settings2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import inkyAvatar from "@/assets/inky-avatar.png";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type InkyMode = "strategic" | "operational" | "analytics";

const INKY_MODES = [
  {
    id: "strategic" as InkyMode,
    label: "Estratégico",
    emoji: "💰",
    icon: TrendingUp,
    description: "Monetização e performance comercial",
    color: "cyan",
  },
  {
    id: "operational" as InkyMode,
    label: "Operacional",
    emoji: "☁️",
    icon: Settings2,
    description: "Execução técnica e distribuição",
    color: "emerald",
  },
  {
    id: "analytics" as InkyMode,
    label: "Analytics",
    emoji: "📊",
    icon: BarChart3,
    description: "Diagnóstico e otimização",
    color: "violet",
  },
] as const;

const MODE_SUGGESTIONS: Record<InkyMode, string[]> = {
  strategic: [
    "Qual tela gera mais receita por hora?",
    "Sugira um pacote de mídia para marca de refrigerante.",
    "Qual inventário está ocioso?",
    "Como monetizar melhor o PDV?",
  ],
  operational: [
    "Otimize a grade para horário de pico.",
    "Qual o status operacional da rede?",
    "Como configurar fallback de conteúdo?",
    "Quais dispositivos estão offline?",
  ],
  analytics: [
    "Quais lojas têm maior conversão após exposição?",
    "Reorganize campanhas com base no fluxo da loja.",
    "Qual o ROI da última campanha?",
    "Mostre a taxa de engajamento por zona.",
  ],
};

const MODE_GREETINGS: Record<InkyMode, string> = {
  strategic:
    "Modo **Estratégico** ativado! 💰🐙 Agora estou focado em monetização, receita de mídia e performance comercial. Como posso ajudar a maximizar seus resultados?",
  operational:
    "Modo **Operacional** ativado! ☁️🐙 Agora estou focado em execução técnica, distribuição de conteúdo e saúde da rede de telas. O que precisa?",
  analytics:
    "Modo **Analytics** ativado! 📊🐙 Agora estou focado em diagnóstico, métricas e otimização baseada em dados. Que insight você precisa?",
};

export const InkySection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<InkyMode>("strategic");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Oii! 🐙 Eu sou o **Inky**, o assistente de Retail Media da MUPA! Escolha um modo de operação acima e manda sua pergunta!",
    },
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const switchMode = (mode: InkyMode) => {
    if (mode === activeMode) return;
    setActiveMode(mode);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: MODE_GREETINGS[mode],
      },
    ]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke(
        "inky-landing",
        { body: { messages: conversationMessages, mode: activeMode } }
      );

      const aiContent =
        !error && data?.response
          ? data.response
          : "Ops, parece que meus tentáculos se enrolaram! 🐙 Tente novamente em instantes.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: aiContent,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ops, algo deu errado. Tente novamente! 🐙",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestions = MODE_SUGGESTIONS[activeMode];
  const activeModeInfo = INKY_MODES.find((m) => m.id === activeMode)!;

  return (
    <section
      id="inky"
      ref={sectionRef}
      className="py-16 md:py-28 bg-black relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — Copy */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/20 mb-6">
              <img src={inkyAvatar} alt="Inky" className="w-6 h-6 rounded-full object-cover" />
              <span className="text-xs font-semibold text-cyan-300 tracking-wide uppercase">
                Conheça o Inky
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Tem dúvidas?{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Pergunte ao Inky
              </span>
            </h2>

            <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-xl">
              O Inky é o nosso polvo assistente de Retail Media — ele combina
              inteligência de mídia, dados e operação para maximizar seus
              resultados no PDV. Escolha o modo de operação e explore.
            </p>

            {/* Mode cards */}
            <div className="space-y-3">
              {INKY_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = activeMode === mode.id;
                return (
                  <motion.button
                    key={mode.id}
                    onClick={() => switchMode(mode.id)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5"
                        : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-white/5 text-gray-500"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          isActive ? "text-white" : "text-gray-300"
                        }`}
                      >
                        {mode.emoji} {mode.label}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {mode.description}
                      </div>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Right — Chat */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-cyan-500/5 overflow-hidden flex flex-col"
              style={{ height: 520 }}
            >
              {/* Header */}
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-cyan-500/30">
                  <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Inky</div>
                  <div className="text-xs text-cyan-400/80 flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Online agora
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                  <activeModeInfo.icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-medium text-cyan-300">
                    {activeModeInfo.label}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea ref={scrollRef} className="flex-1 px-4 py-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-cyan-500/20 mr-2 mt-1 shrink-0">
                          <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-cyan-600/80 text-white rounded-tr-none"
                            : "bg-white/[0.06] text-gray-200 rounded-tl-none border border-white/10"
                        }`}
                      >
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_strong]:text-cyan-300 [&_ul]:my-1 [&_li]:my-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-cyan-500/20 mr-2 mt-1 shrink-0">
                        <img src={inkyAvatar} alt="Inky" className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-white/[0.06] rounded-2xl rounded-tl-none px-4 py-3 border border-white/10 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                        <span className="text-xs text-gray-400">
                          Inky pensando...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Suggestions */}
              {messages.length <= 2 && (
                <div className="px-4 pb-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={`Pergunte ao Inky (${activeModeInfo.label})...`}
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-cyan-500/50"
                  />
                  <Button
                    onClick={() => sendMessage(input)}
                    disabled={isLoading || !input.trim()}
                    size="icon"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
