import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  RefreshCw, 
  Monitor,
  Undo2,
  Redo2,
  Download,
  MoreHorizontal,
  Check,
  Circle,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface EditorHeaderProps {
  projectName: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isUpdatingDevices: boolean;
  connectedDevicesCount: number;
  onBack: () => void;
  onSave: () => void;
  onUpdateDevices: () => void;
}

export const EditorHeader = ({
  projectName,
  hasUnsavedChanges,
  isSaving,
  isUpdatingDevices,
  connectedDevicesCount,
  onBack,
  onSave,
  onUpdateDevices,
}: EditorHeaderProps) => {
  const navigate = useNavigate();
  const { id: playlistId } = useParams<{ id: string }>();

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-muted/50 border-b border-border">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-9 w-9"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium truncate max-w-[200px]">
            {projectName}
          </h1>
          <div className="flex items-center gap-1.5 text-xs">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-amber-500">
                <Circle className="w-2 h-2 fill-current" />
                Editando
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500">
                <Check className="w-3 h-3" />
                Salvo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center Section - Quick Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled
        >
          <Redo2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Smart Timeline Mode Toggle */}
        {playlistId && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
            onClick={() => navigate(`/admin/playlists/${playlistId}/smart-timeline`)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Modo Timeline Inteligente</span>
            <span className="md:hidden">Timeline IA</span>
          </Button>
        )}

        {/* Connected Devices */}
        {connectedDevicesCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={onUpdateDevices}
            disabled={isUpdatingDevices}
          >
            {isUpdatingDevices ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <Monitor className="w-4 h-4" />
            <span className="text-xs">{connectedDevicesCount}</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onUpdateDevices}
              disabled={connectedDevicesCount === 0}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Dispositivos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          size="sm"
          className={cn(
            "h-8 gap-2 transition-all min-w-[140px]",
            hasUnsavedChanges 
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm" 
              : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-70"
          )}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasUnsavedChanges ? (
            <Save className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isSaving ? "Salvando..." : hasUnsavedChanges ? "Salvar alterações" : "Salvo"}
        </Button>
      </div>
    </header>
  );
};
