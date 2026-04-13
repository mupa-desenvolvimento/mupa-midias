import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, Company, CompanyWithIntegrations, ApiIntegration } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Building2, Plug2, Trash2, Edit, Settings, Eye, EyeOff, Loader2, Link2, Unlink2, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { PageShell } from "@/components/layout/PageShell";
import { ListViewport } from "@/components/list/ListViewport";
import { ListControls } from "@/components/list/ListControls";
import { UniversalPagination } from "@/components/list/UniversalPagination";
import { useListState } from "@/hooks/useListState";

type CompanyStatusFilter = "all" | "active" | "inactive";

interface CompanyFilters {
  status: CompanyStatusFilter;
}

export default function Companies() {
  const navigate = useNavigate();
  const { 
    companies, 
    availableIntegrations, 
    isLoading, 
    createCompany, 
    updateCompany, 
    deleteCompany,
    addCompanyIntegration,
    updateCompanyIntegration,
    removeCompanyIntegration
  } = useCompanies();


  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithIntegrations | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  
  const [companyForm, setCompanyForm] = useState({
    name: "",
    slug: "",
    cnpj: ""
  });
  
  const [integrationForm, setIntegrationForm] = useState({
    integration_id: "",
    usuario: "",
    password: "",
    loja: "",
    image_base_url: "http://srv-mupa.ddns.net:5050/produto-imagem"
  });

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<CompanyFilters>({
    initialFilters: { status: "all" },
    initialPageSize: 12,
  });

  const filteredCompanies = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const statusFilter = state.filters.status;

    return companies.filter((company) => {
      const matchesTerm =
        !term ||
        company.name.toLowerCase().includes(term) ||
        company.slug.toLowerCase().includes(term) ||
        (company.cnpj || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && company.is_active) ||
        (statusFilter === "inactive" && !company.is_active);

      return matchesTerm && matchesStatus;
    });
  }, [companies, state.search, state.filters]);

  const totalCompanies = filteredCompanies.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedCompanies =
    totalCompanies === 0
      ? []
      : filteredCompanies.slice(startIndex, startIndex + state.pageSize);

  const handleCreateCompany = async () => {
    if (!companyForm.name || !companyForm.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    
    await createCompany.mutateAsync({
      name: companyForm.name,
      slug: companyForm.slug.toLowerCase().replace(/\s+/g, "-"),
      cnpj: companyForm.cnpj || null
    });
    
    setIsCreateDialogOpen(false);
    setCompanyForm({ name: "", slug: "", cnpj: "" });
  };

  const handleAddIntegration = async () => {
    if (!selectedCompany || !integrationForm.integration_id) {
      toast.error("Selecione uma integração");
      return;
    }
    
    if (!integrationForm.usuario || !integrationForm.password) {
      toast.error("Credenciais são obrigatórias");
      return;
    }
    
    if (!integrationForm.loja) {
      toast.error("Código da loja é obrigatório");
      return;
    }
    
    await addCompanyIntegration.mutateAsync({
      company_id: selectedCompany.id,
      integration_id: integrationForm.integration_id,
      credentials: {
        usuario: integrationForm.usuario,
        password: integrationForm.password
      } as unknown as Json,
      settings: {
        loja: integrationForm.loja,
        store_code: integrationForm.loja,
        image_base_url: integrationForm.image_base_url
      } as unknown as Json
    });
    
    setIsIntegrationDialogOpen(false);
    setIntegrationForm({
      integration_id: "",
      usuario: "",
      password: "",
      loja: "",
      image_base_url: "http://srv-mupa.ddns.net:5050/produto-imagem"
    });
    setSelectedCompany(null);
  };

  const handleRemoveIntegration = async (integrationId: string) => {
    if (!confirm("Tem certeza que deseja remover esta integração?")) return;
    await removeCompanyIntegration.mutateAsync(integrationId);
  };


  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja excluir a empresa "${company.name}"?`)) return;
    await deleteCompany.mutateAsync(company.id);
  };

  const renderGridView = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {paginatedCompanies.map((company) => (
        <Card key={company.id} className={`transition-all ${!company.is_active ? "opacity-60" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{company.name}</CardTitle>
              </div>
              <Badge variant={company.is_active ? "default" : "secondary"}>
                {company.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <CardDescription>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{company.slug}</code>
              {company.cnpj && <span className="ml-2">• CNPJ: {company.cnpj}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Integrações:</span>
              <Badge variant="outline">{company.integrations?.length || 0}</Badge>
            </div>

            {company.integrations && company.integrations.length > 0 && (
              <div className="space-y-1">
                {company.integrations.map((ci) => {
                  const settings = ci.settings as Record<string, string> || {};
                  return (
                    <div key={ci.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-accent/30">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="h-3 w-3 text-primary" />
                        <span>{ci.integration?.name || "API"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="bg-muted px-1 rounded">{settings.loja || "-"}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveIntegration(ci.id)}>
                          <Unlink2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


            <div className="flex justify-end gap-1 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => navigate(`/admin/companies/${company.id}/display-config`)}>
                <Monitor className="h-4 w-4 mr-1" />
                Tela
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setSelectedCompany(company); setIsIntegrationDialogOpen(true); }}>
                <Plug2 className="h-4 w-4 mr-1" />
                Integração
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(company)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderListView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Integrações</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCompanies.map((company) => (
              <TableRow key={company.id} className={!company.is_active ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {company.name}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{company.slug}</code>
                </TableCell>
                <TableCell className="font-mono text-xs">{company.cnpj || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{company.integrations?.length || 0}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={company.is_active ? "default" : "secondary"}>
                    {company.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/companies/${company.id}/display-config`)} title="Tela de Consulta">
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCompany(company); setIsIntegrationDialogOpen(true); }} title="Integração">
                      <Plug2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(company)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <PageShell
      className="animate-fade-in"
      header={
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="text-muted-foreground">
            Gerencie empresas e suas integrações de API
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Empresa</DialogTitle>
                <DialogDescription>
                  Adicione uma nova empresa/cliente ao sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Zaffari"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (identificador único)</Label>
                  <Input
                    id="slug"
                    placeholder="Ex: zaffari"
                    value={companyForm.slug}
                    onChange={(e) => setCompanyForm({ 
                      ...companyForm, 
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-") 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCompany} disabled={createCompany.isPending}>
                  {createCompany.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Empresa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
      controls={
        <div className="py-2">
          <ListControls
            state={state}
            onSearchChange={setSearch}
            onViewChange={setView}
            onClearFilters={reset}
          >
            <Select
              value={state.filters.status}
              onValueChange={(value) =>
                setFilters({ ...state.filters, status: value as CompanyStatusFilter })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </ListControls>
        </div>
      }
      footer={
        <UniversalPagination
          page={state.page}
          pageSize={state.pageSize}
          total={totalCompanies}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      }
    >
      <ListViewport>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalCompanies === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma empresa encontrada</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                {state.search
                  ? "Nenhuma empresa corresponde à sua busca."
                  : "Crie uma empresa para começar a configurar integrações de API"}
              </p>
              {!state.search && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Empresa
                </Button>
              )}
            </CardContent>
          </Card>
        ) : state.view === "list" ? (
          renderListView()
        ) : (
          renderGridView()
        )}
      </ListViewport>

      {/* Dialog para adicionar integração */}
      <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Integração</DialogTitle>
            <DialogDescription>
              Configure a integração de API para {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="integration">Tipo de Integração</Label>
              <Select
                value={integrationForm.integration_id}
                onValueChange={(value) => setIntegrationForm({ ...integrationForm, integration_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {integration.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Credenciais da API
              </h4>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="usuario">Usuário</Label>
                  <Input
                    id="usuario"
                    placeholder="Usuário da API"
                    value={integrationForm.usuario}
                    onChange={(e) => setIntegrationForm({ ...integrationForm, usuario: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showCredentials ? "text" : "password"}
                      placeholder="Senha da API"
                      value={integrationForm.password}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCredentials(!showCredentials)}
                    >
                      {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loja">Código da Loja</Label>
                  <Input
                    id="loja"
                    placeholder="Ex: 001"
                    value={integrationForm.loja}
                    onChange={(e) => setIntegrationForm({ ...integrationForm, loja: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_base_url">URL Base de Imagens</Label>
                  <Input
                    id="image_base_url"
                    placeholder="http://..."
                    value={integrationForm.image_base_url}
                    onChange={(e) => setIntegrationForm({ ...integrationForm, image_base_url: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIntegrationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddIntegration} disabled={addCompanyIntegration.isPending}>
              {addCompanyIntegration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Integração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
