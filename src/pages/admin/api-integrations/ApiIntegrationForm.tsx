import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApiIntegrations } from "@/hooks/useApiIntegrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { inferCommonVariables, parseCurl, type ParsedCurl } from "@/lib/parseCurl";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  slug: z.string().min(1, "Slug é obrigatório"),
  base_url: z.string().min(1, "Base URL é obrigatória"),
  is_active: z.boolean().default(true),

  auth_curl_text: z.string().default(""),
  auth_url: z.string().optional().nullable(),
  auth_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  auth_headers_json_text: z.string().default("{}"),
  auth_query_params_json_text: z.string().default("{}"),
  auth_body_text: z.string().default(""),
  auth_body_json_text: z.string().default("{}"),
  auth_token_path: z.string().optional().nullable(),
  token_expiration_seconds: z.coerce.number().int().positive().optional().nullable(),

  request_curl_text: z.string().default(""),
  request_url: z.string().optional().nullable(),
  request_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  request_headers_json_text: z.string().default("{}"),
  request_params_json_text: z.string().default("{}"),
  request_query_params_json_text: z.string().default("{}"),
  request_body_json_text: z.string().default("{}"),
  request_body_text: z.string().default(""),
  barcode_param_name: z.string().optional().nullable(),
  store_param_name: z.string().optional().nullable(),

  response_mapping_json_text: z.string().default("{}"),
});

type FormValues = z.infer<typeof formSchema>;

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
};

const parseJsonOrThrow = (label: string, text: string) => {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error(`${label} deve ser um JSON (objeto/array)`);
    }
    return parsed;
  } catch (e: any) {
    throw new Error(`${label} inválido: ${e?.message || "erro ao parsear"}`);
  }
};

export default function ApiIntegrationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { integrations, createIntegration, updateIntegration } = useApiIntegrations();
  const isEditing = !!id && id !== "new";

  const integration = useMemo(() => {
    return integrations?.find((i) => i.id === id);
  }, [integrations, id]);

  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [testBarcode, setTestBarcode] = useState("");
  const [testStore, setTestStore] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [parsedAuth, setParsedAuth] = useState<ParsedCurl | null>(null);
  const [parsedRequest, setParsedRequest] = useState<ParsedCurl | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      base_url: "",
      is_active: true,
      auth_url: "",
      auth_method: "POST",
      auth_curl_text: "",
      auth_headers_json_text: "{}",
      auth_query_params_json_text: "{}",
      auth_body_text: "",
      auth_body_json_text: "{\n  \"usuario\": \"\",\n  \"password\": \"\"\n}",
      auth_token_path: "token",
      token_expiration_seconds: 3600,
      request_curl_text: "",
      request_url: "",
      request_method: "GET",
      request_headers_json_text: "{\n  \"Authorization\": \"Bearer {token}\"\n}",
      request_params_json_text: "{\n  \"loja\": \"{store}\",\n  \"ean\": \"{barcode}\"\n}",
      request_query_params_json_text: "{}",
      request_body_json_text: "{}",
      request_body_text: "",
      barcode_param_name: "ean",
      store_param_name: "loja",
      response_mapping_json_text: "{\n  \"name\": \"descricao\",\n  \"price\": \"preco\",\n  \"promo_price\": \"promo\",\n  \"image\": \"image\"\n}",
    },
  });

  useEffect(() => {
    if (integration) {
      form.reset({
        name: integration.name,
        slug: integration.slug,
        base_url: integration.base_url,
        is_active: !!integration.is_active,
        auth_curl_text: (integration as any).auth_curl ?? "",
        auth_url: integration.auth_url || "",
        auth_method: (String(integration.auth_method || "POST").toUpperCase() as any) || "POST",
        auth_headers_json_text: JSON.stringify((integration as any).auth_headers_json ?? {}, null, 2),
        auth_query_params_json_text: JSON.stringify((integration as any).auth_query_params_json ?? {}, null, 2),
        auth_body_text: String((integration as any).auth_body_text ?? ""),
        auth_body_json_text: JSON.stringify(integration.auth_body_json ?? {}, null, 2),
        auth_token_path: integration.auth_token_path || "",
        token_expiration_seconds: integration.token_expiration_seconds ?? null,
        request_curl_text: (integration as any).request_curl ?? "",
        request_url: integration.request_url || "",
        request_method: (String(integration.request_method || "GET").toUpperCase() as any) || "GET",
        request_headers_json_text: JSON.stringify(integration.request_headers_json ?? {}, null, 2),
        request_params_json_text: JSON.stringify(integration.request_params_json ?? {}, null, 2),
        request_query_params_json_text: JSON.stringify((integration as any).request_query_params_json ?? {}, null, 2),
        request_body_json_text: JSON.stringify((integration as any).request_body_json ?? {}, null, 2),
        request_body_text: String((integration as any).request_body_text ?? ""),
        barcode_param_name: integration.barcode_param_name || "",
        store_param_name: integration.store_param_name || "",
        response_mapping_json_text: JSON.stringify(integration.response_mapping_json ?? {}, null, 2),
      });
    }
  }, [integration, form]);

  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === "auth_curl_text") {
        const raw = String(values.auth_curl_text ?? "").trim();
        if (!raw) {
          setParsedAuth(null);
          return;
        }
        try {
          const parsed = inferCommonVariables(parseCurl(raw));
          setParsedAuth(parsed);
          if (parsed.urlWithoutQuery) form.setValue("auth_url", parsed.urlWithoutQuery, { shouldDirty: true });
          if (parsed.method) form.setValue("auth_method", parsed.method as any, { shouldDirty: true });
          form.setValue("auth_headers_json_text", JSON.stringify(parsed.headers ?? {}, null, 2), { shouldDirty: true });
          form.setValue("auth_query_params_json_text", JSON.stringify(parsed.query ?? {}, null, 2), { shouldDirty: true });
          if (parsed.bodyJson != null) {
            form.setValue("auth_body_json_text", JSON.stringify(parsed.bodyJson ?? {}, null, 2), { shouldDirty: true });
            form.setValue("auth_body_text", "", { shouldDirty: true });
          } else if (parsed.bodyText) {
            form.setValue("auth_body_text", parsed.bodyText, { shouldDirty: true });
          }
          if (parsed.origin && !String(values.base_url ?? "").trim()) {
            form.setValue("base_url", parsed.origin, { shouldDirty: true });
          }
        } catch {
          setParsedAuth(null);
        }
      }
      if (name === "request_curl_text") {
        const raw = String(values.request_curl_text ?? "").trim();
        if (!raw) {
          setParsedRequest(null);
          return;
        }
        try {
          const parsed = inferCommonVariables(parseCurl(raw));
          setParsedRequest(parsed);
          if (parsed.origin) form.setValue("base_url", parsed.origin, { shouldDirty: true });
          if (parsed.path) form.setValue("request_url", parsed.path, { shouldDirty: true });
          if (parsed.method) form.setValue("request_method", parsed.method as any, { shouldDirty: true });
          form.setValue("request_headers_json_text", JSON.stringify(parsed.headers ?? {}, null, 2), { shouldDirty: true });
          form.setValue("request_query_params_json_text", JSON.stringify(parsed.query ?? {}, null, 2), { shouldDirty: true });
          if (parsed.bodyJson != null) {
            form.setValue("request_body_json_text", JSON.stringify(parsed.bodyJson ?? {}, null, 2), { shouldDirty: true });
            form.setValue("request_body_text", "", { shouldDirty: true });
          } else if (parsed.bodyText) {
            form.setValue("request_body_text", parsed.bodyText, { shouldDirty: true });
          }
        } catch {
          setParsedRequest(null);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleAutoSlug = () => {
    const name = form.getValues("name");
    const next = slugify(name);
    if (next) form.setValue("slug", next, { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const authBody = parseJsonOrThrow("Auth body JSON", values.auth_body_json_text);
      const headers = parseJsonOrThrow("Headers JSON", values.request_headers_json_text);
      const params = parseJsonOrThrow("Params JSON", values.request_params_json_text);
      const authHeaders = parseJsonOrThrow("Auth headers JSON", values.auth_headers_json_text);
      const authQueryParams = parseJsonOrThrow("Auth query params JSON", values.auth_query_params_json_text);
      const requestQueryParams = parseJsonOrThrow("Request query params JSON", values.request_query_params_json_text);
      const requestBodyJson = parseJsonOrThrow("Request body JSON", values.request_body_json_text);
      const mapping = parseJsonOrThrow("Response mapping JSON", values.response_mapping_json_text);

      const payload = {
        name: values.name,
        slug: values.slug,
        base_url: values.base_url,
        is_active: values.is_active,
        auth_curl: values.auth_curl_text || null,
        auth_url: values.auth_url || null,
        auth_method: values.auth_method,
        auth_headers_json: authHeaders,
        auth_query_params_json: authQueryParams,
        auth_body_text: values.auth_body_text?.trim() ? values.auth_body_text : null,
        auth_body_json: authBody,
        auth_token_path: values.auth_token_path || null,
        token_expiration_seconds: values.token_expiration_seconds ?? null,
        request_curl: values.request_curl_text || null,
        request_url: values.request_url || null,
        request_method: values.request_method,
        request_headers_json: headers,
        request_params_json: params,
        request_query_params_json: requestQueryParams,
        request_body_json: requestBodyJson,
        request_body_text: values.request_body_text?.trim() ? values.request_body_text : null,
        request_variables_json: (parsedRequest?.variables ?? []) as any,
        barcode_param_name: values.barcode_param_name || null,
        store_param_name: values.store_param_name || null,
        response_mapping_json: mapping,
      };

      if (isEditing && id) {
        await updateIntegration.mutateAsync({ id, ...payload } as any);
      } else {
        await createIntegration.mutateAsync(payload as any);
      }

      navigate("/admin/api-integrations");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar integração");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const values = form.getValues();
      const authBody = parseJsonOrThrow("Auth body JSON", values.auth_body_json_text);
      const headers = parseJsonOrThrow("Headers JSON", values.request_headers_json_text);
      const params = parseJsonOrThrow("Params JSON", values.request_params_json_text);
      const authHeaders = parseJsonOrThrow("Auth headers JSON", values.auth_headers_json_text);
      const authQueryParams = parseJsonOrThrow("Auth query params JSON", values.auth_query_params_json_text);
      const requestQueryParams = parseJsonOrThrow("Request query params JSON", values.request_query_params_json_text);
      const requestBodyJson = parseJsonOrThrow("Request body JSON", values.request_body_json_text);
      const mapping = parseJsonOrThrow("Response mapping JSON", values.response_mapping_json_text);

      if (!testBarcode.trim() || !testStore.trim()) {
        toast.error("Informe barcode e store para testar");
        return;
      }

      const requestBody: any =
        isEditing && id
          ? {
              action: "test_by_id",
              integration_id: id,
              barcode: testBarcode.trim(),
              store: testStore.trim(),
            }
          : {
              action: "test_direct",
              barcode: testBarcode.trim(),
              store: testStore.trim(),
              config: {
                base_url: values.base_url,
                auth_curl: values.auth_curl_text || null,
                auth_url: values.auth_url || null,
                auth_method: values.auth_method,
                auth_headers_json: authHeaders,
                auth_query_params_json: authQueryParams,
                auth_body_text: values.auth_body_text?.trim() ? values.auth_body_text : null,
                auth_body_json: authBody,
                auth_token_path: values.auth_token_path || null,
                token_expiration_seconds: values.token_expiration_seconds ?? null,
                request_curl: values.request_curl_text || null,
                request_url: values.request_url || null,
                request_method: values.request_method,
                request_headers_json: headers,
                request_params_json: params,
                request_query_params_json: requestQueryParams,
                request_body_json: requestBodyJson,
                request_body_text: values.request_body_text?.trim() ? values.request_body_text : null,
                request_variables_json: (parsedRequest?.variables ?? []) as any,
                barcode_param_name: values.barcode_param_name || null,
                store_param_name: values.store_param_name || null,
                response_mapping_json: mapping,
              },
            };

      const { data, error } = await supabase.functions.invoke("api-integrations", { body: requestBody });
      if (error) throw error;
      if (!data) throw new Error("Sem resposta do servidor");
      setTestResult(data);

      if (data.success) toast.success("Teste concluído");
      else toast.error(data.error || "Falha no teste");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao testar integração");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/api-integrations")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{isEditing ? "Editar Integração" : "Nova Integração"}</h1>
            <p className="text-muted-foreground">Configure autenticação, request e mapeamento de resposta</p>
          </div>
        </div>
        <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="auth">Auth</TabsTrigger>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="mapping">Mapping</TabsTrigger>
              <TabsTrigger value="test">Teste</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card className="border-white/10 bg-card/50">
                <CardHeader>
                  <CardTitle>Configuração Geral</CardTitle>
                  <CardDescription>Identificação e URL base</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Slug
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={handleAutoSlug}>
                          Gerar
                        </Button>
                      </div>
                      <FormField
                        control={form.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} className="font-mono" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="base_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://zaffariexpress.com.br" {...field} value={field.value ?? ""} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-white/10 p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Ativa</FormLabel>
                          <p className="text-sm text-muted-foreground">Permitir uso por dispositivos</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auth">
              <Card className="border-white/10 bg-card/50">
                <CardHeader>
                  <CardTitle>Autenticação</CardTitle>
                  <CardDescription>Auth URL, método e extração do token</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="auth_curl_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth CURL</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[160px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {parsedAuth?.variables?.length ? (
                    <Card className="border-white/10 bg-card/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Variáveis detectadas</CardTitle>
                        <CardDescription>{parsedAuth.variables.map((v) => `{${v.name}}`).join(", ")}</CardDescription>
                      </CardHeader>
                    </Card>
                  ) : null}

                  <FormField
                    control={form.control}
                    name="auth_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://zaffariexpress.com.br/api/login/login" {...field} value={field.value ?? ""} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="auth_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
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
                  </div>

                  <FormField
                    control={form.control}
                    name="auth_headers_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth headers JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[140px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="auth_query_params_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth query params JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[140px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="auth_body_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth body (raw)</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[120px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="auth_body_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth body JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[180px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="request">
              <Card className="border-white/10 bg-card/50">
                <CardHeader>
                  <CardTitle>Request</CardTitle>
                  <CardDescription>Endpoint de consulta e parâmetros</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="request_curl_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request CURL</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[200px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {parsedRequest?.variables?.length ? (
                    <Card className="border-white/10 bg-card/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Variáveis detectadas</CardTitle>
                        <CardDescription>{parsedRequest.variables.map((v) => `{${v.name}}`).join(", ")}</CardDescription>
                      </CardHeader>
                    </Card>
                  ) : null}

                  <FormField
                    control={form.control}
                    name="request_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://zaffariexpress.com.br/api/v1/consultapreco/precos" {...field} value={field.value ?? ""} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="request_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="barcode_param_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode param name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} className="font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="store_param_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store param name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} className="font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="request_headers_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headers JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[160px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="request_query_params_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Query params JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[140px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="request_body_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body (raw)</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[140px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="request_body_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[160px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="request_params_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Params JSON (legacy)</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[160px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mapping">
              <Card className="border-white/10 bg-card/50">
                <CardHeader>
                  <CardTitle>Response Mapping</CardTitle>
                  <CardDescription>Mapeie o JSON de resposta para o formato padrão do dispositivo</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="response_mapping_json_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mapping JSON</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[200px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="test">
              <Card className="border-white/10 bg-card/50">
                <CardHeader>
                  <CardTitle>Testar Integração</CardTitle>
                  <CardDescription>1) obtém token 2) chama API 3) aplica mapping 4) mostra resultado</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Barcode</Label>
                      <Input value={testBarcode} onChange={(e) => setTestBarcode(e.target.value)} className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label>Store</Label>
                      <Input value={testStore} onChange={(e) => setTestStore(e.target.value)} className="font-mono" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting} className="gap-2 w-full">
                        {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Test Integration
                      </Button>
                    </div>
                  </div>

                  {testResult ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card className="border-white/10 bg-card/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Standard Response</CardTitle>
                          <CardDescription>Formato entregue ao dispositivo</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs whitespace-pre-wrap break-words bg-black/30 border border-white/10 rounded-md p-3">
                            {JSON.stringify(testResult.mapped ?? null, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>

                      <Card className="border-white/10 bg-card/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Raw Response</CardTitle>
                          <CardDescription>
                            Status: {String(testResult.status ?? "-")} {testResult.token_preview ? `| Token: ${testResult.token_preview}` : ""}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs whitespace-pre-wrap break-words bg-black/30 border border-white/10 rounded-md p-3">
                            {JSON.stringify(testResult.raw ?? testResult, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
