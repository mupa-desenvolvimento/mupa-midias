import { HierarchyExplorer } from "@/components/enterprise/HierarchyExplorer";
import { PageShell } from "@/components/layout/PageShell";

const EnterpriseHierarchy = () => {
  return (
    <PageShell title="Hierarquia Enterprise" subtitle="Navegação em árvore: Empresa > Estado > Cidade > Loja > Setor > Zona > Dispositivo">
      <HierarchyExplorer />
    </PageShell>
  );
};

export default EnterpriseHierarchy;
