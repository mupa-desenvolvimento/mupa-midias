import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/hooks/useTheme";
import AppLayout from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Media from "./pages/Media";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Index from "./pages/Index";
import DevicePlayer from "./pages/DevicePlayer";
import DeviceSetup from "./pages/DeviceSetup";
import DeviceDetector from "./pages/DeviceDetector";
import OfflinePlayer from "./pages/OfflinePlayer";
import WebViewPlayer from "./pages/WebViewPlayer";
import Camera from "./pages/Camera";
import CameraFullscreen from "./pages/CameraFullscreen";
import LiveMonitoring from "./pages/LiveMonitoring";
import DeviceDemo from "./pages/DeviceDemo";
import MobileDemo from "./pages/MobileDemo";
import Auth from "./pages/Auth";
import CanvaCallback from "./pages/admin/CanvaCallback";
import Stores from "./pages/admin/Stores";
import { NewsModule } from "./pages/admin/news/NewsModule";
import StoresMap from "./pages/admin/StoresMap";
import Regions from "./pages/admin/Regions";
import Channels from "./pages/admin/Channels";
import RetailMedia from "./pages/RetailMedia";
import Playlists from "./pages/admin/Playlists";
import PlaylistEditorPage from "./pages/admin/PlaylistEditor";
import DeviceGroups from "./pages/admin/DeviceGroups";
import Tenants from "./pages/admin/Tenants";
import Companies from "./pages/admin/Companies";
import ProductDisplayConfig from "./pages/admin/ProductDisplayConfig";
import ProductAnalytics from "./pages/admin/ProductAnalytics";
import CanvaIntegration from "./pages/admin/CanvaIntegration";
import CanvaEditor from "./pages/admin/CanvaEditor";
import GraphicEditor from "./pages/admin/GraphicEditor";
import InkyIntelligence from "./pages/admin/InkyIntelligence";
import PriceCheckIntegrationsList from "./pages/admin/integrations/PriceCheckIntegrationsList";
import PriceCheckIntegrationForm from "./pages/admin/integrations/PriceCheckIntegrationForm";
import PriceCheckIntegrationLogs from "./pages/admin/integrations/PriceCheckIntegrationLogs";
import ApiIntegrationsList from "./pages/admin/api-integrations/ApiIntegrationsList";
import ApiIntegrationForm from "./pages/admin/api-integrations/ApiIntegrationForm";
import ExampleListPage from "./pages/ExampleListPage";
import AutoContentModulePage from "./pages/admin/AutoContentModulePage";
import Install from "./pages/Install";
 import Presentation from "./pages/Presentation";
import AssaiPresentation from "./pages/AssaiPresentation";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAUpdatePrompt, InstallPrompt } from "./components/PWAPrompts";
import { useSyncManager } from "./hooks/useSyncManager";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: (failureCount, error) => {
        const message = (error as Error)?.message ?? "";
        // Don't retry auth errors, not found, or forbidden
        if (
          message.includes("401") ||
          message.includes("403") ||
          message.includes("404") ||
          message.includes("JWT") ||
          message.includes("Não autenticado")
        ) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});

const NativeRouteHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const path = location.pathname;
    const storedCode = localStorage.getItem("mupa_device_code");
    const fallbackCode = storedCode || "UWYJKTVA";

    if (path.startsWith("/play/") || path.startsWith("/setup/")) return;

    if (!storedCode) {
      navigate("/setup/new", { replace: true });
      return;
    }

    navigate(`/play/${fallbackCode}`, { replace: true });
  }, [navigate, location.pathname]);

  return null;
};

function AppContent() {
  // Initialize sync manager at app level
  useSyncManager();

  return (
    <>
      <PWAUpdatePrompt />
      <InstallPrompt />
      <OfflineIndicator />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NativeRouteHandler />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/device/:deviceId" element={<DevicePlayer />} />
          <Route path="/setup/:deviceId" element={<DeviceSetup />} />
          <Route path="/detect/:deviceCode" element={<DeviceDetector />} />
          <Route path="/retail-media" element={<RetailMedia />} />
          <Route path="/play/:deviceCode" element={<OfflinePlayer />} />
          <Route path="/webview/:deviceCode" element={<WebViewPlayer />} />
          {/* Rota específica para Android/Kodular usando query param ?device_id=XYZ */}
          <Route path="/android-player" element={<WebViewPlayer />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/camera-fullscreen" element={<CameraFullscreen />} />
          <Route path="/demo" element={<DeviceDemo />} />
           <Route path="/apresentacao" element={<Presentation />} />
          <Route path="/apresentacao-assai" element={<AssaiPresentation />} />
          <Route path="/mobile-demo" element={<MobileDemo />} />
          {/* Canva OAuth callback - must be outside ProtectedRoute to handle redirect properly */}
          <Route path="/admin/canva/callback" element={<CanvaCallback />} />
          
          {/* Fullscreen Map Route - No Layout/Sidebar */}
          <Route
            path="/admin/stores/map"
            element={
              <ProtectedRoute>
                <StoresMap />
              </ProtectedRoute>
            }
          />

          {/* Fullscreen Graphic Editor - No Layout/Sidebar */}
          <Route
            path="/admin/graphic-editor"
            element={
              <ProtectedRoute>
                <GraphicEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="min-h-screen flex w-full bg-transparent">
                    <AppLayout>
                      <Routes>
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="devices" element={<Devices />} />
                        <Route path="device-groups" element={<DeviceGroups />} />
                        <Route path="stores" element={<Stores />} />
                        <Route path="regions" element={<Regions />} />
                        <Route path="channels" element={<Channels />} />
                        <Route path="playlists" element={<Playlists />} />
                        <Route path="playlists/:id/edit" element={<PlaylistEditorPage />} />
                        <Route path="playlists/new" element={<PlaylistEditorPage />} />
                        <Route path="media" element={<Media />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="auto-content/news" element={<NewsModule />} />
                        <Route path="auto-content/:moduleType" element={<AutoContentModulePage />} />
                        <Route path="camera" element={<Camera />} />
                        <Route path="monitoring" element={<LiveMonitoring />} />
                        <Route path="tenants" element={<Tenants />} />
                        <Route path="companies" element={<Companies />} />
                        <Route path="companies/:companyId/display-config" element={<ProductDisplayConfig />} />
                        <Route path="product-analytics" element={<ProductAnalytics />} />
                        <Route path="canva" element={<CanvaIntegration />} />
                        <Route path="integrations/canva/editor" element={<CanvaEditor />} />
                        
                        <Route path="integrations" element={<PriceCheckIntegrationsList />} />
                        <Route path="integrations/new" element={<PriceCheckIntegrationForm />} />
                        <Route path="integrations/:id/edit" element={<PriceCheckIntegrationForm />} />
                        <Route path="integrations/:id/logs" element={<PriceCheckIntegrationLogs />} />
                        <Route path="api-integrations" element={<ApiIntegrationsList />} />
                        <Route path="api-integrations/new" element={<ApiIntegrationForm />} />
                        <Route path="api-integrations/:id/edit" element={<ApiIntegrationForm />} />
                        <Route path="inky" element={<InkyIntelligence />} />
                        <Route path="list-example" element={<ExampleListPage />} />
                      </Routes>
                    </AppLayout>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
