import { useState } from "react";
import { Download, FileText, Loader2, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const AudienceReport = ({ tenantId }: { tenantId: string | null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["audience-report", tenantId],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const { data, error } = await supabase
        .from("audience_detections")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("detected_at", todayStart)
        .lte("detected_at", todayEnd);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      // Group by session_id to get unique people and their "average" traits
      const sessionGroups: Record<string, any[]> = {};
      data.forEach((d) => {
        if (!sessionGroups[d.session_id]) sessionGroups[d.session_id] = [];
        sessionGroups[d.session_id].push(d);
      });

      const uniquePeople = Object.values(sessionGroups).map((logs) => {
        const gender = logs.reduce((acc, l) => {
          acc[l.gender] = (acc[l.gender] || 0) + 1;
          return acc;
        }, {} as any);
        const emotion = logs.reduce((acc, l) => {
          acc[l.emotion] = (acc[l.emotion] || 0) + 1;
          return acc;
        }, {} as any);
        const avgAge = logs.reduce((acc, l) => acc + l.age, 0) / logs.length;

        return {
          gender: Object.keys(gender).sort((a, b) => gender[b] - gender[a])[0],
          emotion: Object.keys(emotion).sort((a, b) => emotion[b] - emotion[a])[0],
          age: Math.round(avgAge),
        };
      });

      const ageRanges = {
        "0-18": 0,
        "19-30": 0,
        "31-45": 0,
        "46-60": 0,
        "60+": 0,
      };

      const genderDist: Record<string, number> = {};
      const emotionDist: Record<string, number> = {};

      uniquePeople.forEach((p) => {
        if (p.age <= 18) ageRanges["0-18"]++;
        else if (p.age <= 30) ageRanges["19-30"]++;
        else if (p.age <= 45) ageRanges["31-45"]++;
        else if (p.age <= 60) ageRanges["46-60"]++;
        else ageRanges["60+"]++;

        genderDist[p.gender] = (genderDist[p.gender] || 0) + 1;
        emotionDist[p.emotion] = (emotionDist[p.emotion] || 0) + 1;
      });

      return {
        totalUnique: uniquePeople.length,
        ageData: Object.entries(ageRanges).map(([name, value]) => ({ name, value })),
        genderData: Object.entries(genderDist).map(([name, value]) => ({ name, value })),
        emotionData: Object.entries(emotionDist).map(([name, value]) => ({ name, value })),
      };
    },
    enabled: isOpen,
  });

  const exportCSV = () => {
    if (!reportData) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metrica,Valor\n"
      + `Total de Pessoas,${reportData.totalUnique}\n`
      + reportData.ageData.map(d => `Idade ${d.name},${d.value}`).join("\n") + "\n"
      + reportData.genderData.map(d => `Gênero ${d.name},${d.value}`).join("\n") + "\n"
      + reportData.emotionData.map(d => `Expressão ${d.name},${d.value}`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_audiencia_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary transition-all shadow-lg shadow-primary/5">
          <FileText className="w-4 h-4" /> Gerar Relatório de Audiência
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <TrendingUp className="w-6 h-6 text-primary" />
            Relatório de Audiência - {format(new Date(), "dd/MM/yyyy")}
          </DialogTitle>
          <DialogDescription>
            Dados consolidados da audiência captada hoje pelos sensores de IA.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse font-medium">Processando dados da audiência...</p>
          </div>
        ) : reportData ? (
          <div className="space-y-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-primary">{reportData.totalUnique}</span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Visitantes Únicos</span>
              </div>
              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-emerald-500">
                  {reportData.totalUnique > 0 ? Math.round(((reportData.emotionData.find(d => d.name === "happy")?.value || 0) / reportData.totalUnique) * 100) : 0}%
                </span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Nível de Satisfação</span>
              </div>
              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-blue-500">
                  {reportData.totalUnique > 0 ? Math.round(((reportData.genderData.find(d => d.name === "male")?.value || 0) / reportData.totalUnique) * 100) : 0}%
                </span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Público Masculino</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4 p-6 rounded-2xl bg-muted/20 border border-border/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Distribuição por Idade
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.ageData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff10", borderRadius: "12px" }}
                        cursor={{ fill: "#ffffff05" }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4 p-6 rounded-2xl bg-muted/20 border border-border/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Gênero e Expressões
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.emotionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {reportData.emotionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff10", borderRadius: "12px" }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">
                Fechar
              </Button>
              <Button className="gap-2 rounded-xl" onClick={exportCSV}>
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted/50">
              <FileText className="w-12 h-12 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">Nenhum dado captado hoje ainda.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
