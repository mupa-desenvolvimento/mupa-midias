import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { LitePlanBanner } from "./LitePlanBanner";
import { useTenantLicense } from "@/hooks/useTenantLicense";
import { useDeviceStatusNotifier } from "@/hooks/useDeviceStatusNotifier";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { isLite } = useTenantLicense();
  // Real-time toast notifications when any device changes status
  useDeviceStatusNotifier();
  const location = useLocation();
  const isPlaylistEditor = location.pathname.includes("/playlists/") && location.pathname.includes("/edit") || location.pathname.includes("/playlists/new");

  return (
    <>
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 h-screen">
        <Header />
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-3 md:p-4 lg:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!isPlaylistEditor && <LitePlanBanner />}
          <div className="flex-1 flex flex-col">
            {children}
          </div>
        </div>
        {!isLite && <AIAssistant />}
      </main>
    </>
  );
};

export default AppLayout;
