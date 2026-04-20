import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Power, PowerOff, Trash2, Edit, Users, Monitor, Store as StoreIcon, Shield, UserPlus, Crown, Plug2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { ListViewport } from '@/components/list/ListViewport';
import { ListControls } from '@/components/list/ListControls';
import { UniversalPagination } from '@/components/list/UniversalPagination';
import { useListState } from '@/hooks/useListState';
import { useTenants, Tenant } from '@/hooks/useTenants';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useTenantOverview } from '@/hooks/useTenantOverview';
import { TenantUsersDialog } from '@/components/admin/TenantUsersDialog';
import { TenantUsersList } from '@/components/admin/TenantUsersList';
import { CompanyIntegrationsDialog } from '@/components/admin/CompanyIntegrationsDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TenantStatusFilter = 'all' | 'active' | 'inactive';

interface TenantFilters {
  status: TenantStatusFilter;
}

const Tenants = () => {
  const navigate = useNavigate();
  const { tenants, isLoading, createTenant, updateTenant, toggleTenantStatus, deleteTenant, getTenantLicense } = useTenants();
  const { isSuperAdmin, isLoading: isCheckingAdmin } = useSuperAdmin();

  const tenantIds = useMemo(() => tenants.map((t) => t.id), [tenants]);
  const { overview } = useTenantOverview(tenantIds);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [integrationCompany, setIntegrationCompany] = useState<{ id: string; name: string } | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    company_code: '',
    max_users: 50,
    max_devices: 100,
    max_stores: 500,
    license_plan: 'lite' as 'lite' | 'standard' | 'enterprise',
  });

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<TenantFilters>({
    initialFilters: { status: 'all' },
    initialPageSize: 12,
  });

  const filteredTenants = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const statusFilter = state.filters.status;

    return tenants.filter((tenant) => {
      const matchesTerm =
        !term ||
        tenant.name.toLowerCase().includes(term) ||
        tenant.slug.toLowerCase().includes(term);

      const isActive = tenant.is_active !== false;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive);

      return matchesTerm && matchesStatus;
    });
  }, [tenants, state.search, state.filters]);

  const totalTenants = filteredTenants.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedTenants =
    totalTenants === 0
      ? []
      : filteredTenants.slice(startIndex, startIndex + state.pageSize);

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      company_code: '',
      max_users: 50,
      max_devices: 100,
      max_stores: 500,
      license_plan: 'lite',
    });
  };

  const generateCompanyCode = (name: string) => {
    const letters = name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'A');
    const numbers = String(Math.floor(100 + Math.random() * 900));
    return numbers + letters;
  };

  const formatCompanyCode = (value: string) => {
    // Format: 3 digits + 3 uppercase letters
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const digits = clean.replace(/[^0-9]/g, '').substring(0, 3);
    const letters = clean.replace(/[^A-Z]/g, '').substring(0, 3);
    return digits + letters;
  };

  const isValidCompanyCode = (code: string) => {
    return /^\d{3}[A-Z]{3}$/.test(code);
  };

  const PLAN_DEFAULTS = {
    lite: { max_users: 5, max_devices: 3, max_stores: 3 },
    standard: { max_users: 50, max_devices: 100, max_stores: 500 },
    enterprise: { max_users: 500, max_devices: 1000, max_stores: 5000 },
  };

  const handlePlanChange = (plan: 'lite' | 'standard' | 'enterprise') => {
    const defaults = PLAN_DEFAULTS[plan];
    setFormData(prev => ({ ...prev, license_plan: plan, ...defaults }));
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) return;
    
    try {
      await createTenant(formData);
      setIsCreateOpen(false);
      resetForm();
    } catch {
      // Error handled in hook
    }
  };

  const handleEdit = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    const currentPlan = await getTenantLicense(tenant.id);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      company_code: '',
      max_users: tenant.max_users || 50,
      max_devices: tenant.max_devices || 100,
      max_stores: tenant.max_stores || 500,
      license_plan: currentPlan,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTenant) return;
    
    try {
      await updateTenant(selectedTenant.id, {
        name: formData.name,
        max_users: formData.max_users,
        max_devices: formData.max_devices,
        max_stores: formData.max_stores,
        license_plan: formData.license_plan,
      });
      setIsEditOpen(false);
      setSelectedTenant(null);
      resetForm();
    } catch {
      // Error handled in hook
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTenant) return;
    
    try {
      await deleteTenant(selectedTenant.id);
      setIsDeleteOpen(false);
      setSelectedTenant(null);
    } catch {
      // Error handled in hook
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  if (isCheckingAdmin || isLoading) {
    return (
      <PageShell
        header={
          <div className="flex items-center justify-between gap-4 py-4">
            <p className="text-muted-foreground">
              Gerenciamento de clientes multi-tenant
            </p>
          </div>
        }
      >
        <ListViewport
          contentClassName="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </ListViewport>
      </PageShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas Super Admins podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <PageShell
      className="space-y-6 p-6"
      header={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2">
          <p className="text-muted-foreground">
            Gerenciamento de clientes multi-tenant
          </p>
        </div>
      }
      controls={
        <div className="flex items-center justify-between gap-4 py-2">
          <Tabs defaultValue="clientes" className="w-full">
            <div className="flex items-center justify-between gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="clientes" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Clientes
                </TabsTrigger>
                <TabsTrigger value="usuarios" className="gap-2">
                  <Users className="h-4 w-4" />
                  Usuários
                </TabsTrigger>
              </TabsList>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </div>

            <TabsContent value="clientes" className="mt-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total de Clientes
                    </CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {tenants.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Ativos
                    </CardTitle>
                    <Power className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {tenants.filter((t) => t.is_active !== false).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Inativos
                    </CardTitle>
                    <PowerOff className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {tenants.filter((t) => t.is_active === false).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Schemas Ativos
                    </CardTitle>
                    <Shield className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {
                        tenants.filter(
                          (t) => (t.migration_version || 0) > 0,
                        ).length
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-4">
                <ListControls
                  state={state}
                  onSearchChange={setSearch}
                  onViewChange={setView}
                  onClearFilters={reset}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <select
                      className="h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={state.filters.status}
                      onChange={(event) =>
                        setFilters({
                          ...state.filters,
                          status: event.target
                            .value as TenantStatusFilter,
                        })
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="active">Ativos</option>
                      <option value="inactive">Inativos</option>
                    </select>
                  </div>
                </ListControls>
              </div>
            </TabsContent>

            <TabsContent value="usuarios" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Usuários por Cliente</CardTitle>
                  <CardDescription>
                    Gerencie os usuários vinculados a cada cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TenantUsersList tenants={tenants} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      }
      footer={
        <UniversalPagination
          page={state.page}
          pageSize={state.pageSize}
          total={totalTenants}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      }
    >
      <ListViewport
        contentClassName={
          state.view === 'grid'
            ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col gap-4'
        }
      >
        {totalTenants === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">
                Nenhum cliente encontrado
              </h3>
              <p className="text-muted-foreground">
                {state.search
                  ? 'Nenhum cliente corresponde à sua busca.'
                  : 'Crie seu primeiro cliente para começar.'}
              </p>
              {!state.search && (
                <Button
                  className="mt-4"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Cliente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          paginatedTenants.map((tenant) => {
            const ov = overview[tenant.id];
            return (
            <Card
              key={tenant.id}
              className={`transition-all ${tenant.is_active === false ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {tenant.name}
                  </CardTitle>
                  <Badge
                    variant={
                      tenant.is_active !== false ? 'default' : 'secondary'
                    }
                  >
                    {tenant.is_active !== false ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground font-mono">
                    {tenant.slug}
                  </p>
                  {ov?.companyCode && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {ov.companyCode}
                    </Badge>
                  )}
                  {ov?.cnpj && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      CNPJ {ov.cnpj}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live counters: real usage / max */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {ov?.usersCount ?? 0}
                      <span className="text-xs text-muted-foreground"> / {tenant.max_users || 50}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Usuários</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {ov?.devicesCount ?? 0}
                      <span className="text-xs text-muted-foreground"> / {tenant.max_devices || 100}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Dispositivos</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <StoreIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {ov?.storesCount ?? 0}
                      <span className="text-xs text-muted-foreground"> / {tenant.max_stores || 500}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Lojas</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Plug2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">{ov?.integrationsCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Integrações</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>
                    Criado:{' '}
                    {tenant.created_at
                      ? format(
                          new Date(tenant.created_at),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR },
                        )
                      : '-'}
                  </p>
                </div>

                {/* Quick actions: company integrations + display config */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    disabled={!ov?.companyId}
                    onClick={() => {
                      if (!ov?.companyId) return;
                      setIntegrationCompany({ id: ov.companyId, name: ov.companyName || tenant.name });
                      setIsIntegrationOpen(true);
                    }}
                  >
                    <Plug2 className="h-4 w-4 mr-1" />
                    Integração
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    disabled={!ov?.companyId}
                    onClick={() => ov?.companyId && navigate(`/admin/companies/${ov.companyId}/display-config`)}
                  >
                    <Palette className="h-4 w-4 mr-1" />
                    Tela
                  </Button>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(tenant)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setIsUsersOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={
                      tenant.is_active !== false ? 'outline' : 'default'
                    }
                    size="sm"
                    onClick={() =>
                      toggleTenantStatus(
                        tenant.id,
                        tenant.is_active === false,
                      )
                    }
                  >
                    {tenant.is_active !== false ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setIsDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </ListViewport>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Crie um novo cliente (tenant) no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Cliente</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData({
                    ...formData,
                    name: newName,
                    slug: generateSlug(newName),
                    company_code: formData.company_code || generateCompanyCode(newName),
                  });
                }}
                placeholder="Ex: Empresa ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (identificador único)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="empresa-abc"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_code">Código da Empresa (3 números + 3 letras)</Label>
              <Input
                id="company_code"
                value={formData.company_code}
                onChange={(e) => setFormData({ ...formData, company_code: formatCompanyCode(e.target.value) })}
                placeholder="123ABC"
                maxLength={6}
                className="font-mono uppercase"
              />
              {formData.company_code && !isValidCompanyCode(formData.company_code) && (
                <p className="text-xs text-destructive">Formato inválido. Use 3 números + 3 letras (ex: 123ABC)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Plano de Licença</Label>
              <Select value={formData.license_plan} onValueChange={(v) => handlePlanChange(v as 'lite' | 'standard' | 'enterprise')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lite">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      LITE — Demonstração / Consulta de Preço
                    </div>
                  </SelectItem>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      STANDARD — Uso completo
                    </div>
                  </SelectItem>
                  <SelectItem value="enterprise">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-500" />
                      ENTERPRISE — Ilimitado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.license_plan === 'lite' && (
                <p className="text-xs text-muted-foreground">
                  Limites: 1 playlist, 3 dispositivos, 5 imagens, 3 lojas, 1 grupo. Sem vídeo. Renova a cada 3 meses.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_users">Max Usuários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_devices">Max Devices</Label>
                <Input
                  id="max_devices"
                  type="number"
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_stores">Max Lojas</Label>
                <Input
                  id="max_stores"
                  type="number"
                  value={formData.max_stores}
                  onChange={(e) => setFormData({ ...formData, max_stores: parseInt(e.target.value) || 500 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || !formData.slug || !isValidCompanyCode(formData.company_code)}>
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Atualize as informações do cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Cliente</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug (não editável)</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                disabled
                className="font-mono bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Plano de Licença</Label>
              <Select value={formData.license_plan} onValueChange={(v) => handlePlanChange(v as 'lite' | 'standard' | 'enterprise')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lite">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      LITE
                    </div>
                  </SelectItem>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      STANDARD
                    </div>
                  </SelectItem>
                  <SelectItem value="enterprise">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-500" />
                      ENTERPRISE
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max_users">Max Usuários</Label>
                <Input
                  id="edit-max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max_devices">Max Devices</Label>
                <Input
                  id="edit-max_devices"
                  type="number"
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max_stores">Max Lojas</Label>
                <Input
                  id="edit-max_stores"
                  type="number"
                  value={formData.max_stores}
                  onChange={(e) => setFormData({ ...formData, max_stores: parseInt(e.target.value) || 500 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedTenant(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{selectedTenant?.name}</strong>?
              Esta ação irá remover permanentemente o schema e todos os dados associados.
              <br /><br />
              <span className="text-destructive font-semibold">Esta ação não pode ser desfeita!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTenant(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Users Dialog */}
      <TenantUsersDialog
        tenant={selectedTenant}
        open={isUsersOpen}
        onOpenChange={(open) => {
          setIsUsersOpen(open);
          if (!open) setSelectedTenant(null);
        }}
      />

      {/* Company Integrations Dialog */}
      <CompanyIntegrationsDialog
        open={isIntegrationOpen}
        onOpenChange={(open) => {
          setIsIntegrationOpen(open);
          if (!open) setIntegrationCompany(null);
        }}
        companyId={integrationCompany?.id ?? null}
        companyName={integrationCompany?.name ?? null}
      />
    </PageShell>
  );
};

export default Tenants;
