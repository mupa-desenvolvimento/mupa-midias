import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useFabricCanvas } from "@/components/graphic-editor/useFabricCanvas";
import { EditorTopbar } from "@/components/graphic-editor/EditorTopbar";
import { EditorSidebar } from "@/components/graphic-editor/EditorSidebar";
import { EditorProperties } from "@/components/graphic-editor/EditorProperties";

export default function GraphicEditor() {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const {
    initCanvas, canvasElRef,
    selectedObject, projectName, setProjectName, zoom,
    addText, addRect, addCircle, addLine, addTriangle,
    addImage, addImageFromUrl,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom,
  } = useFabricCanvas();

  useEffect(() => {
    const el = canvasElRef.current;
    if (el) initCanvas(el);
  }, []);

  // Wheel zoom on canvas container
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
            onSave={saveProject}
            onZoom={handleZoom}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - tools */}
        <EditorSidebar
          onAddText={addText}
          onAddRect={addRect}
          onAddCircle={addCircle}
          onAddLine={addLine}
          onAddTriangle={addTriangle}
          onAddImage={addImage}
          onAddImageFromUrl={addImageFromUrl}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          hasSelection={!!selectedObject}
        />

        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8"
        >
          <div className="shadow-lg rounded-lg border border-border bg-white">
            <canvas ref={canvasElRef} />
          </div>
        </div>

        {/* Right sidebar - properties */}
        <EditorProperties
          selected={selectedObject}
          onUpdate={updateObjectProp}
        />
      </div>
    </div>
  );
}
