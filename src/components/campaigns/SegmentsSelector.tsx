import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { CampaignSegment, SegmentDeviceStats } from "@/hooks/useCampaignSegments";

type Props = {
  segments: CampaignSegment[];
  value: string | null;
  onValueChange: (segmentId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  stats?: SegmentDeviceStats | null;
};

export function SegmentsSelector({
  segments,
  value,
  onValueChange,
  placeholder = "Selecione um segmento",
  disabled,
  stats,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => onValueChange(v === "__none__" ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-72">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem segmento</SelectItem>
          {segments.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {stats && (
        <Badge variant="secondary" className="text-xs">
          {stats.device_count} disp • {stats.store_count} lojas
        </Badge>
      )}
    </div>
  );
}

