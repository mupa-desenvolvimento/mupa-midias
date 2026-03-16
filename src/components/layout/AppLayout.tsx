import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import { AIAssistant } from "@/components/ai/AIAssistant";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <>
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <Header />
        <div className="flex-1 min-h-0 overflow-auto p-3 md:p-4 lg:p-6 custom-scrollbar">
          {children}
        </div>
        <AIAssistant />
      </main>
    </>
  );
};

export default AppLayout;
