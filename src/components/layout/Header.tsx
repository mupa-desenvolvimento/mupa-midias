import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case "/admin/dashboard":
        return "Dashboard";
      case "/admin/devices":
        return "Dispositivos";
      case "/admin/device-groups":
        return "Grupos de Dispositivos";
      case "/admin/stores":
        return "Lojas";
      case "/admin/regions":
        return "Regiões";
      case "/admin/channels":
        return "Canais";
      case "/admin/playlists":
        return "Playlists";
      case "/admin/media":
        return "Galeria";
      case "/admin/analytics":
        return "Analytics";
      case "/admin/settings":
        return "Configurações";
      case "/admin/tenants":
        return "Tenants";
      case "/admin/monitoring":
        return "Monitoramento";
      default:
        if (path.startsWith("/admin/auto-content/")) {
          return "Conteúdo Automático";
        }
        if (path.includes("/playlists/") && path.includes("/edit")) {
          return "Editor de Playlist";
        }
        return "Painel Administrativo";
    }
  };

  return (
    <header className="border-b border-sidebar-border bg-sidebar/95 backdrop-blur-md">
      <div className="flex h-16 items-center px-6 gap-4">
        <SidebarTrigger className="lg:hidden" />

        <div className="flex-1">
          <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
