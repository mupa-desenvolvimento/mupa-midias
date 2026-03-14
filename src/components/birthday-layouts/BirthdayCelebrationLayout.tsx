import { BirthdayLayoutProps } from "./types";
import { User } from "lucide-react";

const periodLabel = { day: "do Dia", week: "da Semana", month: "do Mês" };

export function BirthdayCelebrationLayout({ people, period, className }: BirthdayLayoutProps) {
  if (people.length === 0) {
    return (
      <div className={`flex items-center justify-center py-16 text-muted-foreground ${className}`}>
        Nenhum aniversariante {periodLabel[period].toLowerCase().replace("do ", "").replace("da ", "")}.
      </div>
    );
  }

  return (
    <div className={`grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {people.map((person) => {
        const birthDate = new Date(person.birth_date + "T00:00:00");
        const firstName = person.name.split(" ")[0];

        return (
          <div
            key={person.id}
            className="relative overflow-hidden rounded-2xl bg-[hsl(220,60%,15%)] aspect-video flex items-center"
          >
            {/* Decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Balloons */}
              <div className="absolute top-4 left-6 w-6 h-8 rounded-full bg-pink-400/60" />
              <div className="absolute top-2 left-10 w-5 h-7 rounded-full bg-yellow-400/50" />
              <div className="absolute top-6 right-8 w-7 h-9 rounded-full bg-cyan-400/50" />
              <div className="absolute top-3 right-14 w-5 h-7 rounded-full bg-pink-500/40" />
              <div className="absolute bottom-8 left-4 w-4 h-6 rounded-full bg-green-400/40" />
              {/* Confetti dots */}
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: `${3 + Math.random() * 5}px`,
                    height: `${3 + Math.random() * 5}px`,
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    backgroundColor: [
                      "#f472b6", "#facc15", "#34d399", "#60a5fa",
                      "#c084fc", "#fb923c", "#22d3ee",
                    ][i % 7],
                    opacity: 0.4 + Math.random() * 0.3,
                  }}
                />
              ))}
              {/* Party hat */}
              <div className="absolute top-2 left-[30%]">
                <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-yellow-400/70" />
              </div>
              {/* Streamers */}
              <div className="absolute top-0 left-[20%] w-0.5 h-12 bg-gradient-to-b from-pink-400/60 to-transparent rotate-12" />
              <div className="absolute top-0 right-[25%] w-0.5 h-10 bg-gradient-to-b from-cyan-400/60 to-transparent -rotate-12" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex items-center w-full px-6 py-4 gap-6">
              {/* Photo frame */}
              <div className="relative flex-shrink-0">
                <div className="w-28 h-28 rounded-lg border-4 border-cyan-400/60 bg-[hsl(220,50%,20%)] overflow-hidden shadow-lg shadow-cyan-400/10">
                  {person.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-cyan-400/40" />
                    </div>
                  )}
                </div>
                {/* Ribbon */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-[8px] px-3 py-0.5 rounded-full font-medium whitespace-nowrap">
                  🎉 Feliz aniversário!
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 text-white">
                <h3 className="text-2xl font-bold leading-tight">
                  Parabéns, <span className="text-cyan-300">{firstName}!</span>
                </h3>
                <p className="text-sm text-white/70 mt-2 leading-relaxed">
                  Que hoje o seu dia seja{" "}
                  <span className="font-semibold text-white">o mais feliz</span> de todos!
                </p>
                <p className="text-xs text-white/40 mt-3">
                  {birthDate.getDate()}/{String(birthDate.getMonth() + 1).padStart(2, "0")}
                  {person.department && ` • ${person.department}`}
                </p>
              </div>
            </div>

            {/* Bottom right logo area */}
            <div className="absolute bottom-3 right-4 text-[10px] text-cyan-300/40 italic">
              feliz aniversário
            </div>
          </div>
        );
      })}
    </div>
  );
}
