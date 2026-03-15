import { Undo2, Redo2, Download, FileImage, Save, ZoomIn, ZoomOut, Upload, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  projectName: string;
  setProjectName: (n: string) => void;
  zoom: number;
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
  onUndo, onRedo, onExportPNG, onExportSVG, onSave, onSaveToGallery, onZoom,
  onOpenTemplates,
}: Props) {
  return (
    <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <Input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="w-48 h-8 text-sm font-medium bg-muted/50 border-none focus-visible:ring-1"
      />

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo}><Undo2 className="h-4 w-4" /></Button>
        </TooltipTrigger><TooltipContent>Desfazer (Ctrl+Z)</TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo}><Redo2 className="h-4 w-4" /></Button>
        </TooltipTrigger><TooltipContent>Refazer (Ctrl+Y)</TooltipContent></Tooltip>
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onZoom(-0.1)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onZoom(0.1)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenTemplates}>
          <LayoutTemplate className="h-3.5 w-3.5" /> Templates
        </Button>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPNG}>
              <FileImage className="h-4 w-4 mr-2" /> Exportar PNG (alta qualidade)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportSVG}>
              <FileImage className="h-4 w-4 mr-2" /> Exportar SVG (vetorial)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save locally */}
        <Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onSave}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </TooltipTrigger><TooltipContent>Salvar projeto localmente</TooltipContent></Tooltip>

        {/* Save to gallery */}
        <Button size="sm" className="h-8 gap-1.5" onClick={onSaveToGallery}>
          <Upload className="h-3.5 w-3.5" /> Salvar na Galeria
        </Button>
      </div>
    </div>
  );
}
