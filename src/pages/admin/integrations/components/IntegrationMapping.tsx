
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Play, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

interface IntegrationMappingProps {
  value: any;
  onChange: (value: any) => void;
  externalSampleResponse?: any;
}

/** Recursively extract all paths from a JSON object */
function extractPaths(obj: any, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const paths: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      paths.push(fullPath);
      paths.push(...extractPaths(val, fullPath));
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      paths.push(fullPath);
      paths.push(...extractPaths(val[0], `${fullPath}[0]`));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export function IntegrationMapping({ value, onChange, externalSampleResponse }: IntegrationMappingProps) {
  const [sampleJson, setSampleJson] = useState(JSON.stringify(value?.sample_response || {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(value?.sample_response || {});
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);

  const defaultMapping = {
    barcode: "",
    internal_code: "",
    description: "",
    image: "",
    unit: "",
    price_current: "",
    price_original: "",
    prices: [] as { label: string; path: string; fallback?: string }[],
  };

  const [mapping, setMapping] = useState({ ...defaultMapping, ...value?.fields });
  const [testResult, setTestResult] = useState<any>(null);

  // When external sample response comes from test, auto-fill the JSON textarea
  useEffect(() => {
    if (externalSampleResponse && typeof externalSampleResponse === "object") {
      const json = JSON.stringify(externalSampleResponse, null, 2);
      setSampleJson(json);
      setParsedJson(externalSampleResponse);
      setJsonError(null);
      toast.success("Resposta do teste carregada automaticamente no mapeamento");
    }
  }, [externalSampleResponse]);

  // Extract available paths when JSON changes
  useEffect(() => {
    if (parsedJson && typeof parsedJson === "object") {
      setAvailablePaths(extractPaths(parsedJson));
    } else {
      setAvailablePaths([]);
    }
  }, [parsedJson]);

  const resolveValue = (obj: any, path: string) => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => {
      if (acc === undefined || acc === null) return undefined;
      // Support array notation like items[0]
      const match = part.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        return acc[match[1]]?.[parseInt(match[2])];
      }
      return acc[part];
    }, obj);
  };

  const testMapping = () => {
    if (!parsedJson) return;

    const result = {
      barcode: resolveValue(parsedJson, mapping.barcode) || "Não encontrado",
      internal_code: resolveValue(parsedJson, mapping.internal_code) || "Não encontrado",
      description: resolveValue(parsedJson, mapping.description) || "Não encontrado",
      image: resolveValue(parsedJson, mapping.image) || "Não encontrado",
      unit: resolveValue(parsedJson, mapping.unit) || "UN",
      price_current: Number(resolveValue(parsedJson, mapping.price_current)) || 0,
      price_original: mapping.price_original ? Number(resolveValue(parsedJson, mapping.price_original)) : null,
      prices: mapping.prices?.map((p: any) => ({
        label: p.label,
        value: Number(resolveValue(parsedJson, p.path)) || 0,
      })) || [],
    };

    setTestResult(result);
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(sampleJson);
      setParsedJson(parsed);
      setJsonError(null);
      onChange({
        sample_response: parsed,
        fields: mapping,
      });
    } catch {
      setJsonError("JSON inválido");
    }
  }, [sampleJson, mapping]);

  const handleFieldChange = (field: string, path: string) => {
    setMapping((prev: any) => ({ ...prev, [field]: path }));
  };

  const addPriceMapping = () => {
    setMapping((prev: any) => ({
      ...prev,
      prices: [...(prev.prices || []), { label: "Preço", path: "", fallback: "0.00" }],
    }));
  };

  const updatePriceMapping = (index: number, key: string, val: string) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices[index] = { ...newPrices[index], [key]: val };
    setMapping((prev: any) => ({ ...prev, prices: newPrices }));
  };

  const removePriceMapping = (index: number) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices.splice(index, 1);
    setMapping((prev: any) => ({ ...prev, prices: newPrices }));
  };

  const PathSuggestion = ({ fieldName, currentValue, onSelect }: { fieldName: string; currentValue: string; onSelect: (path: string) => void }) => {
    if (availablePaths.length === 0) return null;
    // Show suggestions that match field name loosely
    const keywords = fieldName.toLowerCase().split("_");
    const suggestions = availablePaths.filter(p => {
      const lower = p.toLowerCase();
      return keywords.some(k => lower.includes(k)) && p !== currentValue;
    }).slice(0, 4);

    if (suggestions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {suggestions.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
          >
            {s}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Column: Sample JSON */}
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Resposta JSON da API</Label>
          {jsonError ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" /> Inválido
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Válido
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {externalSampleResponse 
            ? "✓ Resposta real do teste foi carregada automaticamente. Edite se necessário."
            : "Cole aqui um exemplo real da resposta da API ou use o botão Testar na etapa anterior."
          }
        </p>
        <Textarea
          className={`font-mono text-xs flex-1 min-h-[500px] resize-none ${jsonError ? "border-destructive focus-visible:ring-destructive" : ""}`}
          value={sampleJson}
          onChange={(e) => setSampleJson(e.target.value)}
          placeholder='{ "data": { "products": [ { "name": "Produto X", "price": 10.00 } ] } }'
        />
        {availablePaths.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <Zap className="h-3 w-3 inline mr-1" />
            {availablePaths.length} campos detectados no JSON — sugestões aparecerão nos campos à direita
          </div>
        )}
      </div>

      {/* Right Column: Mapping Configuration */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Mapeamento de Campos</Label>
          <Button size="sm" onClick={testMapping} disabled={!!jsonError} className="gap-2 bg-green-600 hover:bg-green-700">
            <Play className="h-3 w-3" /> Testar Mapeamento
          </Button>
        </div>

        {testResult && (
          <Card className="border-green-500/20 bg-green-500/5 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Resultado do Mapeamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Produto:</span>
                  <div className="text-foreground">{testResult.description}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço Atual:</span>
                  <div className="text-foreground font-bold">R$ {testResult.price_current.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Código:</span>
                  <div className="text-foreground">{testResult.barcode}</div>
                </div>
                {testResult.price_original !== null && testResult.price_original !== 0 && (
                  <div>
                    <span className="text-muted-foreground">Preço Original:</span>
                    <div className="text-foreground">R$ {testResult.price_original.toFixed(2)}</div>
                  </div>
                )}
                {testResult.image && testResult.image !== "Não encontrado" && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Imagem:</span>
                    <div className="text-foreground truncate">{testResult.image}</div>
                  </div>
                )}
              </div>
              {testResult.prices.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-muted-foreground block mb-1">Outros Preços:</span>
                  <div className="space-y-1">
                    {testResult.prices.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{p.label}:</span>
                        <span className="text-foreground">R$ {p.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          Indique o caminho (path) no JSON para cada campo do padrão Mupa.
          Use notação de ponto (ex: <code className="text-primary">data.produto.nome</code>).
        </p>

        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Produto (Básico)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "barcode", label: "Código de Barras (Retorno)", placeholder: "ex: data.ean" },
              { key: "description", label: "Descrição / Nome", placeholder: "ex: data.descricao" },
              { key: "internal_code", label: "Código Interno (Opcional)", placeholder: "ex: data.sku" },
              { key: "image", label: "URL da Imagem (Opcional)", placeholder: "ex: data.images[0].url" },
              { key: "unit", label: "Unidade (Opcional)", placeholder: "ex: data.unit" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="grid gap-1">
                <Label>{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={(mapping as any)[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="font-mono text-sm"
                />
                <PathSuggestion
                  fieldName={key}
                  currentValue={(mapping as any)[key]}
                  onSelect={(path) => handleFieldChange(key, path)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Preços e Promoções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label>Preço Atual (Obrigatório)</Label>
              <Input
                placeholder="ex: data.price"
                value={mapping.price_current}
                onChange={(e) => handleFieldChange("price_current", e.target.value)}
                className="font-mono text-sm"
              />
              <PathSuggestion
                fieldName="price preco valor"
                currentValue={mapping.price_current}
                onSelect={(path) => handleFieldChange("price_current", path)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Preço Original / 'De' (Opcional)</Label>
              <Input
                placeholder="ex: data.original_price"
                value={mapping.price_original}
                onChange={(e) => handleFieldChange("price_original", e.target.value)}
                className="font-mono text-sm"
              />
              <PathSuggestion
                fieldName="original_price preco_original preco_de"
                currentValue={mapping.price_original}
                onSelect={(path) => handleFieldChange("price_original", path)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Outros Preços (Lista)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addPriceMapping} className="h-8 gap-1">
              <Plus className="h-3 w-3" /> Adicionar Preço
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {mapping.prices?.length === 0 && (
              <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground text-sm">
                Nenhum preço extra mapeado. Adicione se a API retorna múltiplos preços.
              </div>
            )}

            {mapping.prices?.map((price: any, index: number) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-muted/10 rounded-md border relative group">
                <div className="grid gap-2 flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rótulo (Label)</Label>
                      <Input
                        value={price.label}
                        onChange={(e) => updatePriceMapping(index, "label", e.target.value)}
                        placeholder="Ex: Preço Clube"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Caminho (JSON Path)</Label>
                      <Input
                        value={price.path}
                        onChange={(e) => updatePriceMapping(index, "path", e.target.value)}
                        placeholder="ex: data.precos.clube"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive absolute -top-2 -right-2 bg-background border shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePriceMapping(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
