
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePriceCheckIntegrations, type PriceCheckIntegration } from "@/hooks/usePriceCheckIntegrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Save, ArrowLeft, ArrowRight, Check, Terminal, Code2,
  Braces, Globe, Key, Zap, Play, Copy, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";
import { supabase } from "@/integrations/supabase/client";
import { inferCommonVariables, parseCurl, type ParsedCurl } from "@/lib/parseCurl";
import { IntegrationMapping } from "./components/IntegrationMapping";
import { Json } from "@/integrations/supabase/types";

const EXAMPLE_CURL = `curl --location 'https://api.erp.com/v1/produtos?loja=8&ean=7891234567890' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer eyJhbGci...'`;

const EXAMPLE_AUTH_CURL = `curl --location --request POST 'https://api.erp.com/auth/login' \\
--header 'Content-Type: application/json' \\
--data '{"usuario": "admin", "senha": "123456"}'`;

const steps = [
  { id: "curl", label: "Cole a CURL", icon: Terminal },
  { id: "review", label: "Revisão", icon: Code2 },
  { id: "auth", label: "Autenticação", icon: Key },
  { id: "mapping", label: "Mapeamento", icon: Braces },
];

export default function PriceCheckIntegrationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createIntegration, updateIntegration, integrations } = usePriceCheckIntegrations();
  const { companies } = useCompanies();
  const isEditing = !!id && id !== "new";
  const existingIntegration = integrations?.find(i => i.id === id);

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [environment, setEnvironment] = useState<"production" | "staging">("production");

  // CURL state
  const [requestCurl, setRequestCurl] = useState("");
  const [parsedRequest, setParsedRequest] = useState<ParsedCurl | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Auth state
  const [hasAuth, setHasAuth] = useState(false);
  const [authCurl, setAuthCurl] = useState("");
  const [parsedAuth, setParsedAuth] = useState<ParsedCurl | null>(null);
  const [authTokenPath, setAuthTokenPath] = useState("token");
  const [tokenExpiration, setTokenExpiration] = useState(3600);

  // Mapping
  const [mappingConfig, setMappingConfig] = useState<any>({});

  // Test state
  const [isTestingRequest, setIsTestingRequest] = useState(false);
  const [testBarcode, setTestBarcode] = useState("");
  const [testStoreCode, setTestStoreCode] = useState("");
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  // Load existing integration
  useEffect(() => {
    if (existingIntegration) {
      setName(existingIntegration.name);
      setCompanyId(existingIntegration.company_id);
      setStatus(existingIntegration.status);
      setEnvironment(existingIntegration.environment);
      setRequestCurl((existingIntegration as any).request_curl || "");
      setAuthCurl((existingIntegration as any).auth_curl || "");
      setHasAuth(!!(existingIntegration as any).auth_curl);
      setAuthTokenPath((existingIntegration as any).auth_token_path || "token");
      setTokenExpiration((existingIntegration as any).token_expiration_seconds || 3600);
      setMappingConfig(existingIntegration.mapping_config || {});
      setCurrentStep(1); // Go to review on edit
    }
  }, [existingIntegration]);

  // Parse request CURL
  useEffect(() => {
    const raw = requestCurl.trim();
    if (!raw) { setParsedRequest(null); setParseError(null); return; }
    try {
      const parsed = inferCommonVariables(parseCurl(raw));
      setParsedRequest(parsed);
      setParseError(null);
    } catch (e: any) {
      setParsedRequest(null);
      setParseError(e?.message || "Erro ao interpretar CURL");
    }
  }, [requestCurl]);

  // Parse auth CURL
  useEffect(() => {
    const raw = authCurl.trim();
    if (!raw) { setParsedAuth(null); return; }
    try {
      setParsedAuth(inferCommonVariables(parseCurl(raw)));
    } catch { setParsedAuth(null); }
  }, [authCurl]);

  const handleAnalyze = () => {
    if (!requestCurl.trim()) {
      toast.error("Cole uma CURL antes de analisar");
      return;
    }
    if (!parsedRequest) {
      toast.error("CURL inválida. Verifique o formato.");
      return;
    }
    if (!name.trim()) {
      setName(`Integração ${parsedRequest.origin || "Nova"}`);
    }
    setCurrentStep(1);
    toast.success("CURL analisada com sucesso!");
  };

  const handleTestRequest = async () => {
    if (!isEditing || !id) {
      toast.error("Salve a integração antes de testar");
      return;
    }
    const barcode = testBarcode.trim();
    if (!barcode) { toast.error("Informe um código de barras"); return; }
    setIsTestingRequest(true);
    setLastTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("price-check-proxy", {
        body: { action: "request_test", integration_id: id, barcode, store_code: testStoreCode.trim() || undefined },
      });
      if (error) throw error;
      setLastTestResult(data);
      if (data?.success) toast.success("Request executado com sucesso");
      else toast.error("Request executado com falha");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar");
    } finally {
      setIsTestingRequest(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!parsedRequest && !requestCurl.trim()) { toast.error("Cole a CURL de consulta"); return; }

    setIsLoading(true);
    try {
      let authParsed: ParsedCurl | null = null;
      let reqParsed: ParsedCurl | null = null;

      if (authCurl.trim()) {
        try { authParsed = inferCommonVariables(parseCurl(authCurl)); } catch { }
      }
      if (requestCurl.trim()) {
        try { reqParsed = inferCommonVariables(parseCurl(requestCurl)); } catch { }
      }

      const payload: any = {
        name,
        company_id: companyId,
        status,
        environment,
        auth_curl: authCurl.trim() || null,
        request_curl: requestCurl.trim() || null,
        auth_type: hasAuth ? "bearer_token" : "none",
        auth_config: {} as unknown as Json,
        auth_url: authParsed?.urlWithoutQuery || null,
        auth_method: authParsed?.method || null,
        auth_headers_json: (authParsed?.headers || {}) as unknown as Json,
        auth_query_params_json: (authParsed?.query || {}) as unknown as Json,
        auth_body_json: (authParsed?.bodyJson ?? {}) as unknown as Json,
        auth_body_text: authParsed?.bodyJson == null ? (authParsed?.bodyText || null) : null,
        auth_token_path: hasAuth ? authTokenPath : null,
        token_expiration_seconds: hasAuth ? tokenExpiration : null,
        request_url: reqParsed?.urlWithoutQuery || "",
        request_method: reqParsed?.method || "GET",
        request_headers_json: (reqParsed?.headers || {}) as unknown as Json,
        request_query_params_json: (reqParsed?.query || {}) as unknown as Json,
        request_body_json: (reqParsed?.bodyJson ?? {}) as unknown as Json,
        request_body_text: reqParsed?.bodyJson == null ? (reqParsed?.bodyText || null) : null,
        request_variables_json: (reqParsed?.variables || []) as unknown as Json,
        endpoint_url: reqParsed?.urlWithoutQuery || "",
        method: reqParsed?.method || "GET",
        barcode_param_type: "query_param",
        barcode_param_name: "barcode",
        headers: (reqParsed?.headers || {}) as unknown as Json,
        mapping_config: mappingConfig as unknown as Json,
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

  const headersEntries = useMemo(() => Object.entries(parsedRequest?.headers || {}), [parsedRequest]);
  const queryEntries = useMemo(() => Object.entries(parsedRequest?.query || {}), [parsedRequest]);

  return (
    <div className="space-y-6 p-6 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/integrations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar Integração" : "Nova Integração via CURL"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cole a CURL real da API e o sistema configura tudo automaticamente
          </p>
        </div>
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Integração
        </Button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {step.label}
            </button>
          );
        })}
      </div>

      {/* STEP 0: Cole a CURL */}
      {currentStep === 0 && (
        <div className="space-y-6">
          {/* Name & Company */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome da Integração</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: API ERP Zaffari — Consulta Preço"
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa (Opcional)</Label>
              <Select onValueChange={(v) => setCompanyId(v === "global" ? null : v)} value={companyId || "global"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Todas (Global)</SelectItem>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CURL textarea */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                Cole sua CURL completa
              </CardTitle>
              <CardDescription>
                Copie a requisição CURL do Postman, Chrome DevTools ou da documentação da API.
                O parser extrai automaticamente: método, URL, headers, body e variáveis dinâmicas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={requestCurl}
                onChange={(e) => setRequestCurl(e.target.value)}
                placeholder={EXAMPLE_CURL}
                className="font-mono text-sm min-h-[200px] bg-muted/20"
              />

              {parseError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {parseError}
                </div>
              )}

              {parsedRequest && (
                <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    CURL interpretada com sucesso
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Método</span>
                      <div className="font-mono font-bold">{parsedRequest.method}</div>
                    </div>
                    <div className="col-span-3">
                      <span className="text-muted-foreground text-xs">URL Base</span>
                      <div className="font-mono text-xs truncate">{parsedRequest.urlWithoutQuery}</div>
                    </div>
                  </div>
                  {headersEntries.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Headers ({headersEntries.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {headersEntries.map(([k]) => (
                          <Badge key={k} variant="outline" className="text-xs font-mono">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedRequest.variables.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Variáveis detectadas</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedRequest.variables.map((v) => (
                          <Badge key={v.name} className="text-xs font-mono bg-primary/20 text-primary border-primary/30">
                            {`{${v.name}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleAnalyze} disabled={!requestCurl.trim()} className="gap-2">
                <Zap className="h-4 w-4" /> Analisar CURL
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 1: Review */}
      {currentStep === 1 && parsedRequest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* URL & Method */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> URL e Método
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Método</Label>
                <div className="font-mono text-lg font-bold">{parsedRequest.method}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">URL Base</Label>
                <div className="font-mono text-sm bg-muted/20 p-2 rounded break-all">{parsedRequest.urlWithoutQuery}</div>
              </div>
              {queryEntries.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Query Parameters</Label>
                  <div className="space-y-1">
                    {queryEntries.map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-sm font-mono bg-muted/10 px-3 py-1.5 rounded">
                        <span className="text-muted-foreground">{k}:</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Headers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" /> Headers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {headersEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum header detectado</p>
              ) : (
                <div className="space-y-1">
                  {headersEntries.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 text-sm font-mono bg-muted/10 px-3 py-1.5 rounded">
                      <span className="text-muted-foreground whitespace-nowrap">{k}:</span>
                      <span className="break-all">{v.length > 60 ? v.slice(0, 60) + "..." : v}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Body */}
          {(parsedRequest.bodyJson || parsedRequest.bodyText) && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Braces className="h-4 w-4 text-primary" /> Body
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="font-mono text-xs bg-muted/20 p-4 rounded overflow-auto max-h-[300px]">
                  {parsedRequest.bodyJson
                    ? JSON.stringify(parsedRequest.bodyJson, null, 2)
                    : parsedRequest.bodyText}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Variables */}
          {parsedRequest.variables.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Variáveis Dinâmicas</CardTitle>
                <CardDescription>
                  Estas variáveis serão substituídas em tempo de execução (barcode, store, token, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {parsedRequest.variables.map((v) => (
                    <div key={v.name} className="flex items-center gap-3 bg-muted/10 rounded-lg px-4 py-3">
                      <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">
                        {`{${v.name}}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        em: {v.locations.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test section */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Testar Integração
              </CardTitle>
              <CardDescription>
                {isEditing ? "Execute um teste real com um código de barras" : "Salve primeiro para poder testar"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Código de Barras</Label>
                  <Input value={testBarcode} onChange={(e) => setTestBarcode(e.target.value)} placeholder="7891234567890" className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Store Code (opcional)</Label>
                  <Input value={testStoreCode} onChange={(e) => setTestStoreCode(e.target.value)} placeholder="0001" className="font-mono" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleTestRequest} disabled={!isEditing || isTestingRequest || !testBarcode.trim()} className="gap-2 w-full">
                    {isTestingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Testar
                  </Button>
                </div>
              </div>

              {lastTestResult && (
                <div className="rounded-lg border bg-muted/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {lastTestResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Status: <span className="font-mono">{lastTestResult.status}</span></span>
                    {typeof lastTestResult.response_time_ms === "number" && (
                      <span className="text-xs text-muted-foreground ml-2">{lastTestResult.response_time_ms}ms</span>
                    )}
                  </div>
                  <pre className="font-mono text-xs bg-muted/20 p-3 rounded overflow-auto max-h-[300px]">
                    {typeof lastTestResult.response === "string"
                      ? lastTestResult.response
                      : JSON.stringify(lastTestResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="lg:col-span-2 flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(0)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar à CURL
            </Button>
            <Button onClick={() => setCurrentStep(2)} className="gap-2">
              Configurar Autenticação <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 1 && !parsedRequest && (
        <Card className="text-center py-12">
          <CardContent>
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Volte ao passo anterior e cole uma CURL válida</p>
            <Button variant="outline" onClick={() => setCurrentStep(0)} className="mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Auth */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Autenticação Automática
                  </CardTitle>
                  <CardDescription>
                    Se a API requer login antes da consulta, cole a CURL de autenticação
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Requer auth</Label>
                  <Switch checked={hasAuth} onCheckedChange={setHasAuth} />
                </div>
              </div>
            </CardHeader>

            {hasAuth && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>CURL de Login / Token</Label>
                  <Textarea
                    value={authCurl}
                    onChange={(e) => setAuthCurl(e.target.value)}
                    placeholder={EXAMPLE_AUTH_CURL}
                    className="font-mono text-sm min-h-[160px] bg-muted/20"
                  />
                </div>

                {parsedAuth && (
                  <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Auth CURL interpretada: <span className="font-mono">{parsedAuth.method} {parsedAuth.urlWithoutQuery}</span>
                    </div>
                    {parsedAuth.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {parsedAuth.variables.map((v) => (
                          <Badge key={v.name} variant="outline" className="text-xs font-mono">{`{${v.name}}`}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>JSON Path do Token</Label>
                    <Input
                      value={authTokenPath}
                      onChange={(e) => setAuthTokenPath(e.target.value)}
                      placeholder="data.token | token | access_token"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Caminho no JSON de resposta para extrair o token
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiração (segundos)</Label>
                    <Input
                      type="number"
                      value={tokenExpiration}
                      onChange={(e) => setTokenExpiration(Number(e.target.value) || 3600)}
                      placeholder="3600"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tempo máximo para reutilizar o token obtido
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Status & Environment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select value={environment} onValueChange={(v: any) => setEnvironment(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Produção</SelectItem>
                      <SelectItem value="staging">Homologação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Status Ativo</Label>
                    <p className="text-xs text-muted-foreground">Disponível para uso nos terminais</p>
                  </div>
                  <Switch checked={status === "active"} onCheckedChange={(c) => setStatus(c ? "active" : "inactive")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Revisão
            </Button>
            <Button onClick={() => setCurrentStep(3)} className="gap-2">
              Mapeamento de Resposta <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Mapping */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <IntegrationMapping
            value={mappingConfig}
            onChange={setMappingConfig}
          />

          <Separator />

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(2)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Autenticação
            </Button>
            <Button onClick={handleSave} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Integração
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
