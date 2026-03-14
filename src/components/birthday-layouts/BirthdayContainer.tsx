import { BirthdayPerson, BirthdayPeriod, BirthdayLayoutType } from "./types";
import { BirthdayCardsLayout } from "./BirthdayCardsLayout";
import { BirthdayListLayout } from "./BirthdayListLayout";
import { BirthdayGridLayout } from "./BirthdayGridLayout";
import { BirthdayBannerLayout } from "./BirthdayBannerLayout";
import { BirthdayCelebrationLayout } from "./BirthdayCelebrationLayout";

interface BirthdayContainerProps {
  people: BirthdayPerson[];
  period: BirthdayPeriod;
  layout: BirthdayLayoutType;
  className?: string;
}

export function BirthdayContainer({ people, period, layout, className }: BirthdayContainerProps) {
  const props = { people, period, className };

  switch (layout) {
    case "list":
      return <BirthdayListLayout {...props} />;
    case "grid":
      return <BirthdayGridLayout {...props} />;
    case "banner":
      return <BirthdayBannerLayout {...props} />;
    case "celebration":
      return <BirthdayCelebrationLayout {...props} />;
    case "cards":
    default:
      return <BirthdayCardsLayout {...props} />;
  }
}
