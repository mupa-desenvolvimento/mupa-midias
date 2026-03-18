import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { LitePlanBanner } from "./LitePlanBanner";
import { useTenantLicense } from "@/hooks/useTenantLicense";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { isLite } = useTenantLicense();
  const location = useLocation();
  const isPlaylistEditor = location.pathname.includes("/playlists/") && location.pathname.includes("/edit") || location.pathname.includes("/playlists/new");

  return (
    <>
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <Header />
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4 lg:p-6 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!isPlaylistEditor && <LitePlanBanner />}
          {children}
        </div>
        {!isLite && <AIAssistant />}
      </main>
    </>
  );
};

export default AppLayout;
