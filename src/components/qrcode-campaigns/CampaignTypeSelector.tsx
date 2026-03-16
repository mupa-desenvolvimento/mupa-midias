import { CAMPAIGN_TYPE_INFO, type CampaignType } from "@/hooks/useQRCodeCampaigns";

interface Props {
  selected: CampaignType | null;
  onSelect: (type: CampaignType) => void;
}

const campaignTypes = Object.entries(CAMPAIGN_TYPE_INFO) as [CampaignType, typeof CAMPAIGN_TYPE_INFO[CampaignType]][];

export function CampaignTypeSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {campaignTypes.map(([type, info]) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`relative group text-left p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] ${
            selected === type
              ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
              : "border-border hover:border-primary/50 bg-card"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`text-2xl flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center`}>
              <span className="text-lg">{info.icon}</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-foreground leading-tight">{info.label}</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{info.description}</p>
            </div>
          </div>
          {selected === type && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
