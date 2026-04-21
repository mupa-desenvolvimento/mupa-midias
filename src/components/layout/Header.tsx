import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case "/admin/dashboard": return "Dashboard";
      case "/admin/devices": return "Dispositivos";
      case "/admin/device-groups": return "Grupos de Dispositivos";
      case "/admin/groups": return "Grupos";
      case "/admin/stores": return "Lojas";
      case "/admin/regions": return "Estrutura da Rede";
      case "/admin/channels": return "Campanhas";
      case "/admin/playlists": return "Playlists";
      case "/admin/media": return "Galeria";
      case "/admin/analytics": return "Analytics";
      case "/admin/settings": return "Configurações";
      case "/admin/tenants": return "Tenants";
      case "/admin/monitoring": return "DemoFace";
      default:
        if (path.startsWith("/admin/api-integrations")) return "Mapeamento de Preços";
        if (path.startsWith("/admin/auto-content/")) return "Conteúdo Automático";
        if (path.includes("/playlists/") && path.includes("/edit")) return "Editor de Playlist";
        return "Painel Administrativo";
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-3">
        <SidebarTrigger className="h-8 w-8 shrink-0" />
        
        <Separator orientation="vertical" className="h-5 hidden md:block" />

        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="text-muted-foreground hover:text-foreground cursor-pointer text-sm"
                onClick={() => navigate("/admin/dashboard")}
              >
                MUPA
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium">
                {getPageTitle()}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Mobile title */}
        <h1 className="text-base font-semibold md:hidden truncate">
          {getPageTitle()}
        </h1>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/admin/settings")}
            aria-label="Configurações"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
