import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useMemo } from "react";
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft, Building2, User, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export type LeadFormType = "general" | "lite" | "flow" | "insight" | "impact" | "demo";

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LeadFormType;
}

// Schema definitions based on type
const baseSchema = {
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  company: z.string().min(2, "Empresa é obrigatória"),
};

const formConfigs = {
  general: {
    title: "Solicitar Diagnóstico",
    subtitle: "Vamos analisar a maturidade da sua operação de Digital Signage.",
    fields: ["jobTitle", "stores", "hasTerminals", "hasCameras", "phone"],
    schema: z.object({
      ...baseSchema,
      jobTitle: z.string().min(2, "Cargo é obrigatório"),
      stores: z.string().min(1, "Número de lojas é obrigatório"),
      hasTerminals: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      hasCameras: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      phone: z.string().min(10, "Telefone inválido"),
    })
  },
  demo: {
    title: "Agendar Demonstração",
    subtitle: "Veja na prática como a Mupa pode transformar sua operação.",
    fields: ["jobTitle", "stores", "hasTerminals", "hasCameras", "phone"],
    schema: z.object({
      ...baseSchema,
      jobTitle: z.string().min(2, "Cargo é obrigatório"),
      stores: z.string().min(1, "Número de lojas é obrigatório"),
      hasTerminals: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      hasCameras: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      phone: z.string().min(10, "Telefone inválido"),
    })
  },
  lite: {
    title: "Proposta Mupa Lite",
    subtitle: "Solução offline ideal para estabilidade e baixo custo.",
    fields: ["stores", "phone", "city"],
    schema: z.object({
      ...baseSchema,
      stores: z.string().min(1, "Número de lojas é obrigatório"),
      phone: z.string().min(10, "Telefone inválido"),
      city: z.string().min(2, "Cidade é obrigatória"),
    })
  },
  flow: {
    title: "Mupa Flow",
    subtitle: "Organização e controle para sua rede.",
    fields: ["screens", "city"],
    schema: z.object({
      ...baseSchema,
      screens: z.string().min(1, "Número de telas é obrigatório"),
      city: z.string().min(2, "Cidade é obrigatória"),
    })
  },
  insight: {
    title: "Mupa Insight",
    subtitle: "Inteligência de dados para sua audiência.",
    fields: ["stores", "hasTerminals", "wantAudienceAnalysis", "phone"],
    schema: z.object({
      ...baseSchema,
      stores: z.string().min(1, "Número de lojas é obrigatório"),
      hasTerminals: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      wantAudienceAnalysis: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      phone: z.string().min(10, "Telefone inválido"),
    })
  },
  impact: {
    title: "Mupa Impact",
    subtitle: "Estratégia e monetização para grandes redes.",
    fields: ["stores", "hasLoyalty", "hasTradeMarketing", "wantMonetize", "phone"],
    schema: z.object({
      ...baseSchema,
      stores: z.string().min(1, "Número de lojas é obrigatório"),
      hasLoyalty: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      hasTradeMarketing: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      wantMonetize: z.enum(["yes", "no"], { required_error: "Selecione uma opção" }),
      phone: z.string().min(10, "Telefone inválido"),
    })
  }
};

export function LeadFormModal({ isOpen, onClose, type }: LeadFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const config = formConfigs[type];
  const form = useForm({
    resolver: zodResolver(config.schema),
    defaultValues: {
      hasTerminals: undefined,
      hasCameras: undefined,
      wantAudienceAnalysis: undefined,
      hasLoyalty: undefined,
      hasTradeMarketing: undefined,
      wantMonetize: undefined
    }
  });

  // Calculate steps based on fields
  const steps = useMemo(() => {
    const s = [
      {
        id: "contact",
        title: "Vamos começar",
        icon: User,
        fields: ["name", "email", "phone", "jobTitle"].filter(f => 
          ["name", "email"].includes(f) || config.fields.includes(f)
        )
      },
      {
        id: "company",
        title: "Sobre a Empresa",
        icon: Building2,
        fields: ["company", "city", "stores", "screens"].filter(f => 
          ["company"].includes(f) || config.fields.includes(f)
        )
      },
      {
        id: "details",
        title: "Últimos Detalhes",
        icon: HelpCircle,
        fields: config.fields.filter(f => 
          !["name", "email", "phone", "jobTitle", "company", "city", "stores", "screens"].includes(f)
        )
      }
    ];
    return s.filter(step => step.fields.length > 0);
  }, [config.fields]);

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = async () => {
    const fields = currentStepData.fields;
    const isValid = await form.trigger(fields as any);
    
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-lead-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      const result = await res.json();
      if (!result.success) {
        console.error("Lead email error:", result.error);
      }
    } catch (err) {
      console.error("Failed to send lead email:", err);
    }
    setIsSubmitting(false);
    setIsSuccess(true);
    
    // Redirect logic
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      form.reset();
      setCurrentStep(0);
      
      // Navigate to demo if applicable
      if (type === 'demo' || type === 'general') {
        navigate('/demo');
      }
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border text-foreground max-h-[90vh] overflow-y-auto p-0 gap-0">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-16 text-center space-y-6 p-6"
            >
              <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-secondary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold">Tudo Pronto!</h3>
                <p className="text-muted-foreground text-lg">
                  {type === 'demo' 
                    ? "Redirecionando para a demonstração..." 
                    : "Recebemos suas informações com sucesso."}
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col h-full min-h-[500px]">
              {/* Header */}
              <div className="p-6 border-b border-border/40 bg-card/20">
                <div className="flex items-center justify-between mb-4">
                  <DialogTitle className="text-2xl font-bold">{config.title}</DialogTitle>
                  <span className="text-sm font-medium text-muted-foreground bg-card/20 px-3 py-1 rounded-full border border-border/40">
                    Passo {currentStep + 1} de {steps.length}
                  </span>
                </div>
                <DialogDescription className="text-muted-foreground text-base">
                  {config.subtitle}
                </DialogDescription>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-muted mt-6 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                </div>
              </div>

              {/* Form Body */}
              <div className="flex-1 p-6 overflow-y-auto">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <motion.div
                      key={currentStep}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3 text-xl font-semibold text-foreground mb-6">
                        {currentStepData.icon && <currentStepData.icon className="w-6 h-6 text-accent" />}
                        {currentStepData.title}
                      </div>

                      {currentStepData.fields.map((fieldName) => (
                        <div key={fieldName}>
                          {/* Name Field */}
                          {fieldName === "name" && (
                            <FormField
                              control={form.control}
                              name={"name" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Qual seu nome completo?</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: João Silva" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Email Field */}
                          {fieldName === "email" && (
                            <FormField
                              control={form.control}
                              name={"email" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Seu melhor email corporativo</FormLabel>
                                  <FormControl>
                                    <Input placeholder="nome@empresa.com" type="email" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Phone Field */}
                          {fieldName === "phone" && (
                            <FormField
                              control={form.control}
                              name={"phone" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">WhatsApp ou Telefone</FormLabel>
                                  <FormControl>
                                    <Input placeholder="(00) 00000-0000" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Job Title Field */}
                          {fieldName === "jobTitle" && (
                            <FormField
                              control={form.control}
                              name={"jobTitle" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Qual seu cargo atual?</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: Gerente de Marketing" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Company Field */}
                          {fieldName === "company" && (
                            <FormField
                              control={form.control}
                              name={"company" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Nome da Empresa</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: Minha Loja Ltda" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* City Field */}
                          {fieldName === "city" && (
                            <FormField
                              control={form.control}
                              name={"city" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Em qual cidade está a matriz?</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Cidade - UF" className="bg-background border-border h-12 text-lg" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Stores Field */}
                          {fieldName === "stores" && (
                            <FormField
                              control={form.control}
                              name={"stores" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Quantas lojas a rede possui?</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border h-12 text-lg">
                                        <SelectValue placeholder="Selecione uma opção" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1-5">1 a 5 lojas</SelectItem>
                                      <SelectItem value="6-20">6 a 20 lojas</SelectItem>
                                      <SelectItem value="21-50">21 a 50 lojas</SelectItem>
                                      <SelectItem value="51+">Mais de 50 lojas</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Screens Field */}
                          {fieldName === "screens" && (
                            <FormField
                              control={form.control}
                              name={"screens" as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base">Quantas telas você gerencia hoje?</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border h-12 text-lg">
                                        <SelectValue placeholder="Selecione uma opção" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1-10">1 a 10 telas</SelectItem>
                                      <SelectItem value="11-50">11 a 50 telas</SelectItem>
                                      <SelectItem value="51-200">51 a 200 telas</SelectItem>
                                      <SelectItem value="200+">Mais de 200 telas</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Boolean Fields (Yes/No) - Modern Card Style */}
                          {["hasTerminals", "hasCameras", "wantAudienceAnalysis", "hasLoyalty", "hasTradeMarketing", "wantMonetize"].includes(fieldName) && (
                            <FormField
                              control={form.control}
                              name={fieldName as any}
                              render={({ field }) => (
                                <FormItem className="space-y-4 pt-2">
                                  <FormLabel className="text-lg font-medium">
                                    {fieldName === "hasTerminals" && "Você já possui terminais de consulta?"}
                                    {fieldName === "hasCameras" && "Utiliza câmeras ou sensores nas telas?"}
                                    {fieldName === "wantAudienceAnalysis" && "Tem interesse em análise de audiência?"}
                                    {fieldName === "hasLoyalty" && "A empresa possui programa de fidelidade?"}
                                    {fieldName === "hasTradeMarketing" && "Vocês trabalham com verba de Trade Marketing?"}
                                    {fieldName === "wantMonetize" && "Deseja gerar receita com anúncios nas telas?"}
                                  </FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="grid grid-cols-2 gap-4"
                                    >
                                      <FormItem>
                                        <FormControl>
                                          <RadioGroupItem value="yes" id={`${fieldName}-yes`} className="peer sr-only" />
                                        </FormControl>
                                        <Label
                                          htmlFor={`${fieldName}-yes`}
                                          className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-border/40 bg-card/20 hover:bg-card/30 hover:border-border/70 peer-data-[state=checked]:border-accent peer-data-[state=checked]:bg-accent/10 cursor-pointer transition-all duration-200"
                                        >
                                          <span className="text-lg font-bold">Sim</span>
                                        </Label>
                                      </FormItem>
                                      <FormItem>
                                        <FormControl>
                                          <RadioGroupItem value="no" id={`${fieldName}-no`} className="peer sr-only" />
                                        </FormControl>
                                        <Label
                                          htmlFor={`${fieldName}-no`}
                                          className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-border/40 bg-card/20 hover:bg-card/30 hover:border-border/70 peer-data-[state=checked]:border-border peer-data-[state=checked]:bg-muted/30 cursor-pointer transition-all duration-200"
                                        >
                                          <span className="text-lg font-bold">Não</span>
                                        </Label>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </form>
                </Form>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-border/40 bg-card/20 flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0 || isSubmitting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>

                {isLastStep ? (
                  <Button 
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground min-w-[140px] h-11 text-base shadow-lg shadow-accent/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Finalizar
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={handleNext}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px] h-11 text-base"
                  >
                    Próximo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
