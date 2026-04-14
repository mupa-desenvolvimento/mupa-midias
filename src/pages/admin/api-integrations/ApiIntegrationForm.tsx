import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApiIntegrations } from "@/hooks/useApiIntegrations";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Check, ClipboardPaste, Globe, Key, Loader2, Map, Save, TestTube, Zap } from "lucide-react";
import { inferCommonVariables, parseCurl, type ParsedCurl } from "@/lib/parseCurl";

// ---------- Schema ----------
const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  slug: z.string().min(1, "Slug é obrigatório"),
  base_url: z.string().min(1, "Base URL é obrigatória"),
  is_active: z.boolean().default(true),
  company_id: z.string().optional().nullable(),

  auth_curl_text: z.string().default(""),
  auth_url: z.string().optional().nullable(),
  auth_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  auth_headers_json_text: z.string().default('{"Content-Type": "application/json"}'),
  auth_query_params_json_text: z.string().default("{}"),
  auth_body_text: z.string().default(""),
  auth_body_json_text: z.string().default("{}"),
  auth_token_path: z.string().optional().nullable(),
  auth_token_expires_path: z.string().optional().nullable(),
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
  auth_type: z.string().default("bearer"),
  response_data_path: z.string().optional().nullable(),

  response_mapping_json_text: z.string().default("{}"),
});

type FormValues = z.infer<typeof formSchema>;

// ---------- Mapping fields definition ----------
const MAPPING_FIELDS = [
  { key: "name", label: "Nome do Produto", description: "Campo com a descrição/nome do produto", color: "" },
  { key: "ean", label: "EAN / Código de Barras", description: "Campo com o código EAN", color: "" },
  { key: "image", label: "URL da Imagem", description: "Link da imagem do produto", color: "" },
  { key: "price", label: "Preço Regular", description: "Preço base/normal do produto", color: "bg-red-500" },
  { key: "club_price", label: "Preço Clube", description: "Preço especial para clientes clube", color: "bg-blue-500" },
  { key: "promo_price", label: "Preço Oferta", description: "Preço promocional/oferta", color: "bg-orange-500" },
  { key: "proportional_price", label: "Preço Proporcional", description: "Preço por unidade de medida (R$/KG, R$/LI)", color: "bg-yellow-500" },
  { key: "proportional_club_price", label: "Preço Proporcional Clube", description: "Preço proporcional para clube", color: "bg-purple-500" },
  { key: "proportional_unit", label: "Unidade Proporcional", description: "Unidade de medida proporcional (KG, LI, etc.)", color: "" },
  { key: "packaging", label: "Embalagem de Venda", description: "Tipo de embalagem (UN, CX, etc.)", color: "" },
  { key: "status", label: "Status", description: "Status de disponibilidade", color: "" },
  { key: "purchase_limit", label: "Limite de Compra", description: "Quantidade máxima permitida", color: "" },
  { key: "label_code", label: "Código Etiqueta", description: "Tipo de etiqueta/promoção", color: "" },
  { key: "avg_sales", label: "Média de Venda", description: "Preço médio de venda", color: "" },
];

const slugify = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const parseJsonSafe = (text: string) => {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
};

const parseJsonOrThrow = (label: string, text: string) => {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error(`${label} deve ser um JSON`);
    return parsed;
  } catch (e: any) {
    throw new Error(`${label} inválido: ${e?.message}`);
  }
};

export default function ApiIntegrationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { integrations, createIntegration, updateIntegration } = useApiIntegrations();
  const isEditing = !!id && id !== "new";

  const integration = useMemo(() => integrations?.find((i) => i.id === id), [integrations, id]);

  const [activeTab, setActiveTab] = useState("token");
  const [isSaving, setIsSaving] = useState(false);
  const [testBarcode, setTestBarcode] = useState("");
  const [testStore, setTestStore] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [parsedAuth, setParsedAuth] = useState<ParsedCurl | null>(null);
  const [parsedRequest, setParsedRequest] = useState<ParsedCurl | null>(null);
  const [curlDialogOpen, setCurlDialogOpen] = useState(false);
  const [curlDialogTarget, setCurlDialogTarget] = useState<"token" | "request">("token");
  const [curlDialogValue, setCurlDialogValue] = useState("");

  // Load companies
  const { data: companies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  // Load company_integration link
  const { data: companyIntegration } = useQuery({
    queryKey: ["company-integration-link", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await (supabase as any).from("company_integrations").select("*").eq("integration_id", id).maybeSingle();
      return data;
    },
    enabled: isEditing,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", slug: "", base_url: "", is_active: true, company_id: null,
      auth_url: "", auth_method: "POST", auth_curl_text: "",
      auth_headers_json_text: '{\n  "Content-Type": "application/json"\n}',
      auth_query_params_json_text: "{}", auth_body_text: "",
      auth_body_json_text: "{}",
      auth_token_path: "token", auth_token_expires_path: "expires_in",
      token_expiration_seconds: 3600,
      request_curl_text: "", request_url: "", request_method: "GET",
      request_headers_json_text: '{\n  "Authorization": "Bearer {token}"\n}',
      request_params_json_text: "{}", request_query_params_json_text: "{}",
      request_body_json_text: "{}", request_body_text: "",
      barcode_param_name: "ean", store_param_name: "loja",
      auth_type: "bearer", response_data_path: "data",
      response_mapping_json_text: "{}",
    },
  });

  // Load existing integration into form
  useEffect(() => {
    if (integration) {
      form.reset({
        name: integration.name,
        slug: integration.slug,
        base_url: integration.base_url,
        is_active: !!integration.is_active,
        company_id: companyIntegration?.company_id ?? null,
        auth_curl_text: (integration as any).auth_curl ?? "",
        auth_url: integration.auth_url || "",
        auth_method: (String(integration.auth_method || "POST").toUpperCase() as any),
        auth_headers_json_text: JSON.stringify((integration as any).auth_headers_json ?? {}, null, 2),
        auth_query_params_json_text: JSON.stringify((integration as any).auth_query_params_json ?? {}, null, 2),
        auth_body_text: String((integration as any).auth_body_text ?? ""),
        auth_body_json_text: JSON.stringify(integration.auth_body_json ?? {}, null, 2),
        auth_token_path: integration.auth_token_path || "",
        auth_token_expires_path: "",
        token_expiration_seconds: integration.token_expiration_seconds ?? null,
        request_curl_text: (integration as any).request_curl ?? "",
        request_url: integration.request_url || "",
        request_method: (String(integration.request_method || "GET").toUpperCase() as any),
        request_headers_json_text: JSON.stringify(integration.request_headers_json ?? {}, null, 2),
        request_params_json_text: JSON.stringify(integration.request_params_json ?? {}, null, 2),
        request_query_params_json_text: JSON.stringify((integration as any).request_query_params_json ?? {}, null, 2),
        request_body_json_text: JSON.stringify((integration as any).request_body_json ?? {}, null, 2),
        request_body_text: String((integration as any).request_body_text ?? ""),
        barcode_param_name: integration.barcode_param_name || "",
        store_param_name: integration.store_param_name || "",
        auth_type: (integration as any).auth_type || "bearer",
        response_data_path: (integration as any).response_data_path || "data",
        response_mapping_json_text: JSON.stringify(integration.response_mapping_json ?? {}, null, 2),
      });
    }
  }, [integration, companyIntegration, form]);

  const handleAutoSlug = () => {
    const next = slugify(form.getValues("name"));
    if (next) form.setValue("slug", next, { shouldDirty: true });
  };

  // cURL import handlers
  const openCurlDialog = (target: "token" | "request") => {
    setCurlDialogTarget(target);
    setCurlDialogValue("");
    setCurlDialogOpen(true);
  };

  const handleInterpretCurl = () => {
    const raw = curlDialogValue.trim();
    if (!raw) return;
    try {
      const parsed = inferCommonVariables(parseCurl(raw));
      if (curlDialogTarget === "token") {
        setParsedAuth(parsed);
        form.setValue("auth_curl_text", raw, { shouldDirty: true });
        if (parsed.urlWithoutQuery) form.setValue("auth_url", parsed.urlWithoutQuery, { shouldDirty: true });
        if (parsed.method) form.setValue("auth_method", parsed.method as any, { shouldDirty: true });
        form.setValue("auth_headers_json_text", JSON.stringify(parsed.headers ?? {}, null, 2), { shouldDirty: true });
        form.setValue("auth_query_params_json_text", JSON.stringify(parsed.query ?? {}, null, 2), { shouldDirty: true });
        if (parsed.bodyJson != null) {
          form.setValue("auth_body_json_text", JSON.stringify(parsed.bodyJson, null, 2), { shouldDirty: true });
        } else if (parsed.bodyText) {
          form.setValue("auth_body_text", parsed.bodyText, { shouldDirty: true });
        }
        if (parsed.origin && !form.getValues("base_url")) {
          form.setValue("base_url", parsed.origin, { shouldDirty: true });
        }
      } else {
        setParsedRequest(parsed);
        form.setValue("request_curl_text", raw, { shouldDirty: true });
        if (parsed.origin) form.setValue("base_url", parsed.origin, { shouldDirty: true });
        if (parsed.path) form.setValue("request_url", parsed.path, { shouldDirty: true });
        if (parsed.method) form.setValue("request_method", parsed.method as any, { shouldDirty: true });
        form.setValue("request_headers_json_text", JSON.stringify(parsed.headers ?? {}, null, 2), { shouldDirty: true });
        form.setValue("request_query_params_json_text", JSON.stringify(parsed.query ?? {}, null, 2), { shouldDirty: true });
        if (parsed.bodyJson != null) {
          form.setValue("request_body_json_text", JSON.stringify(parsed.bodyJson, null, 2), { shouldDirty: true });
        } else if (parsed.bodyText) {
          form.setValue("request_body_text", parsed.bodyText, { shouldDirty: true });
        }
      }
      toast.success("cURL interpretado com sucesso");
      setCurlDialogOpen(false);
    } catch {
      toast.error("Erro ao interpretar cURL");
    }
  };

  // Mapping helpers
  const mappingObj = useMemo(() => parseJsonSafe(form.watch("response_mapping_json_text")), [form.watch("response_mapping_json_text")]);

  const setMappingField = (key: string, value: string) => {
    const current = parseJsonSafe(form.getValues("response_mapping_json_text"));
    if (value.trim()) {
      current[key] = value.trim();
    } else {
      delete current[key];
    }
    form.setValue("response_mapping_json_text", JSON.stringify(current, null, 2), { shouldDirty: true });
  };

  // Save
  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
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
        name: values.name, slug: values.slug, base_url: values.base_url, is_active: values.is_active,
        auth_curl: values.auth_curl_text || null,
        auth_url: values.auth_url || null, auth_method: values.auth_method,
        auth_headers_json: authHeaders, auth_query_params_json: authQueryParams,
        auth_body_text: values.auth_body_text?.trim() || null,
        auth_body_json: authBody, auth_token_path: values.auth_token_path || null,
        token_expiration_seconds: values.token_expiration_seconds ?? null,
        request_curl: values.request_curl_text || null,
        request_url: values.request_url || null, request_method: values.request_method,
        request_headers_json: headers, request_params_json: params,
        request_query_params_json: requestQueryParams, request_body_json: requestBodyJson,
        request_body_text: values.request_body_text?.trim() || null,
        request_variables_json: (parsedRequest?.variables ?? []) as any,
        barcode_param_name: values.barcode_param_name || null,
        store_param_name: values.store_param_name || null,
        response_mapping_json: mapping,
        auth_type: values.auth_type || "bearer",
        response_data_path: values.response_data_path || null,
      };

      let integrationId = id;
      if (isEditing && id) {
        await updateIntegration.mutateAsync({ id, ...payload } as any);
      } else {
        const result = await createIntegration.mutateAsync(payload as any);
        integrationId = (result as any)?.id;
      }

      // Handle company link
      if (integrationId && values.company_id) {
        const existing = await (supabase as any).from("company_integrations").select("id").eq("integration_id", integrationId).maybeSingle();
        if (existing.data) {
          await (supabase as any).from("company_integrations").update({ company_id: values.company_id, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        } else {
          await (supabase as any).from("company_integrations").insert({ company_id: values.company_id, integration_id: integrationId });
        }
      } else if (integrationId && !values.company_id) {
        await (supabase as any).from("company_integrations").delete().eq("integration_id", integrationId);
      }

      navigate("/admin/api-integrations");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar integração");
    } finally {
      setIsSaving(false);
    }
  };

  // Test
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

      if (!testBarcode.trim()) { toast.error("Informe o EAN para testar"); return; }

      const requestBody: any = isEditing && id
        ? { action: "test_by_id", integration_id: id, barcode: testBarcode.trim(), store: testStore.trim() }
        : {
            action: "test_direct", barcode: testBarcode.trim(), store: testStore.trim(),
            config: {
              base_url: values.base_url, auth_curl: values.auth_curl_text || null,
              auth_url: values.auth_url || null, auth_method: values.auth_method,
              auth_headers_json: authHeaders, auth_query_params_json: authQueryParams,
              auth_body_text: values.auth_body_text?.trim() || null, auth_body_json: authBody,
              auth_token_path: values.auth_token_path || null,
              token_expiration_seconds: values.token_expiration_seconds ?? null,
              request_curl: values.request_curl_text || null, request_url: values.request_url || null,
              request_method: values.request_method, request_headers_json: headers,
              request_params_json: params, request_query_params_json: requestQueryParams,
              request_body_json: requestBodyJson, request_body_text: values.request_body_text?.trim() || null,
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
      if (data.success) toast.success("Teste concluído"); else toast.error(data.error || "Falha no teste");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao testar integração");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/api-integrations")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? "Mapeamento de Preços" : "Nova Integração"}</h1>
            <p className="text-muted-foreground text-sm">Configure a integração com APIs de consulta de preços por empresa</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company selector + Active toggle */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium whitespace-nowrap">Empresa:</Label>
                  <FormField
                    control={form.control}
                    name="company_id"
                    render={({ field }) => (
                      <FormItem className="min-w-[200px]">
                        <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                          <FormControl>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Name & Slug (hidden if editing, shown inline) */}
                  {!isEditing && (
                    <>
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input placeholder="Nome da integração" {...field} className="w-[200px]" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="slug" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input placeholder="slug" {...field} className="w-[150px] font-mono" /></FormControl>
                        </FormItem>
                      )} />
                      <Button type="button" variant="outline" size="sm" onClick={handleAutoSlug}>Gerar slug</Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-sm">Ativo</Label>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 bg-muted/30">
              <TabsTrigger value="token" className="gap-2"><Key className="h-4 w-4" /> Token</TabsTrigger>
              <TabsTrigger value="consulta" className="gap-2"><Globe className="h-4 w-4" /> Consulta</TabsTrigger>
              <TabsTrigger value="mapeamento" className="gap-2"><Map className="h-4 w-4" /> Mapeamento</TabsTrigger>
              <TabsTrigger value="teste" className="gap-2"><TestTube className="h-4 w-4" /> Teste</TabsTrigger>
            </TabsList>

            {/* ===== TOKEN TAB ===== */}
            <TabsContent value="token">
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Configuração do Token</CardTitle>
                      <CardDescription>Configure como obter e renovar o token de autenticação da API</CardDescription>
                    </div>
                    <Button type="button" variant="outline" className="gap-2" onClick={() => openCurlDialog("token")}>
                      <ClipboardPaste className="h-4 w-4" /> Importar cURL
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="auth_url" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Token</FormLabel>
                        <FormControl><Input placeholder="https://api.exemplo.com/login" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="auth_method" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método HTTP</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="auth_body_json_text" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body (JSON) — credenciais de autenticação</FormLabel>
                      <FormControl><Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[140px]" /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="auth_headers_json_text" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headers (JSON)</FormLabel>
                      <FormControl><Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[100px]" /></FormControl>
                    </FormItem>
                  )} />

                  <div className="border-t border-border/30 pt-4" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="auth_token_path" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caminho do Token na Resposta</FormLabel>
                        <FormControl><Input placeholder="token" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                        <p className="text-xs text-muted-foreground">Ex: "token", "data.access_token"</p>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="auth_token_expires_path" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campo de Expiração</FormLabel>
                        <FormControl><Input placeholder="expires_in" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="token_expiration_seconds" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiração Padrão (segundos)</FormLabel>
                        <FormControl><Input type="number" {...field} value={(field.value as any) ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== CONSULTA TAB ===== */}
            <TabsContent value="consulta">
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Configuração da Consulta</CardTitle>
                      <CardDescription>Configure o endpoint de consulta de preço do produto</CardDescription>
                    </div>
                    <Button type="button" variant="outline" className="gap-2" onClick={() => openCurlDialog("request")}>
                      <ClipboardPaste className="h-4 w-4" /> Importar cURL
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="request_url" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de Consulta</FormLabel>
                        <FormControl><Input placeholder="https://api.exemplo.com/v1/consulta/precos" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="request_method" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método HTTP</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="barcode_param_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Parâmetro EAN</FormLabel>
                        <FormControl><Input placeholder="ean" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="auth_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Autenticação</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                            <SelectItem value="none">Sem autenticação</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="request_params_json_text" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parâmetros Fixos (JSON)</FormLabel>
                      <FormControl><Textarea {...field} value={field.value ?? ""} className="font-mono min-h-[100px]" /></FormControl>
                      <p className="text-xs text-muted-foreground">Parâmetros que serão enviados em toda consulta (ex: loja)</p>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="response_data_path" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caminho dos Dados na Resposta</FormLabel>
                      <FormControl><Input placeholder="data" {...field} value={field.value ?? ""} className="font-mono" /></FormControl>
                      <p className="text-xs text-muted-foreground">Caminho no JSON de resposta onde estão os dados do produto. Ex: "data", "resultado.produto"</p>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== MAPEAMENTO TAB ===== */}
            <TabsContent value="mapeamento">
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5 text-primary" /> Mapeamento de Campos</CardTitle>
                  <CardDescription>Mapeie os campos da resposta da API para o formato padrão do terminal. Deixe vazio campos que não existem na API.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[minmax(180px,1fr)_40px_minmax(180px,1fr)_minmax(200px,1.5fr)] gap-4 px-4 py-3 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Campo Padrão</span>
                      <span />
                      <span>Campo na API</span>
                      <span>Descrição</span>
                    </div>
                    {/* Table rows */}
                    {MAPPING_FIELDS.map((f) => (
                      <div key={f.key} className="grid grid-cols-[minmax(180px,1fr)_40px_minmax(180px,1fr)_minmax(200px,1.5fr)] gap-4 px-4 py-3 border-t border-border/20 items-center hover:bg-muted/10 transition-colors">
                        <div>
                          {f.color ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${f.color}`}>{f.label}</span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-md border border-border/50 text-xs font-medium">{f.label}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-center">→</span>
                        <Input
                          value={mappingObj[f.key] ?? ""}
                          onChange={(e) => setMappingField(f.key, e.target.value)}
                          placeholder={`campo_da_api`}
                          className="font-mono h-9"
                        />
                        <span className="text-sm text-muted-foreground">{f.description}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== TESTE TAB ===== */}
            <TabsContent value="teste">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/50 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TestTube className="h-5 w-5 text-primary" /> Testar Consulta</CardTitle>
                    <CardDescription>Teste a configuração com um EAN real</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>EAN para Teste</Label>
                      <Input value={testBarcode} onChange={(e) => setTestBarcode(e.target.value)} placeholder="7896436100581" className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label>Loja (opcional, sobrescreve param fixo)</Label>
                      <Input value={testStore} onChange={(e) => setTestStore(e.target.value)} placeholder="51" className="font-mono" />
                    </div>
                    <Button type="button" onClick={handleTest} disabled={isTesting} className="gap-2 w-full bg-emerald-600 hover:bg-emerald-700">
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Executar Teste
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/80">
                  <CardHeader>
                    <CardTitle>Resultado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {testResult ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Mapeado</Label>
                          <pre className="text-xs whitespace-pre-wrap break-words bg-muted/30 border border-border/20 rounded-md p-3 mt-1 max-h-[250px] overflow-auto">
                            {JSON.stringify(testResult.mapped ?? null, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Raw (Status: {testResult.status ?? "-"})</Label>
                          <pre className="text-xs whitespace-pre-wrap break-words bg-muted/30 border border-border/20 rounded-md p-3 mt-1 max-h-[250px] overflow-auto">
                            {JSON.stringify(testResult.raw ?? testResult, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-12">Execute um teste para ver o resultado</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Save button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 px-8">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configuração
            </Button>
          </div>
        </form>
      </Form>

      {/* cURL Import Dialog */}
      <Dialog open={curlDialogOpen} onOpenChange={setCurlDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-primary" />
              Importar cURL — {curlDialogTarget === "token" ? "Token" : "Consulta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Cole o comando cURL aqui:</p>
            <Textarea
              value={curlDialogValue}
              onChange={(e) => setCurlDialogValue(e.target.value)}
              placeholder={`curl --location 'https://api.exemplo.com/...' \\\n--header 'Content-Type: application/json' \\\n--data '{"usuario":"...","password":"..."}'`}
              className="font-mono min-h-[160px] text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleInterpretCurl}>
              Interpretar cURL
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCurlDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleInterpretCurl} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-4 w-4" /> Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
