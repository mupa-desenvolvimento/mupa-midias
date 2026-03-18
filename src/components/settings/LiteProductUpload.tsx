import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Trash2, Plus, Package, Download, Image } from "lucide-react";
import { useLiteProducts, type LiteProduct } from "@/hooks/useLiteProducts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/"/g, "").toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(sep).map((v) => v.trim().replace(/"/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function parseJSON(text: string): Array<Record<string, string>> {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [data];
}

const emptyProduct = {
  ean: "", internal_code: "", description: "", normal_price: 0,
  promo_price: null as number | null, de_por_price: null as number | null,
  club_price: null as number | null, leve_x_pague_y: null as string | null,
  discount_4th_item: null as number | null, other_price: null as number | null,
  custom_field_name: null as string | null, custom_field_value: null as string | null,
  image_url: null as string | null,
};

export function LiteProductUpload() {
  const { products, isLoading, importProducts, upsertProduct, deleteProduct } = useLiteProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyProduct);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    let rows: Array<Record<string, string>> = [];

    try {
      if (file.name.endsWith(".json")) {
        rows = parseJSON(text);
      } else {
        rows = parseCSV(text);
      }
    } catch {
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
      return;
    }

    if (rows.length === 0) {
      toast.error("Arquivo vazio ou sem dados válidos");
      return;
    }

    importProducts.mutate(rows);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveProduct = () => {
    if (!form.ean || !form.description) {
      toast.error("EAN e Descrição são obrigatórios");
      return;
    }
    upsertProduct.mutate(form as any, {
      onSuccess: () => {
        setDialogOpen(false);
        setForm(emptyProduct);
        toast.success("Produto salvo!");
      },
      onError: (err: Error) => toast.error(err.message),
    });
  };

  const handleDownloadTemplate = () => {
    const header = "ean;descricao;codigo_interno;preco_normal;preco_promocional;de_por;clube;leve_x_pague_y;desconto_4_item;outro;campo_extra_nome;campo_extra_valor;url_imagem";
    const sample = "7891234567890;Produto Exemplo;001;9.99;7.99;8.49;6.99;Leve 3 Pague 2;5.99;0;;; ";
    const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const setField = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: ["normal_price", "promo_price", "de_por_price", "club_price", "discount_4th_item", "other_price"].includes(key)
        ? (value === "" ? null : parseFloat(value))
        : value || null,
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Cadastro de Produtos
          </CardTitle>
          <CardDescription>
            Importe seus produtos via arquivo CSV/JSON ou cadastre manualmente. As imagens são obtidas automaticamente via API Mupa quando não fornecidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Baixar Modelo CSV
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importProducts.isPending}
              className="bg-primary text-primary-foreground"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importProducts.isPending ? "Importando..." : "Importar Arquivo"}
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => setForm(emptyProduct)}>
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Produto</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label>EAN (Código de Barras) *</Label>
                    <Input value={form.ean} onChange={(e) => setField("ean", e.target.value)} placeholder="7891234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label>Código Interno</Label>
                    <Input value={form.internal_code || ""} onChange={(e) => setField("internal_code", e.target.value)} placeholder="001" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Descrição *</Label>
                    <Input value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Nome do produto" />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Normal</Label>
                    <Input type="number" step="0.01" value={form.normal_price || ""} onChange={(e) => setField("normal_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Promocional</Label>
                    <Input type="number" step="0.01" value={form.promo_price ?? ""} onChange={(e) => setField("promo_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor De/Por</Label>
                    <Input type="number" step="0.01" value={form.de_por_price ?? ""} onChange={(e) => setField("de_por_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Clube</Label>
                    <Input type="number" step="0.01" value={form.club_price ?? ""} onChange={(e) => setField("club_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Leve X Pague Y</Label>
                    <Input value={form.leve_x_pague_y ?? ""} onChange={(e) => setField("leve_x_pague_y", e.target.value)} placeholder="Leve 3 Pague 2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto 4º Item</Label>
                    <Input type="number" step="0.01" value={form.discount_4th_item ?? ""} onChange={(e) => setField("discount_4th_item", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Outro</Label>
                    <Input type="number" step="0.01" value={form.other_price ?? ""} onChange={(e) => setField("other_price", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Campo Extra (nome)</Label>
                    <Input value={form.custom_field_name ?? ""} onChange={(e) => setField("custom_field_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Campo Extra (valor)</Label>
                    <Input value={form.custom_field_value ?? ""} onChange={(e) => setField("custom_field_value", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="flex items-center gap-1"><Image className="w-4 h-4" /> URL da Imagem</Label>
                    <Input value={form.image_url ?? ""} onChange={(e) => setField("image_url", e.target.value)} placeholder="Deixe vazio para buscar automaticamente via Mupa" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveProduct} disabled={upsertProduct.isPending}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" />
            Colunas aceitas: ean, descricao, codigo_interno, preco_normal, preco_promocional, de_por, clube, leve_x_pague_y, desconto_4_item, outro, campo_extra_nome, campo_extra_valor, url_imagem
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : products.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
              <p className="text-sm text-muted-foreground">Importe um CSV ou cadastre manualmente.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Img</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Normal</TableHead>
                    <TableHead className="text-right">Promo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-10 h-10 object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.ean}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{p.description}</TableCell>
                      <TableCell className="text-right">R$ {Number(p.normal_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{p.promo_price ? `R$ ${Number(p.promo_price).toFixed(2)}` : "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct.mutate(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
