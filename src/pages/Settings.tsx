
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useUserCompany } from "@/hooks/useUserCompany";
import { usePresentationConfig } from "@/hooks/usePresentationConfig";
import { SlideSortableList } from "@/components/presentation/SlideSortableList";
import { Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/useTheme";

const Settings = () => {
  const { company } = useUserCompany();
  const { config, toggleOption, updateConfig } = usePresentationConfig();
  const { integrations, updateIntegration } = usePriceCheckIntegrations();
  const { theme, setTheme } = useTheme();

  const handleIntegrationChange = (id: string) => {
    // Set all others to inactive and this one to active
    if (!integrations) return;
    
    // Deactivate current active integration(s)
    integrations.forEach(i => {
      if (i.id !== id && i.status === 'active') {
        updateIntegration.mutate({ id: i.id, status: 'inactive' });
      }
    });
    
    // Activate the selected one
    updateIntegration.mutate({ id, status: 'active' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-muted-foreground">Gerencie configurações do sistema e usuários</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="ai">IA & Câmera</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="presentation">Apresentação</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Configure as principais opções do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="system-name">Nome do Sistema</Label>
                <Input id="system-name" defaultValue="MupaMídias Pro" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" defaultValue="Minha Empresa" />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tema</Label>
                  <p className="text-sm text-muted-foreground">Escolha a aparência do sistema</p>
                </div>
                <Select value={theme} onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Escuro</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-sync</Label>
                  <p className="text-sm text-muted-foreground">Sincronizar dados automaticamente</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de IA e Câmera</CardTitle>
              <CardDescription>Configure o reconhecimento de público</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reconhecimento Facial</Label>
                  <p className="text-sm text-muted-foreground">Detectar pessoas automaticamente</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Análise de Gênero</Label>
                  <p className="text-sm text-muted-foreground">Identificar gênero estimado</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Análise de Idade</Label>
                  <p className="text-sm text-muted-foreground">Estimar faixa etária</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="confidence">Nível de Confiança (%)</Label>
                <Input id="confidence" type="number" defaultValue="85" min="50" max="100" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="detection-interval">Intervalo de Detecção (ms)</Label>
                <Input id="detection-interval" type="number" defaultValue="500" min="100" max="5000" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>Configure alertas e notificações do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dispositivos Offline</Label>
                  <p className="text-sm text-muted-foreground">Alertar quando dispositivos saírem do ar</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Uploads Concluídos</Label>
                  <p className="text-sm text-muted-foreground">Notificar quando uploads terminarem</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Relatórios Diários</Label>
                  <p className="text-sm text-muted-foreground">Enviar resumo diário por email</p>
                </div>
                <Switch />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="email">Email para Notificações</Label>
                <Input id="email" type="email" defaultValue="admin@empresa.com" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Código de Vinculação</CardTitle>
              <CardDescription>Código da empresa para conectar novos dispositivos</CardDescription>
            </CardHeader>
            <CardContent>
              {company?.code ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/30 space-y-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Smartphone className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Seu código de acesso é:</p>
                    <div className="flex items-center justify-center gap-3">
                      <code className="text-4xl font-mono font-bold tracking-widest text-foreground">
                        {company.code}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(company.code)}
                        title="Copiar código"
                        className="h-10 w-10"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                      Insira este código ao configurar um novo dispositivo no player (tela de "Identificação").
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando informações da empresa...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Controle acesso e permissões</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button className="gradient-primary text-white">
                  Adicionar Usuário
                </Button>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidade será implementada na próxima versão.
                </p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integração de Preços</CardTitle>
              <CardDescription>
                Selecione a integração padrão para consulta de preços da empresa.
                Esta integração será usada por dispositivos que não possuem uma configuração específica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrations && integrations.length > 0 ? (
                <RadioGroup 
                  value={integrations.find(i => i.status === 'active')?.id || ''}
                  onValueChange={handleIntegrationChange}
                  className="space-y-4"
                >
                  {integrations.map((integration) => (
                    <div key={integration.id} className="flex items-center space-x-4 border p-4 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={integration.id} id={integration.id} />
                      <div className="flex-1 cursor-pointer" onClick={() => handleIntegrationChange(integration.id)}>
                        <Label htmlFor={integration.id} className="font-medium text-base cursor-pointer">
                          {integration.name}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {integration.endpoint_url}
                        </p>
                      </div>
                      {integration.status === 'active' && (
                        <span className="text-xs bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full font-medium">
                          Ativa
                        </span>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    Nenhuma integração encontrada.
                  </p>
                  <Button variant="outline" onClick={() => window.location.href='/admin/integrations'}>
                    Configurar Integrações
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presentation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Landing Page</CardTitle>
              <CardDescription>Personalize a exibição dos planos e seções na página inicial</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Plano Lite</Label>
                  <p className="text-sm text-muted-foreground">Exibir o card do plano Lite</p>
                </div>
                <Switch 
                  checked={config.showLite} 
                  onCheckedChange={() => toggleOption('showLite')} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Plano Flow</Label>
                  <p className="text-sm text-muted-foreground">Exibir o card do plano Flow</p>
                </div>
                <Switch 
                  checked={config.showFlow} 
                  onCheckedChange={() => toggleOption('showFlow')} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Plano Insight</Label>
                  <p className="text-sm text-muted-foreground">Exibir o card do plano Insight</p>
                </div>
                <Switch 
                  checked={config.showInsight} 
                  onCheckedChange={() => toggleOption('showInsight')} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Plano Impact</Label>
                  <p className="text-sm text-muted-foreground">Exibir o card do plano Impact</p>
                </div>
                <Switch 
                  checked={config.showImpact} 
                  onCheckedChange={() => toggleOption('showImpact')} 
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Comparativo de Planos</Label>
                  <p className="text-sm text-muted-foreground">Exibir botão para tabela comparativa</p>
                </div>
                <Switch 
                  checked={config.showComparison} 
                  onCheckedChange={() => toggleOption('showComparison')} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Detalhes dos Planos</Label>
                  <p className="text-sm text-muted-foreground">Exibir detalhes e recursos nos cards</p>
                </div>
                <Switch 
                  checked={config.showDetails} 
                  onCheckedChange={() => toggleOption('showDetails')} 
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-0.5">
                  <Label>Ordem dos Slides</Label>
                  <p className="text-sm text-muted-foreground">Arraste para reordenar os slides da apresentação</p>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <SlideSortableList 
                    items={config.slideOrder || []} 
                    onReorder={(newOrder) => updateConfig({ slideOrder: newOrder })} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
