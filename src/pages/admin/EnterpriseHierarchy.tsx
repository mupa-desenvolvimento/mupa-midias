import { HierarchyExplorer } from "@/components/enterprise/HierarchyExplorer";

const EnterpriseHierarchy = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hierarquia Enterprise</h1>
        <p className="text-sm text-muted-foreground">Navegação em árvore: Empresa > Estado > Cidade > Loja > Setor > Zona > Dispositivo</p>
      </div>
      <HierarchyExplorer />
    </div>
  );
};

export default EnterpriseHierarchy;
