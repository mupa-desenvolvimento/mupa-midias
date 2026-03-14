import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useFabricCanvas } from "@/components/graphic-editor/useFabricCanvas";
import { EditorTopbar } from "@/components/graphic-editor/EditorTopbar";
import { EditorSidebar } from "@/components/graphic-editor/EditorSidebar";
import { EditorProperties } from "@/components/graphic-editor/EditorProperties";
import { SaveToFolderDialog } from "@/components/graphic-editor/SaveToFolderDialog";
import { useMediaItems } from "@/hooks/useMediaItems";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function GraphicEditor() {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const {
    initCanvas, canvasElRef,
    selectedObject, projectName, setProjectName, zoom,
    showGrid, toggleGrid, canvasBgColor, changeCanvasBg,
    canvasWidth, canvasHeight, resizeCanvas,
    addText, addRect, addCircle, addLine, addTriangle, addStar, addPolygon,
    addImage, addImageFromUrl,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom,
    getCanvasDataUrl,
  } = useFabricCanvas();

  const { mediaItems, isLoading: galleryLoading } = useMediaItems(undefined);

  useEffect(() => {
    const el = canvasElRef.current;
    if (el) initCanvas(el);
  }, []);

  // Wheel zoom
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.05 : 0.05);
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, [handleZoom]);

  const handleSaveToGallery = useCallback(async (folderId: string | null, fileName: string) => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) throw new Error("Falha ao capturar canvas");

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `${fileName}.png`, { type: "image/png" });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", fileName);
    formData.append("type", "image");
    if (folderId) formData.append("folder_id", folderId);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || "Erro ao salvar");
    }

    saveProject();
    toast.success("Imagem salva na galeria!");
  }, [getCanvasDataUrl, saveProject]);

  const galleryItems = mediaItems.map((m) => ({
    id: m.id,
    name: m.name,
    file_url: m.file_url,
    thumbnail_url: m.thumbnail_url,
    type: m.type,
  }));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Topbar */}
      <div className="flex items-center">
        <Button
          variant="ghost" size="icon"
          className="h-14 w-12 rounded-none border-r border-border shrink-0"
          onClick={() => navigate("/admin/canva")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <EditorTopbar
            projectName={projectName}
            setProjectName={setProjectName}
            zoom={zoom}
            onUndo={undo}
            onRedo={redo}
            onExportPNG={exportPNG}
            onExportSVG={exportSVG}
            onSave={() => { saveProject(); toast.success("Projeto salvo localmente!"); }}
            onSaveToGallery={() => setShowSaveDialog(true)}
            onZoom={handleZoom}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <EditorSidebar
          onAddText={addText}
          onAddRect={addRect}
          onAddCircle={addCircle}
          onAddLine={addLine}
          onAddTriangle={addTriangle}
          onAddStar={addStar}
          onAddPolygon={addPolygon}
          onAddImage={addImage}
          onAddImageFromUrl={addImageFromUrl}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onToggleGrid={toggleGrid}
          hasSelection={!!selectedObject}
          showGrid={showGrid}
          galleryItems={galleryItems}
          galleryLoading={galleryLoading}
        />

        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8 relative"
        >
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          )}
          <div className="shadow-lg rounded-lg border border-border" style={{ backgroundColor: canvasBgColor }}>
            <canvas ref={canvasElRef} />
          </div>
        </div>

        {/* Right sidebar */}
        <EditorProperties
          selected={selectedObject}
          onUpdate={updateObjectProp}
          canvasBgColor={canvasBgColor}
          onCanvasBgChange={changeCanvasBg}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onCanvasResize={resizeCanvas}
        />
      </div>

      {/* Save to folder dialog */}
      <SaveToFolderDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        projectName={projectName}
        onSave={handleSaveToGallery}
      />
    </div>
  );
}
