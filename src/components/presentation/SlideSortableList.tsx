import React from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { INITIAL_SLIDES } from '@/data/presentation-slides';
import { Card } from '@/components/ui/card';

interface SortableItemProps {
  id: number;
}

function SortableItem({ id }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id } as any);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const slide = INITIAL_SLIDES.find(s => s.id === id);

  return (
    <div ref={setNodeRef} style={style} className="mb-2 touch-none">
      <Card className="p-3 flex items-center gap-3 bg-card hover:bg-accent/50 transition-colors">
        <div {...attributes} {...listeners} className="cursor-move text-muted-foreground hover:text-foreground p-1">
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{slide?.title || `Slide ${id}`}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    ID: {id}
                </span>
            </div>
            {slide?.subtitle && <div className="text-xs text-muted-foreground truncate">{slide.subtitle}</div>}
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded hidden sm:block">
            {slide?.layout}
        </div>
      </Card>
    </div>
  );
}

interface SlideSortableListProps {
  items: number[];
  onReorder: (items: number[]) => void;
}

export function SlideSortableList({ items, onReorder }: SlideSortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as number);
      const newIndex = items.indexOf(over.id as number);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  // Ensure items are valid (filter out IDs that might not exist in INITIAL_SLIDES if any)
  // But actually we should keep them to avoid data loss, just in case.
  // However, we should make sure all items are unique.
  const uniqueItems = Array.from(new Set(items));

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={uniqueItems} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
            {uniqueItems.map((id) => (
            <SortableItem key={id} id={id} />
            ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
