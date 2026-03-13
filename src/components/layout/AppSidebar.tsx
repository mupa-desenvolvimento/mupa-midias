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
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserCompany } from "@/hooks/useUserCompany";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: Grid2x2 },
  { title: "Lojas", url: "/admin/stores", icon: Store },
  { title: "Regiões", url: "/admin/regions", icon: MapPin },
  { title: "Dispositivos", url: "/admin/devices", icon: Monitor },
  { title: "Grupos", url: "/admin/device-groups", icon: Layers },
  { title: "Canais", url: "/admin/channels", icon: Tv },
  { title: "Playlists", url: "/admin/playlists", icon: ListVideo },
  { title: "Galeria", url: "/admin/media", icon: Image },
  { title: "Canva", url: "/admin/canva", icon: Brush },
  { title: "Câmera", url: "/admin/camera", icon: Camera },
  { title: "Monitoramento", url: "/admin/monitoring", icon: Eye },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Inky Intelligence", url: "/admin/inky", icon: Brain },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

const autoContentItems = [
  { title: "Clima", url: "/admin/auto-content/weather", icon: Tv },
  { title: "Notícias", url: "/admin/auto-content/news", icon: BarChart3 },
  { title: "Frases Motivacionais", url: "/admin/auto-content/quote", icon: Brain },
  { title: "Curiosidades", url: "/admin/auto-content/curiosity", icon: Layers },
  { title: "Aniversariantes", url: "/admin/auto-content/birthday", icon: ShoppingBag },
  { title: "Nutrição", url: "/admin/auto-content/nutrition", icon: Store },
  { title: "Instagram", url: "/admin/auto-content/instagram", icon: Camera },
  { title: "QR Code Campanhas", url: "/admin/auto-content/qr_campaign", icon: QrCode },
];

const superAdminItems = [
  { title: "Clientes", url: "/admin/tenants", icon: Building2 },
  { title: "Empresas", url: "/admin/companies", icon: Plug2 },
  { title: "Integrações", url: "/admin/integrations", icon: Link },
  { title: "Price API Integrations", url: "/admin/api-integrations", icon: Link },
];

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { company } = useUserCompany();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-9 w-9" />
          <img 
            src={resolvedTheme === "dark" ? "/Artboard%2017.svg" : "/Artboard%203.svg"} 
            alt="MupaMídias" 
            className="h-10 scale-[1.3] group-data-[collapsible=icon]:hidden" 
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 py-2">
            GERENCIAMENTO
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 py-2">
            CONTEÚDO AUTOMÁTICO
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {autoContentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tenant Admin Section - Display Config */}
        {company && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 py-2">
              CONFIGURAÇÕES DA EMPRESA
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/admin/companies/${company.id}/display-config`}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <Palette className="w-4 h-4" />
                      <span className="font-medium">Tela de Consulta</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/product-analytics"
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span className="font-medium">Consultas de Produtos</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Super Admin Section */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 py-2">
              SUPER ADMIN
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm truncate">
            <p className="font-medium truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-center text-muted-foreground">
          v{packageJson.version}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
