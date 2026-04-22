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
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {!isPlaylistEditor && (
            <div className="shrink-0 px-3 md:px-4 lg:px-6 pt-3 md:pt-4 lg:pt-6">
              <LitePlanBanner />
            </div>
          )}
          {/*
            Conditional scroll: when the page uses PageShell with fixedLayout (data-fixed-layout),
            the parent stays overflow-hidden so the table scrolls internally and the footer pins.
            Otherwise (Dashboard, forms, settings...), enable natural page scroll.
          */}
          <div className="flex-1 min-h-0 flex flex-col p-3 md:p-4 lg:p-6 overflow-y-auto custom-scrollbar has-[[data-fixed-layout=true]]:overflow-hidden has-[[data-fixed-layout=true]]:p-0 has-[[data-fixed-layout=true]]:px-3 md:has-[[data-fixed-layout=true]]:px-4 lg:has-[[data-fixed-layout=true]]:px-6 has-[[data-fixed-layout=true]]:pt-3 md:has-[[data-fixed-layout=true]]:pt-4 lg:has-[[data-fixed-layout=true]]:pt-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </div>
        {!isLite && <AIAssistant />}
      </main>
    </>
  );
};

export default AppLayout;
