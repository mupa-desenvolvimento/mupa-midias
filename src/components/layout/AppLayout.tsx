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
            app-content-area: scrolls naturally for free-form pages (Dashboard, Settings, forms).
            When the page renders <PageShell fixedLayout/> (which sets data-fixed-layout="true"),
            the CSS rule in index.css switches this wrapper to overflow-hidden so the inner table
            can scroll on its own and the pagination footer stays pinned to the viewport.
          */}
          <div
            className="app-content-area flex-1 min-h-0 flex flex-col px-3 md:px-4 lg:px-6 pb-3 md:pb-4 lg:pb-6 pt-0 overflow-y-auto custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch', marginTop: '-22px' }}
          >
            {children}
          </div>
        </div>
        {!isLite && <AIAssistant />}
      </main>
    </>
  );
};

export default AppLayout;
