
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowRight, Code2, AlertCircle, CheckCircle2, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface IntegrationMappingProps {
  value: any;
  onChange: (value: any) => void;
}

export function IntegrationMapping({ value, onChange }: IntegrationMappingProps) {
  const [sampleJson, setSampleJson] = useState(JSON.stringify(value?.sample_response || {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(value?.sample_response || {});
  
  const defaultMapping = {
    barcode: "",
    internal_code: "",
    description: "",
    image: "",
    unit: "",
    price_current: "",
    price_original: "",
    prices: [] // Array of { label, path, is_list, list_path }
  };

  const [mapping, setMapping] = useState({ ...defaultMapping, ...value?.fields });

  const [testResult, setTestResult] = useState<any>(null);

  const resolveValue = (obj: any, path: string) => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
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
        value: Number(resolveValue(parsedJson, p.path)) || 0
      })) || []
    };
    
    setTestResult(result);
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(sampleJson);
      setParsedJson(parsed);
      setJsonError(null);
      
      // Update parent only if valid
      onChange({
        sample_response: parsed,
        fields: mapping
      });
    } catch (e) {
      setJsonError("JSON inválido");
    }
  }, [sampleJson, mapping]);

  const handleFieldChange = (field: string, path: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: path
    }));
  };

  const addPriceMapping = () => {
    setMapping(prev => ({
      ...prev,
      prices: [
        ...(prev.prices || []),
        { label: "Preço", path: "", fallback: "0.00" }
      ]
    }));
  };

  const updatePriceMapping = (index: number, key: string, val: string) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices[index] = { ...newPrices[index], [key]: val };
    setMapping(prev => ({ ...prev, prices: newPrices }));
  };

  const removePriceMapping = (index: number) => {
    const newPrices = [...(mapping.prices || [])];
    newPrices.splice(index, 1);
    setMapping(prev => ({ ...prev, prices: newPrices }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Column: Sample JSON */}
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Exemplo de Resposta JSON</Label>
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
          Cole aqui um exemplo real da resposta da API do cliente para facilitar o mapeamento.
        </p>
        <Textarea
          className={`font-mono text-xs flex-1 min-h-[500px] resize-none ${jsonError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
          value={sampleJson}
          onChange={(e) => setSampleJson(e.target.value)}
          placeholder='{ "data": { "products": [ { "name": "Produto X", "price": 10.00 } ] } }'
        />
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
                <CheckCircle2 className="h-4 w-4" /> Resultado do Teste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Produto:</span>
                  <div className="text-white">{testResult.description}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço Atual:</span>
                  <div className="text-white font-bold">R$ {testResult.price_current.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Código:</span>
                  <div className="text-white">{testResult.barcode}</div>
                </div>
                {testResult.price_original && (
                  <div>
                    <span className="text-muted-foreground">Preço Original:</span>
                    <div className="text-white">R$ {testResult.price_original.toFixed(2)}</div>
                  </div>
                )}
              </div>
              {testResult.prices.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-muted-foreground block mb-1">Outros Preços:</span>
                  <div className="space-y-1">
                    {testResult.prices.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{p.label}:</span>
                        <span className="text-white">R$ {p.value.toFixed(2)}</span>
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
          Use notação de ponto (ex: <code>data.produto.nome</code>).
        </p>

        <Card className="border-white/10 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Produto (Básico)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Código de Barras (Retorno)</Label>
              <Input 
                placeholder="ex: data.ean" 
                value={mapping.barcode}
                onChange={(e) => handleFieldChange("barcode", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Descrição / Nome</Label>
              <Input 
                placeholder="ex: data.descricao" 
                value={mapping.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label>Código Interno (Opcional)</Label>
              <Input 
                placeholder="ex: data.sku" 
                value={mapping.internal_code}
                onChange={(e) => handleFieldChange("internal_code", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label>URL da Imagem (Opcional)</Label>
              <Input 
                placeholder="ex: data.images[0].url" 
                value={mapping.image}
                onChange={(e) => handleFieldChange("image", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label>Unidade (Opcional)</Label>
              <Input 
                placeholder="ex: data.unit (ou valor estático 'UN')" 
                value={mapping.unit}
                onChange={(e) => handleFieldChange("unit", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Preços e Promoções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Preço Atual (Obrigatório)</Label>
              <Input 
                placeholder="ex: data.price" 
                value={mapping.price_current}
                onChange={(e) => handleFieldChange("price_current", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-2">
              <Label>Preço Original / 'De' (Opcional)</Label>
              <Input 
                placeholder="ex: data.original_price" 
                value={mapping.price_original}
                onChange={(e) => handleFieldChange("price_original", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/50">
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
                Nenhum preço mapeado. Adicione pelo menos um.
              </div>
            )}
            
            {mapping.prices?.map((price: any, index: number) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-muted/10 rounded-md border border-white/5 relative group">
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
                  className="h-8 w-8 text-muted-foreground hover:text-red-400 absolute -top-2 -right-2 bg-background border shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
