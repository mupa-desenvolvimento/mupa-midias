import csv
import os
import json
from collections import Counter

# Definir o caminho do arquivo CSV
csv_path = 'c:\\src\\api-unidasul\\api-unidasul-master\\produtos.CSV'

# Verificar se o arquivo existe
if not os.path.exists(csv_path):
    print(f"Erro: O arquivo {csv_path} não foi encontrado.")
    exit(1)

# Função para determinar o tipo de preço
def classificar_preco(row):
    # Verificar se temos os campos necessários
    if 'preco_medio' not in row or 'preco_clube' not in row:
        return 'Não classificado'
    
    try:
        # Converter para float, tratando valores vazios
        preco_medio = float(row['preco_medio']) if row['preco_medio'] else 0
        preco_clube = float(row['preco_clube']) if row['preco_clube'] else 0
        
        # Classificação dos preços
        if preco_clube > 0 and preco_clube < preco_medio:
            return 'Preço Clube (Oferta)'
        elif preco_medio > 0:
            return 'Preço Normal'
        else:
            return 'Sem preço'
    except ValueError:
        return 'Erro de formato'

# Inicializar contadores e listas para o relatório
tipos_preco = Counter()
total_produtos = 0
amostras = []

# Ler o arquivo CSV
try:
    with open(csv_path, 'r', encoding='utf-8') as file:
        # Tentar determinar o delimitador
        sample = file.read(1024)
        file.seek(0)
        
        # Verificar qual delimitador é mais comum
        if sample.count(';') > sample.count(','):
            delimiter = ';'
        else:
            delimiter = ','
        
        reader = csv.DictReader(file, delimiter=delimiter)
        
        # Processar até 100 produtos
        for i, row in enumerate(reader):
            if i >= 100:
                break
                
            total_produtos += 1
            tipo_preco = classificar_preco(row)
            tipos_preco[tipo_preco] += 1
            
            # Adicionar à amostra para o relatório
            amostra = {
                'codbar': row.get('codbar', 'N/A'),
                'descricao': row.get('description', 'N/A'),
                'preco_medio': row.get('preco_medio', 'N/A'),
                'preco_clube': row.get('preco_clube', 'N/A'),
                'tipo_preco': tipo_preco
            }
            amostras.append(amostra)
            
    # Gerar relatório
    print(f"\nRelatório de Análise de Preços (Total: {total_produtos} produtos)")
    print("=" * 50)
    
    # Estatísticas de tipos de preço
    print("\nDistribuição de Tipos de Preço:")
    for tipo, contagem in tipos_preco.items():
        percentual = (contagem / total_produtos) * 100
        print(f"{tipo}: {contagem} produtos ({percentual:.1f}%)")
    
    # Salvar relatório em JSON
    relatorio = {
        'total_produtos': total_produtos,
        'distribuicao_tipos': {tipo: contagem for tipo, contagem in tipos_preco.items()},
        'amostras': amostras
    }
    
    with open('relatorio_precos.json', 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=4)
    
    print("\nRelatório completo salvo em 'relatorio_precos.json'")
    
    # Exibir algumas amostras
    print("\nAmostras de produtos:")
    for i, amostra in enumerate(amostras[:5]):
        print(f"\nProduto {i+1}:")
        print(f"Código: {amostra['codbar']}")
        print(f"Descrição: {amostra['descricao']}")
        print(f"Preço Médio: {amostra['preco_medio']}")
        print(f"Preço Clube: {amostra['preco_clube']}")
        print(f"Tipo de Preço: {amostra['tipo_preco']}")
    
except Exception as e:
    print(f"Erro ao processar o arquivo CSV: {e}")