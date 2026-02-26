import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { Capacitor } from '@capacitor/core';
import { 
  Loader2, 
  Building2, 
  Store, 
  Hash, 
  Monitor, 
  Layers, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Search,
  Check,
  Power
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

// --- Types ---
type OnboardingStep = 
  | 'welcome' 
  | 'company_code' 
  | 'store_selection' 
  | 'store_number' 
  | 'device_info' 
  | 'group_selection' 
  | 'confirm';

interface OnboardingState {
  companyCode: string;
  company: { id: string; name: string; tenant_id: string | null } | null;
  store: { id: string; name: string; code: string } | null;
  storeNumberOverride: string;
  deviceName: string;
  group: { id: string; name: string } | null;
}

// --- Validation Schemas ---
const companyCodeSchema = z
  .string()
  .length(6, 'Código deve ter 6 caracteres')
  .regex(/^\d{3}[A-Za-z]{3}$/, 'Formato: 3 números + 3 letras (ex: 123ABC)')
  .transform(val => val.toUpperCase());

// --- Main Component ---
export const DeviceOnboarding: React.FC = () => {
  const { deviceId: urlDeviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  
  // Device ID Management
  const [deviceId, setDeviceId] = useState<string>('');
  
  useEffect(() => {
    if (urlDeviceId && urlDeviceId !== 'new' && !urlDeviceId.startsWith(':')) {
      setDeviceId(urlDeviceId);
    } else {
      // Generate new ID if not provided
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeviceId(code);
      // Update URL silently
      window.history.replaceState(null, '', `/setup/${code}`);
    }
  }, [urlDeviceId]);

  // State
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [direction, setDirection] = useState<number>(1); // 1 for forward, -1 for backward
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<OnboardingState>({
    companyCode: '',
    company: null,
    store: null,
    storeNumberOverride: '',
    deviceName: '',
    group: null
  });

  // Data Lists
  const [stores, setStores] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // --- Handlers ---

  const nextStep = (next: OnboardingStep) => {
    setDirection(1);
    setStep(next);
  };

  const prevStep = (prev: OnboardingStep) => {
    setDirection(-1);
    setStep(prev);
  };

  const handleCompanyCodeSubmit = async () => {
    const result = companyCodeSchema.safeParse(formData.companyCode);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, slug, name, code, tenant_id')
        .eq('is_active', true)
        .eq('code', result.data)
        .single();

      if (error || !company) {
        toast.error('Código de empresa inválido');
        return;
      }

      setFormData(prev => ({ ...prev, company }));
      
      // Pre-fetch stores
      await fetchStores(company.tenant_id);
      
      nextStep('store_selection');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao validar código');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStores = async (tenantId: string | null) => {
    let query = supabase.from('stores').select('id, code, name').eq('is_active', true);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    
    const { data } = await query.order('name');
    setStores(data || []);
  };

  const handleStoreSelect = async (store: any) => {
    setFormData(prev => ({ ...prev, store }));
    
    // Fetch groups for this store
    setIsLoading(true);
    try {
      let query = supabase
        .from('device_groups')
        .select('id, name, description, store_id')
        .or(`store_id.eq.${store.id},store_id.is.null`);
      
      if (formData.company?.tenant_id) {
        query = query.eq('tenant_id', formData.company.tenant_id);
      }
      
      const { data } = await query.order('name');
      setGroups(data || []);
      
      nextStep('store_number');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar grupos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!formData.company || !formData.store || !formData.group) return;

    setIsLoading(true);
    try {
      console.log("Iniciando registro via RPC register_device...");
      
      const payload = {
        p_device_code: deviceId,
        p_name: formData.deviceName || `Dispositivo ${deviceId.slice(0, 8)}`,
        p_store_id: formData.store.id,
        p_company_id: formData.company.id,
        p_group_id: formData.group.id,
        p_store_code: formData.storeNumberOverride || formData.store.code
      };

      const { data, error } = await supabase.rpc('register_device', payload);

      if (error) {
        console.error("Erro no RPC:", error);
        throw error;
      }

      console.log("Registro com sucesso:", data);

      toast.success('Dispositivo configurado com sucesso!');
      
      localStorage.setItem('mupa_device_code', deviceId);

      if (data && typeof data === "object" && "device_token" in data) {
        const token = (data as { device_token?: string }).device_token;
        if (typeof token === "string") {
          localStorage.setItem('mupa_device_token', token);
        }
      }

      navigate(`/play/${deviceId}`, { replace: true });

    } catch (error: any) {
      console.error("Erro detalhado:", error);
      toast.error(`Erro ao salvar configuração: ${error.message || JSON.stringify(error)}`);

      if (Capacitor.isNativePlatform()) {
        const fallbackCode =
          localStorage.getItem('mupa_device_code') || deviceId || 'UWYJKTVA';
        localStorage.setItem('mupa_device_code', fallbackCode);
        navigate(`/play/${fallbackCode}`, { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Animation Variants ---
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
      
      {/* Header Info */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
         <div className="bg-muted/50 px-3 py-1 rounded-full text-xs font-mono text-muted-foreground border">
            ID: {deviceId}
         </div>
         <ThemeToggle />
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        
        {/* Step: Welcome */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Monitor className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Mupa Player</CardTitle>
                <CardDescription>Configuração inicial do dispositivo</CardDescription>
              </CardHeader>
              <CardFooter className="pt-8">
                <Button className="w-full h-12 text-lg group" onClick={() => nextStep('company_code')}>
                  Começar Configuração
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Company Code */}
        {step === 'company_code' && (
          <motion.div
            key="company_code"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Código da Empresa</CardTitle>
                <CardDescription>Insira o código de 6 caracteres fornecido</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="123ABC"
                      className="pl-10 text-center text-2xl font-mono tracking-[0.5em] uppercase h-14"
                      maxLength={6}
                      value={formData.companyCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyCode: e.target.value.toUpperCase() }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleCompanyCodeSubmit()}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => prevStep('welcome')}>Voltar</Button>
                <Button onClick={handleCompanyCodeSubmit} disabled={isLoading || formData.companyCode.length !== 6}>
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Validar'}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Store Selection */}
        {step === 'store_selection' && (
          <motion.div
            key="store_selection"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Selecione a Loja</CardTitle>
                <CardDescription>Empresa: <span className="font-medium text-foreground">{formData.company?.name}</span></CardDescription>
              </CardHeader>
              <CardContent>
                <Command className="border rounded-md">
                  <CommandInput placeholder="Buscar loja..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
                    <CommandGroup heading="Lojas Disponíveis">
                      {stores.map((store) => (
                        <CommandItem 
                          key={store.id} 
                          onSelect={() => handleStoreSelect(store)}
                          className="cursor-pointer p-3"
                        >
                          <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{store.code} - {store.name}</span>
                          <Check className={cn("ml-auto h-4 w-4", formData.store?.id === store.id ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" onClick={() => prevStep('company_code')}>Voltar</Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Store Number (Optional Override) */}
        {step === 'store_number' && (
          <motion.div
            key="store_number"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Número da Loja</CardTitle>
                <CardDescription>Confirme ou altere o número para consulta de preço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                   <div className="p-4 bg-muted/50 rounded-lg flex items-center gap-3">
                      <Store className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{formData.store?.name}</p>
                        <p className="text-xs text-muted-foreground">Código Original: {formData.store?.code}</p>
                      </div>
                   </div>
                   
                   <div className="relative">
                    <Hash className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder={formData.store?.code}
                      value={formData.storeNumberOverride}
                      onChange={(e) => setFormData(prev => ({ ...prev, storeNumberOverride: e.target.value }))}
                      className="pl-10 h-12"
                    />
                   </div>
                   <p className="text-xs text-muted-foreground text-center">Deixe em branco para usar o padrão da loja.</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => prevStep('store_selection')}>Voltar</Button>
                <Button onClick={() => nextStep('device_info')}>Continuar</Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Device Info */}
        {step === 'device_info' && (
          <motion.div
            key="device_info"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Identificação do Dispositivo</CardTitle>
                <CardDescription>Dê um nome para este player</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Monitor className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder={`Dispositivo ${deviceId.slice(0, 4)}...`}
                      value={formData.deviceName}
                      onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
                      className="pl-10 h-12"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => prevStep('store_number')}>Voltar</Button>
                <Button onClick={() => nextStep('group_selection')}>Continuar</Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Group Selection */}
        {step === 'group_selection' && (
          <motion.div
            key="group_selection"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Grupo de Exibição</CardTitle>
                <CardDescription>Selecione o grupo de conteúdo</CardDescription>
              </CardHeader>
              <CardContent>
                 {groups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                       Nenhum grupo encontrado para esta loja.
                    </div>
                 ) : (
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                       {groups.map((group) => (
                          <div 
                             key={group.id}
                             onClick={() => setFormData(prev => ({ ...prev, group }))}
                             className={cn(
                                "flex items-center p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted",
                                formData.group?.id === group.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                             )}
                          >
                             <Layers className="h-5 w-5 text-muted-foreground mr-3" />
                             <div className="flex-1">
                                <p className="font-medium">{group.name}</p>
                                {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
                             </div>
                             {formData.group?.id === group.id && <CheckCircle className="h-5 w-5 text-primary" />}
                          </div>
                       ))}
                    </div>
                 )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => prevStep('device_info')}>Voltar</Button>
                <Button 
                  onClick={() => nextStep('confirm')}
                  disabled={!formData.group}
                >
                  Continuar
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <motion.div
            key="confirm"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md"
          >
            <Card className="border-none shadow-2xl">
              <CardHeader>
                <CardTitle>Confirmar Configuração</CardTitle>
                <CardDescription>Verifique os dados antes de iniciar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-sm text-muted-foreground">Empresa</span>
                       <span className="font-medium">{formData.company?.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-sm text-muted-foreground">Loja</span>
                       <span className="font-medium">{formData.store?.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-sm text-muted-foreground">Código Loja</span>
                       <span className="font-medium font-mono">{formData.storeNumberOverride || formData.store?.code}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-sm text-muted-foreground">Dispositivo</span>
                       <span className="font-medium">{formData.deviceName || 'Sem nome'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-sm text-muted-foreground">Grupo</span>
                       <span className="font-medium">{formData.group?.name}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => prevStep('group_selection')}>Voltar</Button>
                <Button 
                   onClick={handleFinalSubmit} 
                   disabled={isLoading}
                   className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Power className="w-4 h-4 mr-2" />}
                  Iniciar Player
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default DeviceOnboarding;
