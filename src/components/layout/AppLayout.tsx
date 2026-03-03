import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import { AIAssistant } from "@/components/ai/AIAssistant";

interface AppLayoutProps {
  children: ReactNode;
}
const AppLayout = ({
  children
}: AppLayoutProps) => {
  return <>
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <div className="flex-1 min-h-0 overflow-hidden px-2.5 py-2.5">
          {children}
        </div>
        <AIAssistant />
      </main>
    </>;
};
export default AppLayout;