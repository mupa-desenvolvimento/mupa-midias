
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ArrowLeft, Check, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";
import { supabase } from "@/integrations/supabase/client";

import { IntegrationMapping } from "./components/IntegrationMapping";
import { inferCommonVariables, parseCurl, type ParsedCurl } from "@/lib/parseCurl";

// Validation Schemas
const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  company_id: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]),
  environment: z.enum(["production", "staging"]),
  
  // Auth Config
  auth_curl_text: z.string().default(""),
  auth_token_path: z.string().optional().nullable(),
  token_expiration_seconds: z.coerce.number().int().positive().optional().nullable(),
  auth_type: z.enum(["none", "api_key", "bearer_token", "basic_auth", "oauth2"]),
  auth_config: z.record(z.any()).default({}),
  
  // Endpoint Config
  request_curl_text: z.string().default(""),
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
  const [isTestingAuth, setIsTestingAuth] = useState(false);
  const [isTestingAuthEndpoint, setIsTestingAuthEndpoint] = useState(false);
  const [isTestingBodyAuthEndpoint, setIsTestingBodyAuthEndpoint] = useState(false);
  const [isTestingRequest, setIsTestingRequest] = useState(false);
  const [lastAuthTest, setLastAuthTest] = useState<{ tokenPreview?: string; expiresAt?: string } | null>(null);
  const [lastAuthEndpointTest, setLastAuthEndpointTest] = useState<{ status: number; response: any; tokenPreview?: string; expiresAt?: string } | null>(null);
  const [lastBodyAuthEndpointTest, setLastBodyAuthEndpointTest] = useState<{ status: number; response: any; tokenPreview?: string } | null>(null);
  const [lastRequestTest, setLastRequestTest] = useState<{ status: number; response: any; request?: any; product?: any; error?: string | null; responseTimeMs?: number } | null>(null);
  const [testBarcode, setTestBarcode] = useState("");
  const [testStoreCode, setTestStoreCode] = useState("");
  const [parsedAuth, setParsedAuth] = useState<ParsedCurl | null>(null);
  const [parsedRequest, setParsedRequest] = useState<ParsedCurl | null>(null);

  const isEditing = !!id && id !== "new";
  const existingIntegration = integrations?.find(i => i.id === id);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company_id: null,
      status: "active",
      environment: "production",
      auth_curl_text: "",
      auth_token_path: "token",
      token_expiration_seconds: 3600,
      auth_type: "none",
      auth_config: {},
      request_curl_text: "",
      endpoint_url: "",
      method: "GET",
      barcode_param_type: "query_param",
      barcode_param_name: "barcode",
      headers: {},
      mapping_config: {},
    },
  });

  const tokenHeadersArray = useFieldArray({
    control: form.control,
    name: "auth_config.token_headers" as any,
  });

  const testHeadersArray = useFieldArray({
    control: form.control,
    name: "auth_config.test_headers" as any,
  });

  const handleTestAuth = async () => {
    if (!isEditing || !id) return;
    setIsTestingAuth(true);
    setLastAuthTest(null);
    try {
      const { data, error } = await supabase.functions.invoke("price-check-proxy", {
        body: {
          action: "auth_test",
          integration_id: id,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Falha ao testar autenticação");
      }

      if (data?.token_preview) {
        setLastAuthTest({ tokenPreview: data.token_preview, expiresAt: data.expires_at });
        toast.success("Token obtido com sucesso");
      } else {
        setLastAuthTest(null);
        toast.success(data?.message || "Autenticação OK");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar autenticação");
    } finally {
      setIsTestingAuth(false);
    }
  };

  const handleTestAuthEndpoint = async () => {
    if (!isEditing || !id) return;
    setIsTestingAuthEndpoint(true);
    setLastAuthEndpointTest(null);
    try {
      const { data, error } = await supabase.functions.invoke("price-check-proxy", {
        body: {
          action: "auth_endpoint_test",
          integration_id: id,
        },
      });

      if (error) throw error;
      if (!data) throw new Error("Sem resposta do servidor");

      setLastAuthEndpointTest({
        status: Number(data.status ?? 0),
        response: data.response,
        tokenPreview: data.token_preview,
        expiresAt: data.expires_at,
      });

      if (data.success) {
        toast.success("Endpoint respondeu");
      } else {
        toast.error("Endpoint respondeu com falha");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar endpoint");
    } finally {
      setIsTestingAuthEndpoint(false);
    }
  };

  const handleTestBodyAuthEndpoint = async () => {
    const values = form.getValues();
    const username = (values as any)?.auth_config?.username ?? (values as any)?.auth_config?.usuario;
    const password = (values as any)?.auth_config?.password;
    const testEndpointUrl = (values as any)?.auth_config?.test_endpoint_url;
    const testMethod = (values as any)?.auth_config?.test_method;
    const testTokenJsonPath = (values as any)?.auth_config?.test_token_json_path;
    const testHeaders = (values as any)?.auth_config?.test_headers;

    if (!testEndpointUrl || !username || !password) return;

    setIsTestingBodyAuthEndpoint(true);
    setLastBodyAuthEndpointTest(null);
    try {
      const requestBody: any = isEditing && id
        ? { action: "auth_body_test", integration_id: id }
        : {
            action: "auth_body_test_direct",
            test_endpoint_url: testEndpointUrl,
            test_method: testMethod,
            test_token_json_path: testTokenJsonPath,
            test_headers: testHeaders,
            usuario: username,
            password,
          };

      const { data, error } = await supabase.functions.invoke("price-check-proxy", { body: requestBody });

      if (error) throw error;
      if (!data) throw new Error("Sem resposta do servidor");

      setLastBodyAuthEndpointTest({
        status: Number(data.status ?? 0),
        response: data.response,
        tokenPreview: data.token_preview,
      });

      if (data.success) {
        toast.success("Endpoint respondeu");
      } else {
        toast.error("Endpoint respondeu com falha");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar endpoint");
    } finally {
      setIsTestingBodyAuthEndpoint(false);
    }
  };

  const handleTestRequest = async () => {
    if (!isEditing || !id) return;
    const barcode = String(testBarcode || "").trim();
    if (!barcode) {
      toast.error("Informe um código de barras para testar");
      return;
    }
    setIsTestingRequest(true);
    setLastRequestTest(null);
    try {
      const { data, error } = await supabase.functions.invoke("price-check-proxy", {
        body: {
          action: "request_test",
          integration_id: id,
          barcode,
          store_code: String(testStoreCode || "").trim() || undefined,
        },
      });

      if (error) throw error;
      if (!data) throw new Error("Sem resposta do servidor");

      setLastRequestTest({
        status: Number(data.status ?? 0),
        response: data.response,
        request: data.request,
        product: data.product,
        error: data.error ?? null,
        responseTimeMs: typeof data.response_time_ms === "number" ? data.response_time_ms : undefined,
      });

      if (data.success) {
        toast.success("Request executado e resposta salva");
      } else {
        toast.error("Request executado com falha (resposta salva)");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar request");
    } finally {
      setIsTestingRequest(false);
    }
  };

  useEffect(() => {
    if (existingIntegration) {
      form.reset({
        name: existingIntegration.name,
        company_id: existingIntegration.company_id,
        status: existingIntegration.status,
        environment: existingIntegration.environment,
        auth_curl_text: (existingIntegration as any).auth_curl ?? "",
        auth_token_path: (existingIntegration as any).auth_token_path ?? "",
        token_expiration_seconds: (existingIntegration as any).token_expiration_seconds ?? null,
        auth_type: existingIntegration.auth_type,
        auth_config: existingIntegration.auth_config || {},
        request_curl_text: (existingIntegration as any).request_curl ?? "",
        endpoint_url: existingIntegration.endpoint_url,
        method: existingIntegration.method,
        barcode_param_type: existingIntegration.barcode_param_type,
        barcode_param_name: existingIntegration.barcode_param_name || "",
        headers: existingIntegration.headers || {},
        mapping_config: existingIntegration.mapping_config || {},
      });
    }
  }, [existingIntegration, form]);

  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === "auth_curl_text") {
        const raw = String((values as any).auth_curl_text ?? "").trim();
        if (!raw) {
          setParsedAuth(null);
          return;
        }
        try {
          const parsed = inferCommonVariables(parseCurl(raw));
          setParsedAuth(parsed);
        } catch {
          setParsedAuth(null);
        }
      }

      if (name === "request_curl_text") {
        const raw = String((values as any).request_curl_text ?? "").trim();
        if (!raw) {
          setParsedRequest(null);
          return;
        }
        try {
          const parsed = inferCommonVariables(parseCurl(raw));
          setParsedRequest(parsed);
          if (parsed.urlWithoutQuery) {
            form.setValue("endpoint_url", parsed.urlWithoutQuery, { shouldDirty: true });
          }
          if (parsed.method === "GET" || parsed.method === "POST") {
            form.setValue("method", parsed.method, { shouldDirty: true });
          }
        } catch {
          setParsedRequest(null);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      let authParsed: ParsedCurl | null = null;
      let requestParsed: ParsedCurl | null = null;

      if (values.auth_curl_text?.trim()) {
        try {
          authParsed = inferCommonVariables(parseCurl(values.auth_curl_text));
        } catch {
          authParsed = null;
        }
      }

      if (values.request_curl_text?.trim()) {
        try {
          requestParsed = inferCommonVariables(parseCurl(values.request_curl_text));
        } catch {
          requestParsed = null;
        }
      }

      const payload: Partial<PriceCheckIntegration> & Record<string, any> = {
        ...values,
        auth_curl: values.auth_curl_text?.trim() ? values.auth_curl_text : null,
        request_curl: values.request_curl_text?.trim() ? values.request_curl_text : null,
        auth_url: authParsed?.urlWithoutQuery || null,
        auth_method: authParsed?.method || null,
        auth_headers_json: authParsed?.headers || {},
        auth_query_params_json: authParsed?.query || {},
        auth_body_json: authParsed?.bodyJson != null ? authParsed.bodyJson : {},
        auth_body_text: authParsed?.bodyJson == null ? (authParsed?.bodyText || null) : null,
        auth_token_path: values.auth_token_path?.trim() ? values.auth_token_path : null,
        token_expiration_seconds: values.token_expiration_seconds ?? null,
        request_url: requestParsed?.urlWithoutQuery || values.endpoint_url,
        request_method: requestParsed?.method || values.method,
        request_headers_json: requestParsed?.headers || {},
        request_query_params_json: requestParsed?.query || {},
        request_body_json: requestParsed?.bodyJson != null ? requestParsed.bodyJson : {},
        request_body_text: requestParsed?.bodyJson == null ? (requestParsed?.bodyText || null) : null,
        request_variables_json: requestParsed?.variables || [],
        endpoint_url: values.endpoint_url || requestParsed?.urlWithoutQuery || "",
      };

      if (isEditing) {
        await updateIntegration.mutateAsync({ id, ...payload });
      } else {
        await createIntegration.mutateAsync(payload);
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
                      name="auth_curl_text"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auth CURL (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="curl --location 'https://api.cliente.com/login' --header 'Content-Type: application/json' --data '{...}'" {...field} value={field.value ?? ""} className="font-mono min-h-[160px]" />
                          </FormControl>
                          <FormDescription>
                            Cole uma requisição CURL completa. O sistema extrai URL, método, headers, body e query params para salvar estruturado.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {parsedAuth?.variables?.length ? (
                      <div className="rounded-md border border-white/10 bg-muted/10 p-3 text-sm text-muted-foreground">
                        Variáveis detectadas: {parsedAuth.variables.map((v) => `{${v.name}}`).join(", ")}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="auth_token_path"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token path</FormLabel>
                            <FormControl>
                              <Input placeholder="token | data.token | access_token" {...field} value={field.value ?? ""} className="font-mono" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="token_expiration_seconds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiração (segundos)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={(field.value as any) ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                                <Input placeholder="Ex: X-API-Key" {...field} value={field.value ?? ""} />
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
                                <Input type="password" placeholder="Sua chave secreta" {...field} value={field.value ?? ""} />
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
                              <Input type="password" placeholder="eyJh..." {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormDescription>Insira apenas o token, sem o prefixo "Bearer "</FormDescription>
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch("auth_type") === "basic_auth" && (
                      <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                        <h4 className="font-medium text-sm text-muted-foreground">Configuração Basic Auth</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Usuário</FormLabel>
                                <FormControl>
                                  <Input placeholder="admin" {...field} value={field.value ?? ""} />
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
                                  <Input type="password" placeholder="******" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator className="bg-white/10" />

                        <h4 className="font-medium text-sm text-muted-foreground">Teste de Endpoint (Body com usuário/senha)</h4>
                        <FormField
                          control={form.control}
                          name="auth_config.test_endpoint_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endpoint de Teste</FormLabel>
                              <FormControl>
                                <Input placeholder="https://api.cliente.com/api/login/login" {...field} value={field.value ?? ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.test_method"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Método</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? "POST"}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="GET">GET</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="auth_config.test_token_json_path"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Caminho do Token (Opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="token" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Headers (Opcional)</div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => testHeadersArray.append({ name: "", value: "" })}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" /> Adicionar header
                            </Button>
                          </div>

                          {testHeadersArray.fields.length ? (
                            <div className="space-y-2">
                              {testHeadersArray.fields.map((f, index) => (
                                <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                  <FormField
                                    control={form.control}
                                    name={`auth_config.test_headers.${index}.name` as any}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Nome</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Content-Type" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`auth_config.test_headers.${index}.value` as any}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Valor</FormLabel>
                                        <FormControl>
                                          <Input placeholder="application/json" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <Button type="button" variant="ghost" size="icon" onClick={() => testHeadersArray.remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestBodyAuthEndpoint}
                            disabled={
                              isTestingBodyAuthEndpoint ||
                              !form.watch("auth_config.test_endpoint_url") ||
                              !(form.watch("auth_config.username") || (form.watch("auth_config.usuario") as any)) ||
                              !form.watch("auth_config.password")
                            }
                            className="gap-2"
                          >
                            {isTestingBodyAuthEndpoint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Testar endpoint
                          </Button>
                          {lastBodyAuthEndpointTest?.tokenPreview ? (
                            <div className="text-xs text-muted-foreground">
                              Token: <span className="font-mono">{lastBodyAuthEndpointTest.tokenPreview}</span>
                            </div>
                          ) : null}
                        </div>

                        {lastBodyAuthEndpointTest ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Status: <span className="font-mono">{lastBodyAuthEndpointTest.status}</span>
                            </div>
                            <div className="rounded-md bg-black/20 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                              {typeof lastBodyAuthEndpointTest.response === "string"
                                ? lastBodyAuthEndpointTest.response
                                : JSON.stringify(lastBodyAuthEndpointTest.response, null, 2)}
                            </div>
                          </div>
                        ) : null}
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
                                <Input placeholder="https://api.exemplo.com/oauth/token" {...field} value={field.value ?? ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Headers do Token (Opcional)</div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => tokenHeadersArray.append({ name: "", value: "" })}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" /> Adicionar header
                            </Button>
                          </div>

                          {tokenHeadersArray.fields.length ? (
                            <div className="space-y-2">
                              {tokenHeadersArray.fields.map((f, index) => (
                                <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                  <FormField
                                    control={form.control}
                                    name={`auth_config.token_headers.${index}.name` as any}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Nome</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Content-Type" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`auth_config.token_headers.${index}.value` as any}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Valor</FormLabel>
                                        <FormControl>
                                          <Input placeholder="application/json" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <Button type="button" variant="ghost" size="icon" onClick={() => tokenHeadersArray.remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.client_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Client ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="" {...field} value={field.value ?? ""} />
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
                                  <Input type="password" placeholder="" {...field} value={field.value ?? ""} />
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
                                <Input placeholder="read:products" {...field} value={field.value ?? ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Separator className="bg-white/10" />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.usuario"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Usuário (Opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="mupa" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="auth_config.password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha (Opcional)</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="******" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="auth_config.token_json_path"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Caminho do Token (Opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="token" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormDescription>Ex: token, access_token, data.token</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="auth_config.expires_in_seconds"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Expiração (seg) (Opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="3600" {...field} value={field.value == null ? "" : String(field.value)} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" onClick={handleTestAuth} disabled={!isEditing || isTestingAuth} className="gap-2">
                              {isTestingAuth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Testar token
                            </Button>
                            <Button type="button" variant="outline" onClick={handleTestAuthEndpoint} disabled={!isEditing || isTestingAuthEndpoint} className="gap-2">
                              {isTestingAuthEndpoint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Testar endpoint
                            </Button>
                          </div>
                          {lastAuthTest?.tokenPreview ? (
                            <div className="text-xs text-muted-foreground">
                              Token: <span className="font-mono">{lastAuthTest.tokenPreview}</span>
                              {lastAuthTest.expiresAt ? (
                                <span className="ml-2">Expira: <span className="font-mono">{lastAuthTest.expiresAt}</span></span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {lastAuthEndpointTest ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Status: <span className="font-mono">{lastAuthEndpointTest.status}</span>
                              {lastAuthEndpointTest.tokenPreview ? (
                                <span className="ml-2">Token: <span className="font-mono">{lastAuthEndpointTest.tokenPreview}</span></span>
                              ) : null}
                              {lastAuthEndpointTest.expiresAt ? (
                                <span className="ml-2">Expira: <span className="font-mono">{lastAuthEndpointTest.expiresAt}</span></span>
                              ) : null}
                            </div>
                            <div className="rounded-md bg-black/20 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                              {typeof lastAuthEndpointTest.response === "string"
                                ? lastAuthEndpointTest.response
                                : JSON.stringify(lastAuthEndpointTest.response, null, 2)}
                            </div>
                          </div>
                        ) : null}
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
                    <FormField
                      control={form.control}
                      name="request_curl_text"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Request CURL</FormLabel>
                          <FormControl>
                            <Textarea placeholder="curl --location 'https://api.cliente.com/v1/precos?loja=1&ean={barcode}' --header 'Authorization: Bearer {token}'" {...field} value={field.value ?? ""} className="font-mono min-h-[200px]" />
                          </FormControl>
                          <FormDescription>
                            Cole a CURL de consulta de preço. Variáveis como <code>{"{barcode}"}</code> e <code>{"{store}"}</code> podem ser usadas no URL, query, headers e body.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {parsedRequest?.variables?.length ? (
                      <div className="rounded-md border border-white/10 bg-muted/10 p-3 text-sm text-muted-foreground">
                        Variáveis detectadas: {parsedRequest.variables.map((v) => `{${v.name}}`).join(", ")}
                      </div>
                    ) : null}

                    <div className="rounded-md border border-white/10 bg-muted/10 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">Testar Request</div>
                          <div className="text-xs text-muted-foreground">
                            Executa a requisição usando a configuração salva e registra a resposta em <span className="font-mono">price_check_logs</span>
                          </div>
                        </div>
                        <Button type="button" variant="secondary" onClick={handleTestRequest} disabled={!isEditing || isTestingRequest}>
                          {isTestingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          <span className="ml-2">{isTestingRequest ? "Testando..." : "Testar"}</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-white">Código de barras</div>
                          <Input value={testBarcode} onChange={(e) => setTestBarcode(e.target.value)} placeholder="7891234567890" className="font-mono" />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-white">Store code (opcional)</div>
                          <Input value={testStoreCode} onChange={(e) => setTestStoreCode(e.target.value)} placeholder="0001" className="font-mono" />
                        </div>
                      </div>

                      {lastRequestTest ? (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            Status: <span className="font-mono">{lastRequestTest.status}</span>
                            {typeof lastRequestTest.responseTimeMs === "number" ? (
                              <span className="ml-2">Tempo: <span className="font-mono">{lastRequestTest.responseTimeMs}ms</span></span>
                            ) : null}
                            {lastRequestTest.error ? (
                              <span className="ml-2">Erro: <span className="font-mono">{lastRequestTest.error}</span></span>
                            ) : null}
                          </div>

                          {lastRequestTest.request ? (
                            <div className="rounded-md bg-black/20 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                              {`${String(lastRequestTest.request.method || "")} ${String(lastRequestTest.request.url || "")}`}
                            </div>
                          ) : null}

                          <div className="rounded-md bg-black/20 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                            {typeof lastRequestTest.response === "string"
                              ? lastRequestTest.response
                              : JSON.stringify(lastRequestTest.response, null, 2)}
                          </div>
                        </div>
                      ) : null}
                    </div>

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
