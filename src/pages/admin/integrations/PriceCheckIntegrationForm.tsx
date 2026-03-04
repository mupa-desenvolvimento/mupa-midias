
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePriceCheckIntegrations, PriceCheckIntegration } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, ArrowLeft, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";

import { IntegrationMapping } from "./components/IntegrationMapping";

// Validation Schemas
const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  company_id: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]),
  environment: z.enum(["production", "staging"]),
  
  // Auth Config
  auth_type: z.enum(["none", "api_key", "bearer_token", "basic_auth", "oauth2"]),
  auth_config: z.record(z.any()).default({}),
  
  // Endpoint Config
  endpoint_url: z.string().url("URL inválida"),
  method: z.enum(["GET", "POST"]),
  barcode_param_type: z.enum(["query_param", "path_param", "body_json", "form_data"]),
  barcode_param_name: z.string().optional(),
  headers: z.record(z.any()).default({}),
  
  // Mapping Config
  mapping_config: z.record(z.any()).default({}),
});

type FormValues = z.infer<typeof formSchema>;

export default function PriceCheckIntegrationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createIntegration, updateIntegration, integrations } = usePriceCheckIntegrations();
  const { companies } = useCompanies();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const isEditing = !!id && id !== "new";
  const existingIntegration = integrations?.find(i => i.id === id);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company_id: null,
      status: "active",
      environment: "production",
      auth_type: "none",
      auth_config: {},
      endpoint_url: "",
      method: "GET",
      barcode_param_type: "query_param",
      barcode_param_name: "barcode",
      headers: {},
      mapping_config: {},
    },
  });

  useEffect(() => {
    if (existingIntegration) {
      form.reset({
        name: existingIntegration.name,
        company_id: existingIntegration.company_id,
        status: existingIntegration.status,
        environment: existingIntegration.environment,
        auth_type: existingIntegration.auth_type,
        auth_config: existingIntegration.auth_config || {},
        endpoint_url: existingIntegration.endpoint_url,
        method: existingIntegration.method,
        barcode_param_type: existingIntegration.barcode_param_type,
        barcode_param_name: existingIntegration.barcode_param_name || "",
        headers: existingIntegration.headers || {},
        mapping_config: existingIntegration.mapping_config || {},
      });
    }
  }, [existingIntegration, form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateIntegration.mutateAsync({ id, ...values });
      } else {
        await createIntegration.mutateAsync(values);
      }
      navigate("/admin/integrations");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/integrations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {isEditing ? "Editar Integração" : "Nova Integração"}
          </h1>
          <p className="text-muted-foreground">
            Configure os detalhes da conexão com a API de preços
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/20">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="auth">Autenticação</TabsTrigger>
              <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
              <TabsTrigger value="mapping">Mapeamento</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {/* TAB: GERAL */}
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Básicas</CardTitle>
                    <CardDescription>
                      Identificação e escopo da integração
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Integração</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: API ERP Protheus - Loja 01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="company_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa (Opcional)</FormLabel>
                            <Select 
                              onValueChange={(val) => field.onChange(val === "global" ? null : val)}
                              value={field.value || "global"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma empresa ou deixe em branco para global" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="global">Todas as Empresas (Global)</SelectItem>
                                {companies?.map((company) => (
                                  <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Se não selecionado, ficará disponível para qualquer empresa vincular.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="environment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ambiente</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o ambiente" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="production">Produção</SelectItem>
                                <SelectItem value="staging">Homologação / Teste</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Status Ativo</FormLabel>
                            <FormDescription>
                              Desative para suspender temporariamente o uso desta integração
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === "active"}
                              onCheckedChange={(checked) => field.onChange(checked ? "active" : "inactive")}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: AUTH */}
              <TabsContent value="auth">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração de Autenticação</CardTitle>
                    <CardDescription>
                      Como a Mupa deve se autenticar na API do cliente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="auth_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Autenticação</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma (Pública)</SelectItem>
                              <SelectItem value="api_key">API Key (Header)</SelectItem>
                              <SelectItem value="bearer_token">Bearer Token (Estático)</SelectItem>
                              <SelectItem value="basic_auth">Basic Auth (Usuário/Senha)</SelectItem>
                              <SelectItem value="oauth2">OAuth 2.0 (Client Credentials)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Conditional Auth Fields */}
                    {form.watch("auth_type") === "api_key" && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="auth_config.header_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Header</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: X-API-Key" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="auth_config.api_key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Chave da API</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Sua chave secreta" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {form.watch("auth_type") === "bearer_token" && (
                      <FormField
                        control={form.control}
                        name="auth_config.token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token Bearer</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="eyJh..." {...field} />
                            </FormControl>
                            <FormDescription>Insira apenas o token, sem o prefixo "Bearer "</FormDescription>
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch("auth_type") === "basic_auth" && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="auth_config.username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Usuário</FormLabel>
                              <FormControl>
                                <Input placeholder="admin" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="auth_config.password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="******" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {form.watch("auth_type") === "oauth2" && (
                      <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                        <h4 className="font-medium text-sm text-muted-foreground">Configuração OAuth 2.0 (Client Credentials)</h4>
                        <FormField
                          control={form.control}
                          name="auth_config.token_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL do Token</FormLabel>
                              <FormControl>
                                <Input placeholder="https://api.exemplo.com/oauth/token" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.client_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Client ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="auth_config.client_secret"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Client Secret</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="auth_config.scope"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Escopo (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="read:products" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: ENDPOINT */}
              <TabsContent value="endpoint">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração do Endpoint</CardTitle>
                    <CardDescription>
                      Detalhes da requisição HTTP para consultar o produto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-[1fr_3fr] gap-4">
                      <FormField
                        control={form.control}
                        name="method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Método</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Método" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endpoint_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL do Endpoint</FormLabel>
                            <FormControl>
                              <Input placeholder="https://api.cliente.com/v1/produtos" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="barcode_param_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Envio do Código de Barras</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o local" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="query_param">Query Param (?ean=...)</SelectItem>
                                <SelectItem value="path_param">Path Param (/produtos/{"{ean}"})</SelectItem>
                                <SelectItem value="body_json">Body JSON ({"{ \"ean\": ... }"})</SelectItem>
                                <SelectItem value="form_data">Form Data</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      
                      {form.watch("barcode_param_type") !== "path_param" && (
                        <FormField
                          control={form.control}
                          name="barcode_param_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Parâmetro / Campo</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: ean, barcode, gtin" {...field} />
                              </FormControl>
                              <FormDescription>
                                Nome do campo que receberá o código
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {form.watch("barcode_param_type") === "path_param" && (
                      <div className="rounded-md bg-blue-500/10 p-4 text-sm text-blue-400">
                        <p>
                          Para <strong>Path Param</strong>, use <code>{"{barcode}"}</code> na URL do endpoint para indicar onde o código deve ser inserido.
                          <br />
                          Exemplo: <code>https://api.com/produtos/{"{barcode}"}</code>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: MAPPING */}
              <TabsContent value="mapping">
                <Card>
                  <CardHeader>
                    <CardTitle>Mapeamento de Resposta</CardTitle>
                    <CardDescription>
                      Configure como a resposta da API do cliente será transformada no padrão Mupa.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="mapping_config"
                      render={({ field }) => (
                        <IntegrationMapping 
                          value={field.value} 
                          onChange={field.onChange}
                          key={existingIntegration ? `loaded-${existingIntegration.updated_at}` : 'new'} 
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              <Button type="button" variant="outline" onClick={() => navigate("/admin/integrations")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar Integração
              </Button>
            </div>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
