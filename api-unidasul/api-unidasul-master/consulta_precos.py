import csv
import requests
import json
from datetime import datetime
import pandas as pd
import time
import os

# Configurações
CSV_PATH = 'produtos.CSV'
API_URL = 'http://localhost:5000/get_price'
FILIAL = '086'
NUM_CONSULTAS = 100
OUTPUT_DIR = 'relatorios'

# Criar diretório de relatórios se não existir
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Função para ler todos os EANs do arquivo CSV
def ler_todos_eans_do_csv(csv_path):
    import random
    todos_eans = []
    try:
        with open(csv_path, 'r', encoding='latin-1') as file:
            csv_reader = csv.reader(file, delimiter=';')
            next(csv_reader)  # Pular o cabeçalho
            # Ler todos os EANs válidos do arquivo
            for row in csv_reader:
                if row and len(row) > 0 and row[0].strip():  # Verificar se a linha tem dados e o EAN não está vazio
                    todos_eans.append(row[0].strip())
            
            if todos_eans:
                print(f"Encontrados {len(todos_eans)} EANs válidos no arquivo CSV.")
                # Embaralhar a lista para facilitar a seleção aleatória posterior
                random.shuffle(todos_eans)
            else:
                print("Nenhum EAN válido encontrado no arquivo.")
        return todos_eans
    except Exception as e:
        print(f"Erro ao ler o arquivo CSV: {e}")
        return []

# Função para obter próximo EAN aleatório da lista
def obter_proximo_ean(lista_eans, eans_ja_consultados):
    import random
    # Filtrar EANs que ainda não foram consultados
    eans_disponiveis = [ean for ean in lista_eans if ean not in eans_ja_consultados]
    
    if not eans_disponiveis:
        print("Todos os EANs disponíveis já foram consultados. Reiniciando a lista...")
        return random.choice(lista_eans)  # Se todos já foram consultados, escolhe um aleatório
    
    return random.choice(eans_disponiveis)

# Função para consultar o preço de um produto
def consultar_preco(ean, filial):
    try:
        response = requests.get(f"{API_URL}?ean={ean}&num_filial={filial}", timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Erro na consulta do EAN {ean}: {response.status_code}")
            return None
    except Exception as e:
        print(f"Erro ao consultar o EAN {ean}: {e}")
        return None

# Função para classificar o tipo de preço
def classificar_tipo_preco(resultado):
    if not resultado or 'elementos' not in resultado:
        return "Erro", None, None
    
    elementos = resultado['elementos']
    preco = elementos.get('lblPreco')
    preco_clube = elementos.get('lblPrecoDC')
    
    if preco_clube and preco_clube.strip():
        return "Preço Clube", preco, preco_clube
    elif preco and preco.strip():
        return "Preço Normal", preco, None
    else:
        return "Sem Preço", None, None

# Função principal
def main():
    print(f"Iniciando consulta até encontrar {NUM_CONSULTAS} produtos com consulta bem-sucedida...")
    
    # Ler todos os EANs do arquivo CSV
    todos_eans = ler_todos_eans_do_csv(CSV_PATH)
    if not todos_eans:
        print("Nenhum EAN encontrado no arquivo CSV.")
        return
    
    # Preparar para armazenar os resultados
    resultados = []
    tipos_preco = {"Preço Normal": 0, "Preço Clube": 0, "Sem Preço": 0, "Erro": 0}
    eans_ja_consultados = set()
    consultas_realizadas = 0
    produtos_encontrados = 0
    
    # Realizar as consultas até encontrar NUM_CONSULTAS produtos
    while produtos_encontrados < NUM_CONSULTAS:
        # Obter próximo EAN aleatório
        ean = obter_proximo_ean(todos_eans, eans_ja_consultados)
        eans_ja_consultados.add(ean)
        consultas_realizadas += 1
        
        print(f"Consulta {consultas_realizadas} - Produtos encontrados: {produtos_encontrados}/{NUM_CONSULTAS} - EAN: {ean}")
        resultado = consultar_preco(ean, FILIAL)
        
        if resultado:
            tipo_preco, preco, preco_clube = classificar_tipo_preco(resultado)
            tipos_preco[tipo_preco] += 1
            
            # Extrair informações relevantes
            descricao = resultado.get('elementos', {}).get('lblDcrProduto', 'N/A')
            codigo = resultado.get('elementos', {}).get('lblScanner', 'N/A')
            
            # Adicionar aos resultados
            resultados.append({
                'ean': ean,
                'descricao': descricao,
                'codigo': codigo,
                'tipo_preco': tipo_preco,
                'preco': preco,
                'preco_clube': preco_clube
            })
            
            # Incrementar contador apenas se não for erro ou "Sem Preço"
            if tipo_preco not in ["Erro", "Sem Preço"]:
                produtos_encontrados += 1
                print(f"Produto {produtos_encontrados}/{NUM_CONSULTAS} encontrado! Tipo: {tipo_preco}")
        else:
            tipos_preco["Erro"] += 1
            resultados.append({
                'ean': ean,
                'descricao': 'N/A',
                'codigo': 'N/A',
                'tipo_preco': 'Erro',
                'preco': None,
                'preco_clube': None
            })
        
        # Pequena pausa para não sobrecarregar a API
        time.sleep(0.5)
        
        # Verificar se já consultamos todos os EANs disponíveis sem sucesso
        if len(eans_ja_consultados) >= len(todos_eans) and produtos_encontrados < NUM_CONSULTAS:
            print(f"Aviso: Todos os {len(todos_eans)} EANs disponíveis foram consultados, mas apenas {produtos_encontrados} produtos foram encontrados.")
            print("Continuando a consulta com EANs já consultados...")
            eans_ja_consultados = set()  # Resetar para permitir consultar novamente
    
    # Gerar relatório
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Relatório em CSV
    df = pd.DataFrame(resultados)
    csv_path = os.path.join(OUTPUT_DIR, f"relatorio_precos_{timestamp}.csv")
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    
    # Relatório em JSON
    json_path = os.path.join(OUTPUT_DIR, f"relatorio_precos_{timestamp}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            'data_consulta': datetime.now().isoformat(),
            'filial': FILIAL,
            'total_consultas': len(resultados),
            'resumo_tipos_preco': tipos_preco,
            'resultados': resultados
        }, f, ensure_ascii=False, indent=4)
    
    # Relatório de resumo em texto
    resumo_path = os.path.join(OUTPUT_DIR, f"resumo_precos_{timestamp}.txt")
    with open(resumo_path, 'w', encoding='utf-8') as f:
        f.write(f"Relatório de Consulta de Preços\n")
        f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write(f"Filial: {FILIAL}\n")
        f.write(f"Total de consultas: {len(resultados)}\n\n")
        f.write(f"Resumo por tipo de preço:\n")
        for tipo, quantidade in tipos_preco.items():
            percentual = (quantidade / len(resultados)) * 100 if resultados else 0
            f.write(f"- {tipo}: {quantidade} ({percentual:.2f}%)\n")
    
    print("\nConsulta finalizada!")
    print(f"Relatório CSV salvo em: {csv_path}")
    print(f"Relatório JSON salvo em: {json_path}")
    print(f"Resumo salvo em: {resumo_path}")
    print("\nResumo por tipo de preço:")
    for tipo, quantidade in tipos_preco.items():
        percentual = (quantidade / len(resultados)) * 100 if resultados else 0
        print(f"- {tipo}: {quantidade} ({percentual:.2f}%)")

if __name__ == "__main__":
    main()