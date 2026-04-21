import { useState, useRef, useCallback } from "react";
import { PlaylistChannel, PlaylistChannelInsert } from "@/hooks/usePlaylistChannels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Clock, 
  Tv, 
  GripVertical, 
  Edit, 
  Trash2, 
  Play, 
  ChevronRight,
  ChevronDown,
  Radio,
  Shield,
  Film,
  Calendar
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom", short: "D" },
  { value: 1, label: "Seg", short: "S" },
  { value: 2, label: "Ter", short: "T" },
  { value: 3, label: "Qua", short: "Q" },
  { value: 4, label: "Qui", short: "Q" },
  { value: 5, label: "Sex", short: "S" },
  { value: 6, label: "Sáb", short: "S" },
];

interface ChannelFormData {
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  is_fallback: boolean;
  is_active: boolean;
}

interface ChannelsListProps {
  channels: PlaylistChannel[];
  activeChannelId: string | null;
  onSelectChannel: (channel: PlaylistChannel) => void;
  onCreateChannel: (data: PlaylistChannelInsert) => void;
  onUpdateChannel: (id: string, data: Partial<PlaylistChannelInsert>) => void;
  onDeleteChannel: (id: string) => void;
  onReorderChannels?: (orderedChannels: { id: string; position: number }[]) => void;
  playlistId: string;
  playlistName: string;
}

export const ChannelsList = ({
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onReorderChannels,
  playlistId,
  playlistName,
}: ChannelsListProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PlaylistChannel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  // Drag and drop state
  const [draggedChannel, setDraggedChannel] = useState<PlaylistChannel | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  
  const [formData, setFormData] = useState<ChannelFormData>({
    name: "",
    description: null,
    start_time: "00:00",
    end_time: "23:59",
    start_date: null,
    end_date: null,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_fallback: false,
    is_active: true,
  });
  
  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, channel: PlaylistChannel, index: number) => {
    setDraggedChannel(channel);
    dragNodeRef.current = e.target as HTMLDivElement;
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", channel.id);
    }
    
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.5";
      }
    }, 0);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    setDraggedChannel(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (draggedChannel && dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedChannel, dragOverIndex]);
  
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedChannel || !onReorderChannels) {
      handleDragEnd();
      return;
    }
    
    const dragIndex = channels.findIndex(c => c.id === draggedChannel.id);
    
    if (dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }
    
    const newChannels = [...channels];
    const [removed] = newChannels.splice(dragIndex, 1);
    newChannels.splice(dropIndex, 0, removed);
    
    const orderedChannels = newChannels.map((channel, index) => ({
      id: channel.id,
      position: index,
    }));
    
    onReorderChannels(orderedChannels);
    handleDragEnd();
  }, [draggedChannel, channels, onReorderChannels, handleDragEnd]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: null,
      start_time: "00:00",
      end_time: "23:59",
      start_date: null,
      end_date: null,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      is_fallback: false,
      is_active: true,
    });
  };

  const openNewDialog = () => {
    resetForm();
    setEditingChannel(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (channel: PlaylistChannel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      description: channel.description,
      start_time: channel.start_time.slice(0, 5),
      end_time: channel.end_time.slice(0, 5),
      start_date: channel.start_date,
      end_date: channel.end_date,
      days_of_week: channel.days_of_week,
      is_fallback: channel.is_fallback,
      is_active: channel.is_active,
    });
    setIsDialogOpen(true);
  };

  const validateDates = (): string | null => {
    if (formData.is_fallback) return null;
    
    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        return "A data de término não pode ser anterior à data de início";
      }
    }
    
    return null;
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    
    const dateError = validateDates();
    if (dateError) {
      return;
    }
    
    if (editingChannel) {
      onUpdateChannel(editingChannel.id, {
        name: formData.name,
        description: formData.description,
        start_time: formData.start_time,
        end_time: formData.end_time,
        start_date: formData.start_date,
        end_date: formData.is_fallback ? null : formData.end_date,
        days_of_week: formData.days_of_week,
        is_fallback: formData.is_fallback,
        is_active: formData.is_active,
      });
    } else {
      onCreateChannel({
        playlist_id: playlistId,
        name: formData.name,
        description: formData.description,
        start_time: formData.start_time,
        end_time: formData.end_time,
        start_date: formData.start_date,
        end_date: formData.is_fallback ? null : formData.end_date,
        days_of_week: formData.days_of_week,
        is_fallback: formData.is_fallback,
        is_active: formData.is_active,
        position: channels.length,
      });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const dateValidationError = validateDates();

  const toggleDayOfWeek = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const isChannelActive = (channel: PlaylistChannel) => {
    if (!channel.is_active) return false;
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    
    if (!channel.days_of_week.includes(currentDay)) return false;
    
    const startTime = channel.start_time.slice(0, 5);
    const endTime = channel.end_time.slice(0, 5);
    
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  const getChannelStatus = (channel: PlaylistChannel) => {
    if (!channel.is_active) return { type: "inactive", label: "Inativo", color: "bg-muted text-muted-foreground" };
    if (channel.is_fallback) return { type: "fallback", label: "Fallback", color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/50" };
    if (isChannelActive(channel)) return { type: "live", label: "Ao Vivo", color: "bg-green-500/20 text-green-600 border-green-500/50" };
    return { type: "scheduled", label: "Programado", color: "bg-blue-500/20 text-blue-600 border-blue-500/50" };
  };

  const getStatusIcon = (channel: PlaylistChannel) => {
    const status = getChannelStatus(channel);
    switch (status.type) {
      case "live":
        return <Play className="w-4 h-4 text-green-500" />;
      case "fallback":
        return <Shield className="w-4 h-4 text-yellow-500" />;
      case "scheduled":
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDaysLabel = (days: number[]) => {
    if (days.length === 7) return "Todos os dias";
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Seg–Sex";
    if (days.length === 2 && days.includes(0) && days.includes(6)) return "Fim de semana";
    return days.map(d => DAYS_OF_WEEK[d].label).join(", ");
  };

  const formatDateRange = (startDate: string | null, endDate: string | null, isFallback: boolean) => {
    if (!startDate && !endDate) return null;
    
    const formatDate = (date: string) => {
      const [year, month, day] = date.split('-');
      return `${day}/${month}`;
    };
    
    if (startDate && endDate && !isFallback) {
      return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    }
    if (startDate) {
      return isFallback ? `A partir de ${formatDate(startDate)}` : `Início: ${formatDate(startDate)}`;
    }
    if (endDate && !isFallback) {
      return `Até ${formatDate(endDate)}`;
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Campanhas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {channels.length} {channels.length === 1 ? "campanha" : "campanhas"}
          </p>
        </div>
        <Button onClick={openNewDialog} size="sm" variant="outline">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-muted/30 border-b flex gap-3 text-[10px] text-muted-foreground overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Ao Vivo</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Programado</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Fallback</span>
        </div>
      </div>

      {/* Channels List - Scrollable */}
      <ScrollArea className="flex-1 min-h-0" showScrollbar="always">
        <div className="p-4 space-y-4">
          {channels.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <Tv className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhuma campanha criada
                </p>
                <Button onClick={openNewDialog} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Campanha
                </Button>
              </CardContent>
            </Card>
          ) : channels.map((channel, index) => {
              const status = getChannelStatus(channel);
              const isLive = status.type === "live";
            
              return (
              <div 
                key={channel.id}
                draggable
                onDragStart={(e) => handleDragStart(e, channel, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  "p-3 rounded-lg border transition-all group cursor-pointer flex items-center gap-3",
                  "hover:bg-accent hover:border-accent-foreground/20",
                  activeChannelId === channel.id 
                    ? "bg-primary/5 border-primary" 
                    : "bg-card border-border",
                  draggedChannel?.id === channel.id && "opacity-50",
                  dragOverIndex === index && draggedChannel?.id !== channel.id && "border-primary border-dashed border-2"
                )}
                onClick={() => onSelectChannel(channel)}
              >
                {/* Drag Handle */}
                <div 
                  className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab shrink-0 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm block truncate pr-2" title={channel.name}>
                    {channel.name}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(channel);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(channel.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
                                e.stopPropagation();
                                openEditDialog(channel);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Configurar campanha (ordem, horários e comportamento)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(channel.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Excluir campanha</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  {/* Row 2: Info Grid */}
                  <div className="grid grid-cols-2 gap-3 pl-12">
                    {/* Time */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Horário</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {channel.start_time.slice(0, 5)}
                          {!channel.is_fallback && ` – ${channel.end_time.slice(0, 5)}`}
                          {channel.is_fallback && " – ∞"}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Período</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate">
                          {formatDateRange(channel.start_date, channel.end_date, channel.is_fallback) || "Permanente"}
                        </span>
                      </div>
                    </div>

                    {/* Days */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Dias</span>
                      <Collapsible 
                        open={expandedDays[channel.id]}
                        onOpenChange={(open) => setExpandedDays(prev => ({ ...prev, [channel.id]: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors group/days"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[120px]">
                            {formatDaysLabel(channel.days_of_week)}
                          </span>
                          <ChevronDown className={cn(
                            "w-3 h-3 transition-transform text-muted-foreground group-hover/days:text-primary",
                            expandedDays[channel.id] && "rotate-180"
                          )} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute mt-1 left-0 z-10">
                          <div className="bg-popover border rounded-md shadow-xl p-2 flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                            {DAYS_OF_WEEK.map((day) => (
                              <div
                                key={day.value}
                                className={cn(
                                  "w-6 h-6 rounded text-[10px] font-medium flex items-center justify-center transition-colors",
                                  channel.days_of_week.includes(day.value)
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/50 text-muted-foreground"
                                )}
                              >
                                {day.short}
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Media Count */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mídias</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Film className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{channel.item_count || 0} itens</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
        </div>
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "Editar Campanha" : "Nova Campanha"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Campanha *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Manhã, Almoço, Tarde..."
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional da campanha"
                rows={2}
              />
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data de Início
                </Label>
                <Input
                  type="date"
                  value={formData.start_date || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label className={cn(
                  "flex items-center gap-2",
                  formData.is_fallback && "text-muted-foreground"
                )}>
                  <Calendar className="w-4 h-4" />
                  Data de Término
                  {formData.is_fallback && (
                    <span className="text-xs font-normal">(indeterminado)</span>
                  )}
                </Label>
                <Input
                  type="date"
                  value={formData.is_fallback ? "" : (formData.end_date || "")}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value || null }))}
                  disabled={formData.is_fallback}
                  className={cn(
                    formData.is_fallback && "opacity-50 cursor-not-allowed",
                    dateValidationError && "border-destructive"
                  )}
                  min={formData.start_date || undefined}
                />
              </div>
            </div>
            
            {dateValidationError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <span className="text-destructive">⚠</span>
                {dateValidationError}
              </p>
            )}

            {/* Time fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Horário de Início
                </Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className={cn(
                  "flex items-center gap-2",
                  formData.is_fallback && "text-muted-foreground"
                )}>
                  <Clock className="w-4 h-4" />
                  Horário de Término
                  {formData.is_fallback && (
                    <span className="text-xs font-normal">(indeterminado)</span>
                  )}
                </Label>
                <Input
                  type="time"
                  value={formData.is_fallback ? "" : formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  disabled={formData.is_fallback}
                  className={cn(formData.is_fallback && "opacity-50 cursor-not-allowed")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label
                    key={day.value}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-colors",
                      formData.days_of_week.includes(day.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={formData.days_of_week.includes(day.value)}
                      onCheckedChange={() => toggleDayOfWeek(day.value)}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-yellow-500" />
                  <Label className="cursor-pointer">Fallback</Label>
                </div>
                <Switch
                  checked={formData.is_fallback}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_fallback: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-500" />
                  <Label className="cursor-pointer">Ativo</Label>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || !!dateValidationError}>
              {editingChannel ? "Salvar" : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta campanha? Todas as mídias associadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDeleteChannel(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};