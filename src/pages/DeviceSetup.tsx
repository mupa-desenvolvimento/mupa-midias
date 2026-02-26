import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Loader2, Monitor, Building2, Layers, CheckCircle, LogOut, Search, ChevronsUpDown, Check, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Validação do código de empresa: 3 números + 3 letras (ex: 123ABC)
const companyCodeSchema = z
  .string()
  .length(6, 'Código deve ter 6 caracteres')
  .regex(/^\d{3}[A-Za-z]{3}$/, 'Formato: 3 números + 3 letras (ex: 123ABC)')
  .transform(val => val.toUpperCase());

interface Store {
  id: string;
  code: string;
  name: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  description: string | null;
  store_id: string | null;
  screen_type: string | null;
}

interface Company {
  id: string;
  slug: string;
  name: string;
  tenant_id: string | null;
}

type SetupStep = 'login' | 'store' | 'group' | 'complete';

// Gera um código único para o dispositivo (8 caracteres alfanuméricos)
const generateDeviceCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Verifica se é um código de dispositivo literal da URL (ex: ":deviceId")
const isLiteralUrlParam = (id: string | undefined): boolean => {
  if (!id) return true;
  return id.startsWith(':') || id === 'new' || id === 'undefined';
};

export default function DeviceSetup() {
  const { deviceId: urlDeviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  
  // Se não tiver deviceId na URL, for "new", ou for literal ":deviceId", gera um novo
  const [deviceId, setDeviceId] = useState<string>(() => {
    if (isLiteralUrlParam(urlDeviceId)) {
      return generateDeviceCode();
    }
    return urlDeviceId!;
  });
  
  const [step, setStep] = useState<SetupStep>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Login state - agora usa código de empresa
  const [companyCode, setCompanyCode] = useState('');
  const [companyCodeError, setCompanyCodeError] = useState<string | null>(null);
  const [validatedCompany, setValidatedCompany] = useState<Company | null>(null);
  
  // Store/Group state
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [storeSearchOpen, setStoreSearchOpen] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  
  // Device state
  const [deviceName, setDeviceName] = useState('');
  const [storeCode, setStoreCode] = useState('');

  // Se já tem uma empresa validada, vai para store
  // Não depende mais de autenticação Supabase
  useEffect(() => {
    if (validatedCompany) {
      setStep('store');
      fetchUserStores();
    }
  }, [validatedCompany]);

  // Fetch stores filtered by the validated company's tenant
  const fetchUserStores = async () => {
    if (!validatedCompany) return;
    
    setIsLoadingData(true);
    try {
      let query = supabase
        .from('stores')
        .select('id, code, name')
        .eq('is_active', true);
      
      // Filter by tenant_id if the company has one
      if (validatedCompany.tenant_id) {
        query = query.eq('tenant_id', validatedCompany.tenant_id);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      setStores(data || []);
      
      // Auto-select if only one store
      if (data && data.length === 1) {
        setSelectedStoreId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch device groups when store is selected
  useEffect(() => {
    if (selectedStoreId) {
      fetchDeviceGroups(selectedStoreId);
    } else {
      setDeviceGroups([]);
      setSelectedGroupId('');
    }
  }, [selectedStoreId]);

  const fetchDeviceGroups = async (storeId: string) => {
    if (!validatedCompany) return;
    
    setIsLoadingData(true);
    try {
      // Primeiro, verificar se a loja pertence ao tenant da empresa
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, tenant_id')
        .eq('id', storeId)
        .single();
      
      if (storeError) throw storeError;
      
      // Validar que a loja pertence ao mesmo tenant da empresa
      if (validatedCompany.tenant_id && storeData.tenant_id !== validatedCompany.tenant_id) {
        toast.error('Loja não pertence a esta empresa');
        setSelectedStoreId('');
        setDeviceGroups([]);
        return;
      }
      
      // Buscar grupos que pertencem à loja selecionada ou são globais (sem loja)
      // Filtrando também pelo tenant_id da empresa
      let groupsQuery = supabase
        .from('device_groups')
        .select('id, name, description, store_id, screen_type, tenant_id')
        .or(`store_id.eq.${storeId},store_id.is.null`);
      
      // Filtrar por tenant_id se a empresa tiver um
      if (validatedCompany.tenant_id) {
        groupsQuery = groupsQuery.eq('tenant_id', validatedCompany.tenant_id);
      }
      
      const { data, error } = await groupsQuery.order('name');

      if (error) throw error;
      setDeviceGroups(data || []);
    } catch (error) {
      console.error('Error fetching device groups:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Valida o código de empresa e avança para seleção de loja
  const handleCompanyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyCodeError(null);
    
    // Valida formato do código
    const result = companyCodeSchema.safeParse(companyCode);
    if (!result.success) {
      setCompanyCodeError(result.error.errors[0].message);
      return;
    }
    
    const normalizedCode = result.data; // Já está em maiúsculas
    
    setIsSubmitting(true);
    try {
      // Busca empresa pelo campo code (gerado automaticamente na tabela companies)
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, slug, name, code, tenant_id')
        .eq('is_active', true)
        .eq('code', normalizedCode)
        .single();
        
      if (error || !company) {
        setCompanyCodeError('Código de empresa inválido');
        setIsSubmitting(false);
        return;
      }
      
      setValidatedCompany({
        id: company.id,
        slug: company.slug,
        name: company.name,
        tenant_id: company.tenant_id
      });
      toast.success(`Empresa: ${company.name}`);
    } catch (error) {
      console.error('Error validating company code:', error);
      setCompanyCodeError('Erro ao validar código');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCompany = () => {
    setValidatedCompany(null);
    setCompanyCode('');
    setStep('login');
    setSelectedStoreId('');
    setSelectedGroupId('');
  };

  const handleStoreConfirm = () => {
    if (!selectedStoreId) {
      toast.error('Selecione uma loja');
      return;
    }
    setStep('group');
  };

  const handleGroupConfirm = async () => {
    if (!selectedGroupId) {
      toast.error('Selecione um grupo');
      return;
    }
    
    if (!validatedCompany) {
      toast.error('Empresa não validada');
      return;
    }

    setIsSubmitting(true);
    try {
      // Validação final: verificar se a loja pertence ao tenant da empresa
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, tenant_id, code')
        .eq('id', selectedStoreId)
        .single();
      
      if (storeError) {
        throw new Error('Erro ao validar loja');
      }
      
      if (validatedCompany.tenant_id && storeData.tenant_id !== validatedCompany.tenant_id) {
        toast.error('Loja não pertence a esta empresa');
        return;
      }
      
      // Usar o código da loja selecionada se não foi definido manualmente
      const finalStoreCode = storeCode || storeData.code;
      const finalDeviceName = deviceName || `Dispositivo ${deviceId?.slice(0, 8)}`;

      // Usar a função register_device (SECURITY DEFINER) que contorna RLS
      const { data: result, error: rpcError } = await supabase.rpc('register_device', {
        p_device_code: deviceId,
        p_name: finalDeviceName,
        p_store_id: selectedStoreId,
        p_company_id: validatedCompany.id,
        p_group_id: selectedGroupId,
        p_store_code: finalStoreCode,
      });

      if (rpcError) {
        console.error('RPC register_device error:', rpcError);
        throw new Error(rpcError.message || 'Erro ao registrar dispositivo');
      }

      console.log('Device registered successfully:', result);
      
      // Salva device_token para heartbeat e autenticação do dispositivo
      const resultObj = result as any;
      if (resultObj?.device_token) {
        localStorage.setItem(`device_token_${deviceId}`, resultObj.device_token);
        console.log('Device token saved for heartbeat');
      }
      
      toast.success('Dispositivo configurado com sucesso!');
      setStep('complete');
      
      // Se o deviceId foi gerado automaticamente (não veio da URL),
      // atualiza a URL para refletir o novo ID
      if (!urlDeviceId || urlDeviceId === 'new') {
        window.history.replaceState(null, '', `/setup/${deviceId}`);
      }
    } catch (error) {
      console.error('Error configuring device:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao configurar dispositivo';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gerar novo ID e reiniciar configuração
  const handleGenerateNewId = () => {
    const newCode = generateDeviceCode();
    setDeviceId(newCode);
    setStep('store'); // Volta para seleção de loja
    setSelectedGroupId('');
    toast.success(`Novo ID gerado: ${newCode}`);
    window.history.replaceState(null, '', `/setup/${newCode}`);
  };

  const handleStartPlayer = () => {
    if (deviceId) {
      localStorage.setItem('mupa_device_code', deviceId);
      navigate(`/play/${deviceId}`);
    }
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const selectedGroup = deviceGroups.find(g => g.id === selectedGroupId);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <span className="font-semibold">Configuração do Dispositivo</span>
        </div>
        <div className="flex items-center gap-2">
          {validatedCompany && (
            <Button variant="ghost" size="sm" onClick={handleResetCompany}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Steps indicator */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-8">
            {(['login', 'store', 'group', 'complete'] as SetupStep[]).map((s, index) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step === s ? 'bg-primary text-primary-foreground' : 
                    ((['login', 'store', 'group', 'complete'].indexOf(step) > index) ? 
                      'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}
                `}>
                  {['login', 'store', 'group', 'complete'].indexOf(step) > index ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${
                    ['login', 'store', 'group', 'complete'].indexOf(step) > index ? 
                      'bg-primary/50' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-4">
        <Card className="w-full max-w-md">
          {/* Login Step - Código de Empresa */}
          {step === 'login' && (
            <>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle>Identificação</CardTitle>
                <CardDescription>
                  Digite o código da empresa para configurar o dispositivo
                </CardDescription>
                <div className="bg-muted/50 p-2 rounded-lg">
                  <code className="text-xs text-muted-foreground">ID do Dispositivo: {deviceId}</code>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompanyCodeSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyCode">Código da Empresa</Label>
                    <Input
                      id="companyCode"
                      type="text"
                      placeholder="123ABC"
                      value={companyCode}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().slice(0, 6);
                        setCompanyCode(value);
                        setCompanyCodeError(null);
                      }}
                      maxLength={6}
                      className="text-center text-2xl font-mono tracking-widest uppercase"
                      required
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Formato: 3 números + 3 letras (ex: 123ABC)
                    </p>
                    {companyCodeError && (
                      <p className="text-xs text-destructive text-center">{companyCodeError}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || companyCode.length !== 6}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      'Continuar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* Store Selection Step */}
          {step === 'store' && (
            <>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle>Selecione a Loja</CardTitle>
                <CardDescription>
                  Escolha a loja onde este dispositivo será instalado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma loja disponível
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Loja</Label>
                      <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={storeSearchOpen}
                            className="w-full justify-between font-normal"
                          >
                            {selectedStoreId ? (
                              <span>
                                <span className="font-medium">{stores.find(s => s.id === selectedStoreId)?.code}</span>
                                <span className="text-muted-foreground ml-2">- {stores.find(s => s.id === selectedStoreId)?.name}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Buscar loja por código ou nome...</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Digite código ou nome da loja..." 
                              value={storeSearchQuery}
                              onValueChange={setStoreSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
                              <CommandGroup>
                                {stores
                                  .filter(store => {
                                    if (!storeSearchQuery) return true;
                                    const query = storeSearchQuery.toLowerCase();
                                    return store.code.toLowerCase().includes(query) || 
                                           store.name.toLowerCase().includes(query);
                                  })
                                  .slice(0, 50) // Limit results for performance
                                  .map((store) => (
                                    <CommandItem
                                      key={store.id}
                                      value={store.id}
                                      onSelect={() => {
                                        setSelectedStoreId(store.id);
                                        setStoreSearchOpen(false);
                                        setStoreSearchQuery('');
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedStoreId === store.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="font-medium">{store.code}</span>
                                      <span className="text-muted-foreground ml-2">- {store.name}</span>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {stores.length > 50 && (
                        <p className="text-xs text-muted-foreground">
                          {stores.length} lojas disponíveis. Use a busca para filtrar.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deviceName">Nome do Dispositivo (opcional)</Label>
                      <Input
                        id="deviceName"
                        placeholder={`Dispositivo ${deviceId?.slice(0, 8)}`}
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storeCode">Código da Filial (Consulta Preço)</Label>
                      <Input
                        id="storeCode"
                        placeholder="Ex: 8"
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Código usado na API de consulta de preços (ex: loja=8)
                      </p>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleStoreConfirm}
                      disabled={!selectedStoreId}
                    >
                      Continuar
                    </Button>
                  </>
                )}
              </CardContent>
            </>
          )}

          {/* Group Selection Step */}
          {step === 'group' && (
            <>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Layers className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle>Selecione o Grupo</CardTitle>
                <CardDescription>
                  Escolha o grupo de dispositivos para definir o conteúdo
                </CardDescription>
                {selectedStore && (
                  <div className="bg-muted/50 p-2 rounded-lg">
                    <span className="text-sm">
                      Loja: <strong>{selectedStore.code}</strong> - {selectedStore.name}
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : deviceGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum grupo disponível para esta loja
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Grupo</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          {deviceGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{group.name}</span>
                                {group.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {group.description}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={() => setStep('store')}
                      >
                        Voltar
                      </Button>
                      <Button 
                        className="flex-1" 
                        onClick={handleGroupConfirm}
                        disabled={!selectedGroupId || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Confirmar'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <>
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle>Configuração Concluída!</CardTitle>
                <CardDescription>
                  O dispositivo está pronto para iniciar a reprodução
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ID do Dispositivo em destaque */}
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Código do Dispositivo</p>
                  <p className="text-2xl font-mono font-bold text-primary tracking-wider">{deviceId}</p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium">{deviceName || `Dispositivo ${deviceId?.slice(0, 8)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loja:</span>
                    <span className="font-medium">{selectedStore?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grupo:</span>
                    <span className="font-medium">{selectedGroup?.name}</span>
                  </div>
                  {storeCode && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filial (API):</span>
                      <span className="font-medium">{storeCode}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={handleStartPlayer}>
                    <Monitor className="mr-2 h-4 w-4" />
                    Iniciar Player
                  </Button>
                  
                  <Button variant="outline" className="w-full" onClick={handleGenerateNewId}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Configurar Outro Dispositivo
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
