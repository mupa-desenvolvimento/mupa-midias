
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
  Loader2, Save, ArrowLeft, ArrowRight, Terminal, Code2,
  Braces, Globe, Key, Zap, Play, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { inferCommonVariables, parseCurl, type ParsedCurl } from "@/lib/parseCurl";
import { IntegrationMapping } from "./components/IntegrationMapping";
import { Json } from "@/integrations/supabase/types";

const EXAMPLE_AUTH_CURL = `curl --location --request POST 'https://api.erp.com/auth/login' \\
--header 'Content-Type: application/json' \\
--data '{"usuario": "admin", "senha": "123456"}'`;

const EXAMPLE_REQUEST_CURL = `curl --location 'https://api.erp.com/v1/produtos?loja=8&ean={{barcode}}' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer {{token}}'`;

const steps = [
  { id: "auth", label: "1. Autenticação", icon: Key },
  { id: "request", label: "2. Consulta (CURL)", icon: Terminal },
  { id: "mapping", label: "3. Mapeamento", icon: Braces },
];

/**
 * Execute a parsed CURL via edge function proxy (no need to save first).
 * The edge function receives the raw parsed data and executes it.
 */
async function executeCurlViaProxy(parsed: ParsedCurl, variables?: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke("price-check-proxy", {
    body: {
      action: "raw_test",
      method: parsed.method,
      url: parsed.url,
      headers: parsed.headers,
      body: parsed.bodyJson || parsed.bodyText || null,
      variables: variables || {},
    },
  });
  if (error) throw error;
  return data;
}

export default function PriceCheckIntegrationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createIntegration, updateIntegration, integrations } = usePriceCheckIntegrations();
  const { companies } = useCompanies();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const isEditing = !!id && id !== "new";
  const existingIntegration = integrations?.find(i => i.id === id);

  // Redirect non-super-admins away from create/edit
  useEffect(() => {
    if (!isSuperAdminLoading && !isSuperAdmin) {
      toast.error("Apenas super administradores podem gerenciar integrações");
      navigate("/admin/integrations");
    }
  }, [isSuperAdmin, isSuperAdminLoading, navigate]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [environment, setEnvironment] = useState<"production" | "staging">("production");

  // Auth state
  const [hasAuth, setHasAuth] = useState(false);
  const [authCurl, setAuthCurl] = useState("");
  const [parsedAuth, setParsedAuth] = useState<ParsedCurl | null>(null);
  const [authParseError, setAuthParseError] = useState<string | null>(null);
  const [authTokenPath, setAuthTokenPath] = useState("token");
  const [tokenExpiration, setTokenExpiration] = useState(3600);
  const [isTestingAuth, setIsTestingAuth] = useState(false);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [extractedToken, setExtractedToken] = useState<string | null>(null);

  // Request CURL state
  const [requestCurl, setRequestCurl] = useState("");
  const [parsedRequest, setParsedRequest] = useState<ParsedCurl | null>(null);
  const [requestParseError, setRequestParseError] = useState<string | null>(null);

  // Test state
  const [isTestingRequest, setIsTestingRequest] = useState(false);
  const [testBarcode, setTestBarcode] = useState("");
  const [testStoreCode, setTestStoreCode] = useState("");
  const [lastTestResult, setLastTestResult] = useState<any>(null);
  const [lastTestResponse, setLastTestResponse] = useState<any>(null);

  // Mapping
  const [mappingConfig, setMappingConfig] = useState<any>({});

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
    }
  }, [existingIntegration]);

  // Parse auth CURL
  useEffect(() => {
    const raw = authCurl.trim();
    if (!raw) { setParsedAuth(null); setAuthParseError(null); return; }
    try {
      setParsedAuth(inferCommonVariables(parseCurl(raw)));
      setAuthParseError(null);
    } catch (e: any) {
      setParsedAuth(null);
      setAuthParseError(e?.message || "Erro ao interpretar CURL de auth");
    }
  }, [authCurl]);

  // Parse request CURL
  useEffect(() => {
    const raw = requestCurl.trim();
    if (!raw) { setParsedRequest(null); setRequestParseError(null); return; }
    try {
      const parsed = inferCommonVariables(parseCurl(raw));
      setParsedRequest(parsed);
      setRequestParseError(null);
    } catch (e: any) {
      setParsedRequest(null);
      setRequestParseError(e?.message || "Erro ao interpretar CURL");
    }
  }, [requestCurl]);

  // Helper to resolve a value from JSON using dot path
  const resolveJsonPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  };

  const handleTestAuth = async () => {
    if (!parsedAuth) {
      toast.error("Cole uma CURL de autenticação válida");
      return;
    }
    setIsTestingAuth(true);
    setAuthTestResult(null);
    setExtractedToken(null);
    try {
      const result = await executeCurlViaProxy(parsedAuth);
      setAuthTestResult(result);
      
      // Try to extract token from raw (unsanitized) response
      if (authTokenPath) {
        const rawBody = result?.raw_response || result?.response;
        const responseBody = typeof rawBody === "string" 
          ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })()
          : rawBody;
        
        if (responseBody) {
          const token = resolveJsonPath(responseBody, authTokenPath);
          if (token && typeof token === "string") {
            setExtractedToken(token);
            toast.success(`Token extraído com sucesso! (${token.slice(0, 20)}...)`);
          } else {
            toast.warning(`Token não encontrado no path: ${authTokenPath}`);
          }
        }
      }
      
      if (result?.success) toast.success("Autenticação executada com sucesso!");
      else toast.error("Falha na autenticação");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar autenticação");
    } finally {
      setIsTestingAuth(false);
    }
  };

  const handleTestRequest = async () => {
    if (!parsedRequest) {
      toast.error("Cole uma CURL de consulta válida");
      return;
    }
    const barcode = testBarcode.trim();
    if (!barcode) { toast.error("Informe um código de barras"); return; }
    
    setIsTestingRequest(true);
    setLastTestResult(null);
    setLastTestResponse(null);
    try {
      // Build variables map
      const variables: Record<string, string> = {
        barcode,
        ean: barcode,
      };
      if (testStoreCode.trim()) {
        variables.store = testStoreCode.trim();
        variables.loja = testStoreCode.trim();
        variables.store_code = testStoreCode.trim();
      }
      if (extractedToken) {
        variables.token = extractedToken;
      }

      const result = await executeCurlViaProxy(parsedRequest, variables);
      setLastTestResult(result);
      
      // Extract the response body for mapping
      if (result?.response) {
        const responseBody = typeof result.response === "string"
          ? (() => { try { return JSON.parse(result.response); } catch { return result.response; } })()
          : result.response;
        setLastTestResponse(responseBody);
      }
      
      if (result?.success) toast.success("Consulta executada com sucesso!");
      else toast.error("Consulta executada com falha");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar");
    } finally {
      setIsTestingRequest(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }

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

  const requestHeadersEntries = useMemo(() => Object.entries(parsedRequest?.headers || {}), [parsedRequest]);
  const requestQueryEntries = useMemo(() => Object.entries(parsedRequest?.query || {}), [parsedRequest]);
  const authHeadersEntries = useMemo(() => Object.entries(parsedAuth?.headers || {}), [parsedAuth]);

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
            Configure autenticação primeiro (se necessário), depois a consulta de preço
          </p>
        </div>
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Integração
        </Button>
      </div>

      {/* Name & Company & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Nome da Integração</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: API ERP Zaffari — Consulta Preço" />
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

      {/* ========== STEP 0: Autenticação ========== */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Autenticação (Login / Token)
                  </CardTitle>
                  <CardDescription>
                    Se a API requer autenticação antes da consulta, habilite e cole a CURL de login.
                    O token obtido será usado automaticamente na CURL de consulta via {"{{token}}"}.
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
                  <Label>CURL de Autenticação (Login)</Label>
                  <Textarea
                    value={authCurl}
                    onChange={(e) => setAuthCurl(e.target.value)}
                    placeholder={EXAMPLE_AUTH_CURL}
                    className="font-mono text-sm min-h-[180px] bg-muted/20"
                  />
                </div>

                {authParseError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> {authParseError}
                  </div>
                )}

                {parsedAuth && (
                  <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Auth CURL interpretada com sucesso
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Método</span>
                        <div className="font-mono font-bold">{parsedAuth.method}</div>
                      </div>
                      <div className="col-span-3">
                        <span className="text-muted-foreground text-xs">URL</span>
                        <div className="font-mono text-xs truncate">{parsedAuth.urlWithoutQuery}</div>
                      </div>
                    </div>
                    {authHeadersEntries.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs">Headers ({authHeadersEntries.length})</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {authHeadersEntries.map(([k]) => (
                            <Badge key={k} variant="outline" className="text-xs font-mono">{k}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(parsedAuth.bodyJson || parsedAuth.bodyText) && (
                      <div>
                        <span className="text-muted-foreground text-xs">Body</span>
                        <pre className="font-mono text-xs bg-muted/20 p-3 rounded mt-1 overflow-auto max-h-[200px]">
                          {parsedAuth.bodyJson ? JSON.stringify(parsedAuth.bodyJson, null, 2) : parsedAuth.bodyText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>JSON Path do Token na resposta</Label>
                    <Input
                      value={authTokenPath}
                      onChange={(e) => setAuthTokenPath(e.target.value)}
                      placeholder="data.token | token | access_token"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Caminho no JSON de resposta para extrair o token (ex: data.access_token)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiração do Token (segundos)</Label>
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

                {/* Test Auth */}
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Play className="h-4 w-4 text-primary" /> Testar Autenticação
                    </CardTitle>
                    <CardDescription>
                      Execute a CURL de login para validar e extrair o token
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={handleTestAuth}
                      disabled={isTestingAuth || !parsedAuth}
                      className="gap-2"
                    >
                      {isTestingAuth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Executar Login
                    </Button>

                    {extractedToken && (
                      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                          <CheckCircle2 className="h-4 w-4" /> Token extraído com sucesso
                        </div>
                        <p className="font-mono text-xs text-muted-foreground truncate">
                          {extractedToken.slice(0, 80)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Este token será usado automaticamente como {"{{token}}"} na CURL de consulta
                        </p>
                      </div>
                    )}

                    {authTestResult && (
                      <div className="rounded-lg border bg-muted/10 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          {authTestResult.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-medium">
                            {authTestResult.success ? "Resposta da autenticação" : "Falha na autenticação"}
                          </span>
                          {typeof authTestResult.response_time_ms === "number" && (
                            <span className="text-xs text-muted-foreground ml-2">{authTestResult.response_time_ms}ms</span>
                          )}
                        </div>
                        <pre className="font-mono text-xs bg-muted/20 p-3 rounded overflow-auto max-h-[300px]">
                          {typeof authTestResult.response === "string"
                            ? authTestResult.response
                            : JSON.stringify(authTestResult.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            )}

            {!hasAuth && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Autenticação desabilitada. Se a API não requer login, avance para a CURL de consulta.
                </p>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setCurrentStep(1)} className="gap-2">
              Próximo: CURL de Consulta <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 1: CURL de Consulta ========== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                CURL de Consulta de Preço
              </CardTitle>
              <CardDescription>
                Cole a CURL da consulta de produto/preço. 
                {hasAuth && extractedToken && (
                  <span className="text-green-500 font-medium">
                    {" "}✓ Token de autenticação disponível — será injetado automaticamente em {"{{token}}"}.
                  </span>
                )}
                {hasAuth && !extractedToken && (
                  <span className="text-yellow-500 font-medium">
                    {" "}⚠ Token não obtido ainda. Teste a autenticação primeiro ou use {"{{token}}"} como placeholder.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={requestCurl}
                onChange={(e) => setRequestCurl(e.target.value)}
                placeholder={EXAMPLE_REQUEST_CURL}
                className="font-mono text-sm min-h-[200px] bg-muted/20"
              />

              {requestParseError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {requestParseError}
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

                  {requestHeadersEntries.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Headers ({requestHeadersEntries.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {requestHeadersEntries.map(([k]) => (
                          <Badge key={k} variant="outline" className="text-xs font-mono">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {requestQueryEntries.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Query Params ({requestQueryEntries.length})</span>
                      <div className="space-y-1 mt-1">
                        {requestQueryEntries.map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-sm font-mono bg-muted/10 px-3 py-1.5 rounded">
                            <span className="text-muted-foreground">{k}:</span>
                            <span>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(parsedRequest.bodyJson || parsedRequest.bodyText) && (
                    <div>
                      <span className="text-muted-foreground text-xs">Body</span>
                      <pre className="font-mono text-xs bg-muted/20 p-3 rounded mt-1 overflow-auto max-h-[200px]">
                        {parsedRequest.bodyJson ? JSON.stringify(parsedRequest.bodyJson, null, 2) : parsedRequest.bodyText}
                      </pre>
                    </div>
                  )}

                  {parsedRequest.variables.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Variáveis dinâmicas detectadas</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedRequest.variables.map((v) => (
                          <Badge key={v.name} className="text-xs font-mono bg-primary/20 text-primary border-primary/30">
                            {`{{${v.name}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Request */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Testar Consulta
              </CardTitle>
              <CardDescription>
                Execute um teste real com um código de barras
                {hasAuth && extractedToken && " (token de autenticação será usado automaticamente)"}
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
                  <Button
                    onClick={handleTestRequest}
                    disabled={isTestingRequest || !testBarcode.trim() || !parsedRequest}
                    className="gap-2 w-full"
                  >
                    {isTestingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Testar Consulta
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
                    <span>Status: <span className="font-mono">{lastTestResult.status || (lastTestResult.success ? "200" : "error")}</span></span>
                    {typeof lastTestResult.response_time_ms === "number" && (
                      <span className="text-xs text-muted-foreground ml-2">{lastTestResult.response_time_ms}ms</span>
                    )}
                  </div>
                  <pre className="font-mono text-xs bg-muted/20 p-3 rounded overflow-auto max-h-[300px]">
                    {typeof lastTestResult.response === "string"
                      ? lastTestResult.response
                      : JSON.stringify(lastTestResult.response, null, 2)}
                  </pre>
                  {lastTestResponse && typeof lastTestResponse === "object" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 mt-2"
                      onClick={() => {
                        setCurrentStep(2);
                      }}
                    >
                      <Braces className="h-4 w-4" />
                      Usar esta resposta no Mapeamento →
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(0)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Autenticação
            </Button>
            <Button onClick={() => setCurrentStep(2)} className="gap-2">
              Mapeamento de Resposta <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 2: Mapeamento ========== */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <IntegrationMapping
            value={mappingConfig}
            onChange={setMappingConfig}
            externalSampleResponse={lastTestResponse}
          />

          {/* Status toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Status Ativo</Label>
                  <p className="text-xs text-muted-foreground">Disponível para uso nos terminais</p>
                </div>
                <Switch checked={status === "active"} onCheckedChange={(c) => setStatus(c ? "active" : "inactive")} />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> CURL de Consulta
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
