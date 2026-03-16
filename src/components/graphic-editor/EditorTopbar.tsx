import { ArrowLeft, LayoutTemplate, Redo2, Save, Undo2, Upload, ZoomIn, ZoomOut, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  projectName: string;
  setProjectName: (n: string) => void;
  zoom: number;
  canvasWidth?: number;
  canvasHeight?: number;
  onBack?: () => void;
  onNewProject?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onSave: () => void;
  onSaveToGallery: () => void;
  onZoom: (d: number) => void;
  onOpenTemplates: () => void;
}

export function EditorTopbar({
  projectName, setProjectName, zoom,
  canvasWidth, canvasHeight,
  onBack,
  onNewProject,
  onUndo, onRedo, onExportPNG, onExportSVG, onSave, onSaveToGallery, onZoom,
  onOpenTemplates,
}: Props) {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 gap-3 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/20 border border-primary/30" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Mupa Editor</div>
            <div className="text-[10px] text-muted-foreground">TV Static Creator</div>
          </div>
        </div>

        {onNewProject && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 ml-2"
            onClick={onNewProject}
          >
            Novo Projeto
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="h-9 max-w-[520px]"
        />
        {typeof canvasWidth === "number" && typeof canvasHeight === "number" && (
          <div className="text-xs text-muted-foreground shrink-0">
            {canvasWidth} × {canvasHeight} px
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onUndo}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRedo}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onZoom(-0.1)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="text-xs text-muted-foreground w-14 text-center tabular-nums">{Math.round(zoom * 100)}%</div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onZoom(0.1)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onExportPNG}
        >
          <FileImage className="h-4 w-4 mr-2" /> Export PNG
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onExportSVG}
        >
          <FileImage className="h-4 w-4 mr-2" /> Export SVG
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onOpenTemplates}
        >
          <LayoutTemplate className="h-4 w-4 mr-2" /> Templates
        </Button>

        <Button
          size="sm"
          className="h-9"
          onClick={onSaveToGallery}
        >
          <Upload className="h-4 w-4 mr-2" /> Salvar no Mupa
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onSave}
            >
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Salvar projeto localmente</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
