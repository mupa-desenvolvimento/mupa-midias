import {
  Monitor,
  BarChart3,
  Image,
  Settings,
  Grid2x2,
  Camera,
  Eye,
  Store,
  MapPin,
  LogOut,
  Tv,
  ListVideo,
  Layers,
  Building2,
  Plug2,
  Palette,
  ShoppingBag,
  Brush,
  Brain,
  QrCode,
  Link,
  ChevronDown } from
"lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserCompany } from "@/hooks/useUserCompany";
import { useTenantLicense } from "@/hooks/useTenantLicense";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import packageJson from "../../../package.json";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarTrigger,
  useSidebar } from
"@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger } from
"@/components/ui/collapsible";

const menuItems = [
{ title: "Dashboard", url: "/admin/dashboard", icon: Grid2x2 },
{ title: "Lojas", url: "/admin/stores", icon: Store },
{ title: "Regiões", url: "/admin/regions", icon: MapPin },
{ title: "Dispositivos", url: "/admin/devices", icon: Monitor },
{ title: "Grupos", url: "/admin/device-groups", icon: Layers },
{ title: "Canais", url: "/admin/channels", icon: Tv },
{ title: "Playlists", url: "/admin/playlists", icon: ListVideo },
{ title: "Galeria", url: "/admin/media", icon: Image },
{ title: "Creator Img", url: "/admin/graphic-editor", icon: Palette },
{ title: "Canva", url: "/admin/canva", icon: Brush },
{ title: "Câmera", url: "/admin/camera", icon: Camera },
{ title: "Monitoramento", url: "/admin/monitoring", icon: Eye },
{ title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
{ title: "Inky Intelligence", url: "/admin/inky", icon: Brain },
{ title: "Configurações", url: "/admin/settings", icon: Settings }];


const autoContentItems = [
{ title: "Clima", url: "/admin/auto-content/weather", icon: Tv },
{ title: "Notícias", url: "/admin/auto-content/news", icon: BarChart3 },
{ title: "Frases Motivacionais", url: "/admin/auto-content/quote", icon: Brain },
{ title: "Curiosidades", url: "/admin/auto-content/curiosity", icon: Layers },
{ title: "Aniversariantes", url: "/admin/auto-content/birthday", icon: ShoppingBag },
{ title: "Nutrição", url: "/admin/auto-content/nutrition", icon: Store },
{ title: "Instagram", url: "/admin/auto-content/instagram", icon: Camera },
{ title: "QR Code Campanhas", url: "/admin/qrcode-campaigns", icon: QrCode }];


const superAdminItems = [
{ title: "Clientes", url: "/admin/tenants", icon: Building2 },
{ title: "Empresas", url: "/admin/companies", icon: Plug2 },
{ title: "Integrações", url: "/admin/integrations", icon: Link },
{ title: "Price API Integrations", url: "/admin/api-integrations", icon: Link },
{ title: "Logs", url: "/admin/logs", icon: Eye }];


const SidebarNavItem = ({ item }: {item: typeof menuItems[number];}) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  // "Creator Img" opens in a new tab
  if (item.url === "/admin/graphic-editor") {
    const link =
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground`}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </a>;

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  const link =
  <NavLink
    to={item.url}
    className={({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
    isActive ?
    "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm" :
    "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`

    }>
    
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>;


  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>);

  }

  return link;
};

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { company } = useUserCompany();
  const { isLite, isExpired, isMenuItemAllowed, isSectionAllowed } = useTenantLicense();
  const { resolvedTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "U";

  const isAutoContentActive = location.pathname.startsWith("/admin/auto-content");
  const isSuperAdminActive = superAdminItems.some((i) => location.pathname.startsWith(i.url));

  const filteredMenuItems = menuItems.filter((item) => isMenuItemAllowed(item.url));

  // If license is expired, show a blocked overlay
  if (isExpired) {
    return (
      <Sidebar className="border-r border-sidebar-border/50" collapsible="icon">
        <SidebarContent className="flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-destructive">Licença expirada</p>
            <p className="text-xs text-muted-foreground">Entre em contato para renovar seu plano.</p>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className="border-r border-sidebar-border/50" collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="gap-2 flex items-center justify-center">
          <SidebarTrigger className="h-8 w-8 shrink-0" />
          <img
            src={resolvedTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="MupaMídias"
            className="h-8 group-data-[collapsible=icon]:hidden transition-opacity duration-200" />
          
        </div>
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar px-2">
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-3 mb-1">
            Gerenciamento
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {filteredMenuItems.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="p-0">
                    <SidebarNavItem item={item} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Auto Content — collapsible */}
        {isSectionAllowed('auto_content') &&
        <SidebarGroup>
          <Collapsible defaultOpen={isAutoContentActive}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-3 mb-1 flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/60 transition-colors">
                Conteúdo Automático
                {!collapsed && <ChevronDown className="w-3 h-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {autoContentItems.map((item) =>
                  <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="p-0">
                        <SidebarNavItem item={item} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        }

        {/* Company settings */}
        {company &&
        <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-3 mb-1">
              Empresa
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {!isLite &&
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="p-0">
                    <SidebarNavItem item={{ title: "Tela de Consulta", url: `/admin/companies/${company.id}/display-config`, icon: Palette }} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
                }
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="p-0">
                    <SidebarNavItem item={{ title: "Consultas de Produtos", url: "/admin/product-analytics", icon: ShoppingBag }} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        }

        {/* Super Admin */}
        {isSuperAdmin &&
        <SidebarGroup>
            <Collapsible defaultOpen={isSuperAdminActive}>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 px-3 mb-1 flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/60 transition-colors">
                  Super Admin
                  {!collapsed && <ChevronDown className="w-3 h-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {superAdminItems.map((item) =>
                  <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className="p-0">
                          <SidebarNavItem item={item} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                  )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        }
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/30">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed &&
          <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50">
                v{packageJson.version}
              </p>
            </div>
          }
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                aria-label="Sair">
                
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>);

};

export default AppSidebar;