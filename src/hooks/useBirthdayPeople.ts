import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BirthdayPerson, BirthdayPeriod } from "@/components/birthday-layouts/types";

function filterByPeriod(people: BirthdayPerson[], period: BirthdayPeriod): BirthdayPerson[] {
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  const todayDay = today.getDay(); // 0=Sun

  return people.filter((p) => {
    const bd = new Date(p.birth_date + "T00:00:00");
    const bdMonth = bd.getMonth();
    const bdDate = bd.getDate();

    if (period === "month") {
      return bdMonth === todayMonth;
    }

    if (period === "day") {
      return bdMonth === todayMonth && bdDate === todayDate;
    }

    // week: Mon-Sun of current week
    const startOfWeek = new Date(today);
    const diff = todayDay === 0 ? 6 : todayDay - 1;
    startOfWeek.setDate(todayDate - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const thisYear = today.getFullYear();
    const bdThisYear = new Date(thisYear, bdMonth, bdDate);
    return bdThisYear >= startOfWeek && bdThisYear <= endOfWeek;
  }).sort((a, b) => {
    const da = new Date(a.birth_date + "T00:00:00");
    const db = new Date(b.birth_date + "T00:00:00");
    return da.getMonth() * 31 + da.getDate() - (db.getMonth() * 31 + db.getDate());
  });
}

export function useBirthdayPeople() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allPeople = [], isLoading, error } = useQuery({
    queryKey: ["birthday-people"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("birthday_people")
        .select("*")
        .eq("is_active", true)
        .order("birth_date");

      if (error) throw error;
      return (data ?? []) as BirthdayPerson[];
    },
  });

  const uploadCsv = useMutation({
    mutationFn: async (csvText: string) => {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV vazio ou sem dados");

      const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("nome"));
      const dateIdx = headers.findIndex((h) => h.includes("nascimento") || h.includes("data"));
      const deptIdx = headers.findIndex((h) => h.includes("departamento") || h.includes("depto"));
      const roleIdx = headers.findIndex((h) => h.includes("cargo"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const photoIdx = headers.findIndex((h) => h.includes("foto"));
      const activeIdx = headers.findIndex((h) => h.includes("ativo"));

      if (nameIdx === -1 || dateIdx === -1) {
        throw new Error("CSV precisa ter colunas 'nome' e 'data_nascimento'");
      }

      // Get tenant_id from user mapping
      const { data: { user } } = await (supabase.auth as any).getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: mapping } = await supabase
        .from("user_tenant_mappings")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const tenantId = mapping?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(";").map((c) => c.trim());
        const name = cols[nameIdx];
        const rawDate = cols[dateIdx];
        if (!name || !rawDate) continue;

        // Parse date: dd/mm/yyyy or yyyy-mm-dd
        let birthDate: string;
        if (rawDate.includes("/")) {
          const [d, m, y] = rawDate.split("/");
          birthDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else {
          birthDate = rawDate;
        }

        const activeVal = activeIdx >= 0 ? cols[activeIdx]?.toLowerCase() : "true";
        const isActive = !["false", "0", "não", "nao", "desativado", "inativo"].includes(activeVal ?? "");

        rows.push({
          tenant_id: tenantId,
          name,
          birth_date: birthDate,
          department: deptIdx >= 0 ? cols[deptIdx] || null : null,
          role: roleIdx >= 0 ? cols[roleIdx] || null : null,
          email: emailIdx >= 0 ? cols[emailIdx] || null : null,
          photo_url: photoIdx >= 0 ? cols[photoIdx] || null : null,
          is_active: isActive,
        });
      }

      if (rows.length === 0) throw new Error("Nenhum registro válido encontrado");

      const { error } = await (supabase as any).from("birthday_people").insert(rows);
      if (error) throw error;

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["birthday-people"] });
      toast({ title: `${count} aniversariantes importados com sucesso` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    },
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("birthday_people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-people"] });
    },
  });

  return {
    allPeople,
    isLoading,
    error,
    filterByPeriod: (period: BirthdayPeriod) => filterByPeriod(allPeople, period),
    uploadCsv,
    deletePerson,
  };
}
