import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2, Download, ShieldAlert, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StoreImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ParsedRow {
  codigo: string;
  nome: string;
  regional: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  valid: boolean;
  error?: string;
}

interface ImportLog {
  id: string;
  status: string;
  total_rows: number | null;
  success_rows: number | null;
  error_rows: number | null;
  errors: string[] | null;
}

type ImportStatus = 'idle' | 'parsing' | 'validating' | 'preview' | 'importing' | 'completed' | 'error';

const CSV_TEMPLATE = `codigo,nome,regional,cnpj,endereco,bairro,cep,cidade,estado
LJ001,Loja Centro,João Silva,12.345.678/0001-90,Rua Principal 100,Centro,01234-567,São Paulo,SP
LJ002,Loja Shopping,Maria Santos,98.765.432/0001-10,Av. Brasil 500,Jardins,04567-890,Rio de Janeiro,RJ`;

export function StoreImportDialog({ open, onOpenChange, onImportComplete }: StoreImportDialogProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [importLogId, setImportLogId] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [results, setResults] = useState({ success: 0, error: 0, errors: [] as string[] });

  // Subscribe to import log updates for real-time progress
  useEffect(() => {
    if (!importLogId || status !== 'importing') return;

    const channel = supabase
      .channel(`import-${importLogId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_logs',
          filter: `id=eq.${importLogId}`
        },
        (payload) => {
          const log = payload.new as ImportLog;
          
          if (log.total_rows && log.success_rows !== null && log.error_rows !== null) {
            const processedRows = (log.success_rows || 0) + (log.error_rows || 0);
            const newProgress = Math.round((processedRows / log.total_rows) * 100);
            setProgress(newProgress);
            setResults({
              success: log.success_rows || 0,
              error: log.error_rows || 0,
              errors: (log.errors as string[]) || []
            });
          }

          if (log.status === 'completed') {
            setStatus('completed');
            setResults({
              success: log.success_rows || 0,
              error: log.error_rows || 0,
              errors: (log.errors as string[]) || []
            });
            toast.success('Importação concluída!');
            onImportComplete?.();
          } else if (log.status === 'error') {
            setStatus('error');
            toast.error('Erro na importação');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [importLogId, status, onImportComplete]);

  const resetState = () => {
    setStatus('idle');
    setParsedData([]);
    setProgress(0);
    setImportLogId(null);
    setPermissionError(null);
    setResults({ success: 0, error: 0, errors: [] });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_importacao_lojas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Modelo CSV baixado');
  };

  const validatePermissions = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await (supabase.auth as any).getUser();
      if (!user) {
        setPermissionError('Você precisa estar logado para importar lojas.');
        return false;
      }

      // Check if user is tenant admin (includes super admins)
      const { data: isTenantAdmin, error } = await supabase.rpc('is_tenant_admin', { check_user_id: user.id });
      
      if (error || !isTenantAdmin) {
        setPermissionError('Apenas administradores do tenant podem importar lojas.');
        return false;
      }

      // Check if user has a tenant assigned
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict', { check_user_id: user.id });
      
      if (!tenantId) {
        setPermissionError('Você não está vinculado a nenhum cliente. Entre em contato com o suporte.');
        return false;
      }

      return true;
    } catch (error) {
      setPermissionError('Erro ao verificar permissões. Tente novamente.');
      return false;
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    if (!file.name.endsWith('.csv')) {
      toast.error('Apenas arquivos CSV são permitidos');
      return;
    }

    // Validate permissions first
    setStatus('validating');
    setPermissionError(null);
    
    const hasPermission = await validatePermissions();
    if (!hasPermission) {
      setStatus('idle');
      return;
    }

    setStatus('parsing');
    
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('Arquivo vazio ou sem dados');
          setStatus('idle');
          return;
        }

        const header = lines[0].toLowerCase().split(',').map(h => 
          h.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        const requiredColumns = ['codigo', 'nome', 'cidade', 'estado'];
        const missingColumns = requiredColumns.filter(col => !header.includes(col));

        if (missingColumns.length > 0) {
          toast.error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
          setStatus('idle');
          return;
        }

        const columnIndexes = {
          codigo: header.indexOf('codigo'),
          nome: header.indexOf('nome'),
          regional: header.indexOf('regional'),
          cnpj: header.indexOf('cnpj'),
          endereco: header.indexOf('endereco'),
          bairro: header.indexOf('bairro'),
          cep: header.indexOf('cep'),
          cidade: header.indexOf('cidade'),
          estado: header.indexOf('estado'),
        };

        const parsed: ParsedRow[] = [];
        const seenCodes = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          const line = lines[i];
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          const row: ParsedRow = {
            codigo: columnIndexes.codigo >= 0 ? values[columnIndexes.codigo] || '' : '',
            nome: columnIndexes.nome >= 0 ? values[columnIndexes.nome] || '' : '',
            regional: columnIndexes.regional >= 0 ? values[columnIndexes.regional] || '' : '',
            cnpj: columnIndexes.cnpj >= 0 ? values[columnIndexes.cnpj] || '' : '',
            endereco: columnIndexes.endereco >= 0 ? values[columnIndexes.endereco] || '' : '',
            bairro: columnIndexes.bairro >= 0 ? values[columnIndexes.bairro] || '' : '',
            cep: columnIndexes.cep >= 0 ? values[columnIndexes.cep] || '' : '',
            cidade: columnIndexes.cidade >= 0 ? values[columnIndexes.cidade] || '' : '',
            estado: columnIndexes.estado >= 0 ? values[columnIndexes.estado] || '' : '',
            valid: true,
          };

          // Validations
          if (!row.codigo) {
            row.valid = false;
            row.error = 'Código obrigatório';
          } else if (!row.nome) {
            row.valid = false;
            row.error = 'Nome obrigatório';
          } else if (!row.cidade) {
            row.valid = false;
            row.error = 'Cidade obrigatória';
          } else if (!row.estado) {
            row.valid = false;
            row.error = 'Estado obrigatório';
          } else if (row.estado.length > 50) {
            row.valid = false;
            row.error = 'Estado muito longo';
          } else if (seenCodes.has(row.codigo.toLowerCase())) {
            row.valid = false;
            row.error = 'Código duplicado no arquivo';
          } else {
            seenCodes.add(row.codigo.toLowerCase());
          }

          parsed.push(row);
        }

        setParsedData(parsed);
        setStatus('preview');
        
        const invalidCount = parsed.filter(r => !r.valid).length;
        if (invalidCount > 0) {
          toast.warning(`${invalidCount} linha(s) com problemas detectados`);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Erro ao processar arquivo');
        setStatus('idle');
      }
    };

    reader.readAsText(file);
  }, []);

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.valid);
    
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }

    setStatus('importing');
    setProgress(0);

    try {
      // Create import log first
      const { data: { user } } = await (supabase.auth as any).getUser();
      
      const { data: log, error: logError } = await supabase
        .from('import_logs')
        .insert({
          user_id: user?.id,
          type: 'stores',
          status: 'pending',
          total_rows: validRows.length,
          success_rows: 0,
          error_rows: 0,
          errors: []
        })
        .select()
        .single();

      if (logError) {
        throw new Error('Erro ao criar log de importação');
      }

      setImportLogId(log.id);

      // Get session for auth header
      const { data: { session } } = await (supabase.auth as any).getSession();
      
      // Call edge function
      const response = await supabase.functions.invoke('import-stores', {
        body: {
          rows: validRows.map(r => ({
            codigo: r.codigo,
            nome: r.nome,
            regional: r.regional,
            cnpj: r.cnpj,
            endereco: r.endereco,
            bairro: r.bairro,
            cep: r.cep,
            cidade: r.cidade,
            estado: r.estado,
          })),
          import_log_id: log.id
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro na importação');
      }

      // The completion will be handled by realtime subscription
      // But also handle the response if realtime doesn't catch it
      if (response.data) {
        setResults({
          success: response.data.success_count || 0,
          error: response.data.error_count || 0,
          errors: response.data.errors || []
        });
        setProgress(100);
        setStatus('completed');
        onImportComplete?.();
      }

    } catch (error: any) {
      console.error('Import error:', error);
      setStatus('error');
      toast.error(error.message || 'Erro ao importar lojas');
    }
  };

  const validCount = parsedData.filter(r => r.valid).length;
  const invalidCount = parsedData.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lojas</DialogTitle>
          <DialogDescription>
            Importe lojas em massa usando um arquivo CSV. O sistema criará automaticamente as regiões, estados e cidades.
          </DialogDescription>
        </DialogHeader>

        {permissionError && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>{permissionError}</AlertDescription>
          </Alert>
        )}

        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            
            <div className="text-center mb-6">
              <p className="text-muted-foreground mb-2">
                Colunas obrigatórias: <strong>codigo, nome, cidade, estado</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Colunas opcionais: regional, cnpj, endereco, bairro, cep
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Modelo CSV
              </Button>
              <label className="cursor-pointer">
                <Button asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivo CSV
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm max-w-lg">
              <p className="font-medium mb-2">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>O sistema valida suas permissões antes de iniciar</li>
                <li>A importação é processada em lotes em segundo plano</li>
                <li>Você pode acompanhar o progresso em tempo real</li>
                <li>Erros são registrados sem interromper a importação</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'validating' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        )}

        {status === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Processando arquivo...</p>
          </div>
        )}

        {status === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4 mb-4 items-center">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <XCircle className="h-3 w-3 mr-1" />
                  {invalidCount} inválidos
                </Badge>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                Apenas linhas válidas serão importadas
              </span>
            </div>
            
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky top-0 bg-background">Status</TableHead>
                    <TableHead className="sticky top-0 bg-background">Código</TableHead>
                    <TableHead className="sticky top-0 bg-background">Nome</TableHead>
                    <TableHead className="sticky top-0 bg-background">Regional</TableHead>
                    <TableHead className="sticky top-0 bg-background">Cidade</TableHead>
                    <TableHead className="sticky top-0 bg-background">UF</TableHead>
                    <TableHead className="sticky top-0 bg-background">Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((row, i) => (
                    <TableRow key={i} className={row.valid ? '' : 'bg-destructive/10'}>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{row.codigo}</TableCell>
                      <TableCell>{row.nome}</TableCell>
                      <TableCell>{row.regional || '-'}</TableCell>
                      <TableCell>{row.cidade}</TableCell>
                      <TableCell>{row.estado}</TableCell>
                      <TableCell className="text-destructive text-sm">{row.error || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-2">
                Mostrando 100 de {parsedData.length} linhas
              </p>
            )}
          </div>
        )}

        {status === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium mb-2">Importando lojas...</p>
            <p className="text-muted-foreground mb-4 text-sm">
              Processando em lotes de 50 registros
            </p>
            <div className="w-full max-w-md">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>{progress}% concluído</span>
                <span>
                  {results.success} importados | {results.error} erros
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Você pode continuar navegando. A importação continua em segundo plano.
            </p>
          </div>
        )}

        {status === 'completed' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Importação Concluída</h3>
            <div className="flex gap-4 mb-4">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {results.success} importados
              </Badge>
              {results.error > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <XCircle className="h-3 w-3 mr-1" />
                  {results.error} erros
                </Badge>
              )}
            </div>
            
            {results.errors.length > 0 && (
              <div className="w-full max-w-lg mt-4">
                <p className="text-sm font-medium mb-2 text-destructive">Erros encontrados:</p>
                <div className="max-h-40 overflow-auto bg-muted/50 rounded-lg p-3 text-sm">
                  {results.errors.slice(0, 20).map((error, i) => (
                    <p key={i} className="text-muted-foreground">{error}</p>
                  ))}
                  {results.errors.length > 20 && (
                    <p className="text-muted-foreground mt-2">
                      ... e mais {results.errors.length - 20} erros
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Erro na Importação</h3>
            <p className="text-muted-foreground mb-4">
              Ocorreu um erro durante a importação. Tente novamente.
            </p>
            <Button variant="outline" onClick={resetState}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </div>
        )}

        <DialogFooter>
          {status === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar {validCount} lojas
              </Button>
            </>
          )}
          {(status === 'completed' || status === 'error') && (
            <Button onClick={() => { resetState(); onOpenChange(false); }}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
