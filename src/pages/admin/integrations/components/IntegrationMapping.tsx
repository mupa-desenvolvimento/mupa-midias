
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Play, AlertCircle, CheckCircle2, Zap, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface IntegrationMappingProps {
  value: any;
  onChange: (value: any) => void;
  externalSampleResponse?: any;
}

/** Recursively extract all leaf paths from a JSON object with their values */
function extractPathsWithValues(obj: any, prefix = ""): { path: string; value: any }[] {
  if (!obj || typeof obj !== "object") return [];
  const paths: { path: string; value: any }[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      paths.push(...extractPathsWithValues(val, fullPath));
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      paths.push(...extractPathsWithValues(val[0], `${fullPath}[0]`));
    } else {
      paths.push({ path: fullPath, value: val });
    }
  }
  return paths;
}

/** Auto-detect best path for a field based on common keywords */
function autoDetectPath(fieldKey: string, paths: { path: string; value: any }[]): string {
  const keywordMap: Record<string, string[]> = {
    barcode: ["ean", "barcode", "codigo_barras", "gtin", "cod_barras"],
    description: ["descricao", "description", "nome", "name", "desc", "descricao_produto", "produto_descricao", "product_name"],
    internal_code: ["codigo_produto", "codigo_interno", "sku", "cod_produto", "internal_code", "product_code", "codigo"],
    image: ["imagem", "image", "img", "link_imagem", "image_url", "foto", "photo", "thumbnail"],
    unit: ["unidade", "unit", "embalagem", "embalagem_venda", "uom"],
    price_current: ["preco", "price", "preco_base", "preco_venda", "sell_price", "valor", "price_current", "sellprice"],
    price_original: ["preco_original", "original_price", "preco_de", "price_original", "preco_antigo", "old_price"],
  };

  const keywords = keywordMap[fieldKey] || [fieldKey];
  
  for (const kw of keywords) {
    const exact = paths.find(p => {
      const lastPart = p.path.split(".").pop()?.toLowerCase() || "";
      return lastPart === kw.toLowerCase();
    });
    if (exact) return exact.path;
  }
  
  for (const kw of keywords) {
    const partial = paths.find(p => {
      const lastPart = p.path.split(".").pop()?.toLowerCase() || "";
      return lastPart.includes(kw.toLowerCase());
    });
    if (partial) return partial.path;
  }
  
  return "";
}

const resolveValue = (obj: any, path: string) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => {
    if (acc === undefined || acc === null) return undefined;
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) return acc[match[1]]?.[parseInt(match[2])];
    return acc[part];
  }, obj);
};

export function IntegrationMapping({ value, onChange, externalSampleResponse }: IntegrationMappingProps) {
  const [sampleJson, setSampleJson] = useState(JSON.stringify(value?.sample_response || {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(value?.sample_response || {});
  const [pathsWithValues, setPathsWithValues] = useState<{ path: string; value: any }[]>([]);

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
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  // When external sample response comes from test, auto-fill the JSON textarea
  useEffect(() => {
    if (externalSampleResponse && typeof externalSampleResponse === "object") {
      const json = JSON.stringify(externalSampleResponse, null, 2);
      setSampleJson(json);
      setParsedJson(externalSampleResponse);
      setJsonError(null);
      setHasAutoFilled(false); // allow re-auto-fill
      toast.success("Resposta do teste carregada automaticamente no mapeamento");
    }
  }, [externalSampleResponse]);

  // Extract available paths when JSON changes
  useEffect(() => {
    if (parsedJson && typeof parsedJson === "object") {
      setPathsWithValues(extractPathsWithValues(parsedJson));
    } else {
      setPathsWithValues([]);
    }
  }, [parsedJson]);

  // Auto-fill mapping fields when paths are detected
  useEffect(() => {
    if (pathsWithValues.length > 0 && !hasAutoFilled) {
      const fields = ["barcode", "description", "internal_code", "image", "unit", "price_current", "price_original"];
      const newMapping = { ...mapping };
      let changed = false;

      for (const field of fields) {
        if (!(newMapping as any)[field]) {
          const detected = autoDetectPath(field, pathsWithValues);
          if (detected) {
            (newMapping as any)[field] = detected;
            changed = true;
          }
        }
      }

      if (changed) {
        setMapping(newMapping);
        setHasAutoFilled(true);
        toast.success("Campos mapeados automaticamente com base nas chaves do JSON");
      }
    }
  }, [pathsWithValues, hasAutoFilled]);

  // Auto-test mapping when auto-fill happens
  useEffect(() => {
    if (hasAutoFilled && parsedJson && mapping.description) {
      testMapping();
    }
  }, [hasAutoFilled]);

  const testMapping = useCallback(() => {
    if (!parsedJson) return;

    const result = {
      barcode: resolveValue(parsedJson, mapping.barcode),
      internal_code: resolveValue(parsedJson, mapping.internal_code),
      description: resolveValue(parsedJson, mapping.description),
      image: resolveValue(parsedJson, mapping.image),
      unit: resolveValue(parsedJson, mapping.unit) || "UN",
      price_current: Number(resolveValue(parsedJson, mapping.price_current)) || 0,
      price_original: mapping.price_original ? Number(resolveValue(parsedJson, mapping.price_original)) : null,
      prices: mapping.prices?.map((p: any) => ({
        label: p.label,
        value: Number(resolveValue(parsedJson, p.path)) || 0,
      })) || [],
    };

    setTestResult(result);
  }, [parsedJson, mapping]);

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
    const val = path === "__none__" ? "" : path;
    setMapping((prev: any) => ({ ...prev, [field]: val }));
  };

  const addPriceMapping = () => {
    setMapping((prev: any) => ({
      ...prev,
      prices: [...(prev.prices || []), { label: "Preço", path: "", fallback: "0.00" }],
    }));
  };

  const updatePriceMapping = (index: number, key: string, val: string) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices[index] = { ...newPrices[index], [key]: val === "__none__" ? "" : val };
    setMapping((prev: any) => ({ ...prev, prices: newPrices }));
  };

  const removePriceMapping = (index: number) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices.splice(index, 1);
    setMapping((prev: any) => ({ ...prev, prices: newPrices }));
  };

  const handleAutoDetect = () => {
    if (pathsWithValues.length === 0) {
      toast.error("Nenhum campo detectado no JSON");
      return;
    }
    const fields = ["barcode", "description", "internal_code", "image", "unit", "price_current", "price_original"];
    const newMapping = { ...mapping };
    let count = 0;

    for (const field of fields) {
      const detected = autoDetectPath(field, pathsWithValues);
      if (detected) {
        (newMapping as any)[field] = detected;
        count++;
      }
    }

    setMapping(newMapping);
    if (count > 0) {
      toast.success(`${count} campo(s) mapeado(s) automaticamente`);
    } else {
      toast.info("Nenhum campo pôde ser detectado automaticamente");
    }
  };

  /** Render a dropdown for a mapping field */
  const FieldDropdown = ({ fieldKey, label, currentValue }: { fieldKey: string; label: string; currentValue: string }) => {
    const previewValue = currentValue ? resolveValue(parsedJson, currentValue) : null;
    
    return (
      <div className="grid gap-1.5">
        <Label className="text-sm">{label}</Label>
        <Select
          value={currentValue || "__none__"}
          onValueChange={(v) => handleFieldChange(fieldKey, v)}
        >
          <SelectTrigger className="font-mono text-sm h-9">
            <SelectValue placeholder="Selecione o campo..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="__none__">
              <span className="text-muted-foreground">— Não mapeado —</span>
            </SelectItem>
            {pathsWithValues.map(({ path, value }) => (
              <SelectItem key={path} value={path}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{path}</span>
                  <span className="text-muted-foreground text-[10px] truncate max-w-[200px]">
                    = {String(value ?? "null")}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentValue && previewValue !== undefined && (
          <div className="text-xs text-muted-foreground font-mono pl-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Valor: <span className="text-foreground font-medium truncate max-w-[300px]">{String(previewValue)}</span>
          </div>
        )}
        {currentValue && previewValue === undefined && (
          <div className="text-xs text-destructive font-mono pl-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Caminho não encontrado no JSON
          </div>
        )}
      </div>
    );
  };

  const productFound = testResult && testResult.description && testResult.description !== undefined;

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
        {pathsWithValues.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <Zap className="h-3 w-3 inline mr-1" />
            {pathsWithValues.length} campos detectados no JSON
          </div>
        )}
      </div>

      {/* Right Column: Mapping Configuration */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base font-medium">Mapeamento de Campos</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoDetect}
              disabled={!!jsonError || pathsWithValues.length === 0}
              className="gap-2"
            >
              <Wand2 className="h-3 w-3" /> Auto-detectar
            </Button>
            <Button size="sm" onClick={testMapping} disabled={!!jsonError} className="gap-2 bg-green-600 hover:bg-green-700">
              <Play className="h-3 w-3" /> Testar Mapeamento
            </Button>
          </div>
        </div>

        {/* Test Result Card */}
        {testResult && (
          <Card className={`${productFound ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${productFound ? "text-green-400" : "text-yellow-400"}`}>
                {productFound ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                Resultado do Mapeamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border">
                  <span className="text-xs text-muted-foreground font-medium">Produto</span>
                  <span className="text-sm font-semibold text-foreground">
                    {testResult.description || <span className="text-destructive">Não mapeado</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border">
                  <span className="text-xs text-muted-foreground font-medium">Preço Atual</span>
                  <span className="text-sm font-bold text-foreground">
                    {testResult.price_current > 0 
                      ? `R$ ${testResult.price_current.toFixed(2)}`
                      : <span className="text-destructive">Não mapeado</span>
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border">
                  <span className="text-xs text-muted-foreground font-medium">Código</span>
                  <span className="text-sm font-mono text-foreground">
                    {testResult.barcode || <span className="text-destructive">Não mapeado</span>}
                  </span>
                </div>
                {testResult.price_original !== null && testResult.price_original !== 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border">
                    <span className="text-xs text-muted-foreground font-medium">Preço Original</span>
                    <span className="text-sm text-foreground">R$ {testResult.price_original.toFixed(2)}</span>
                  </div>
                )}
                {testResult.image && (
                  <div className="p-2.5 rounded-md bg-background/50 border space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Imagem</span>
                    <div className="flex items-center gap-3">
                      <img
                        src={String(testResult.image)}
                        alt="Produto"
                        className="h-16 w-16 object-contain rounded border bg-white"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-xs font-mono text-muted-foreground truncate flex-1">{String(testResult.image)}</span>
                    </div>
                  </div>
                )}
              </div>
              {testResult.prices.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1">
                  <span className="text-xs text-muted-foreground block mb-1">Outros Preços:</span>
                  {testResult.prices.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm p-1.5 rounded bg-background/50">
                      <span>{p.label}:</span>
                      <span className="font-semibold">R$ {p.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          Selecione o campo correspondente no JSON para cada campo do padrão Mupa.
          Os campos são pré-detectados automaticamente quando possível.
        </p>

        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Produto (Básico)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldDropdown fieldKey="barcode" label="Código de Barras (EAN)" currentValue={mapping.barcode} />
            <FieldDropdown fieldKey="description" label="Descrição / Nome do Produto" currentValue={mapping.description} />
            <FieldDropdown fieldKey="internal_code" label="Código Interno (Opcional)" currentValue={mapping.internal_code} />
            <FieldDropdown fieldKey="image" label="URL da Imagem (Opcional)" currentValue={mapping.image} />
            <FieldDropdown fieldKey="unit" label="Unidade (Opcional)" currentValue={mapping.unit} />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Preços e Promoções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldDropdown fieldKey="price_current" label="Preço Atual (Obrigatório)" currentValue={mapping.price_current} />
            <FieldDropdown fieldKey="price_original" label="Preço Original / 'De' (Opcional)" currentValue={mapping.price_original} />
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
                      <Select
                        value={price.path || "__none__"}
                        onValueChange={(v) => updatePriceMapping(index, "path", v)}
                      >
                        <SelectTrigger className="h-8 text-xs font-mono">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Selecione —</SelectItem>
                          {pathsWithValues.map(({ path, value }) => (
                            <SelectItem key={path} value={path}>
                              <span className="font-mono text-xs">{path}</span>
                              <span className="text-muted-foreground text-[10px] ml-1">= {String(value ?? "null")}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
