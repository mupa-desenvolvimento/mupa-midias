import os
import json
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime

# Encontrar o arquivo de relatório mais recente
def encontrar_relatorio_recente():
    pasta_relatorios = 'relatorios'
    arquivos_json = [f for f in os.listdir(pasta_relatorios) if f.endswith('.json')]
    
    if not arquivos_json:
        print("Nenhum relatório encontrado.")
        return None
    
    # Ordenar por data de modificação (mais recente primeiro)
    arquivos_json.sort(key=lambda x: os.path.getmtime(os.path.join(pasta_relatorios, x)), reverse=True)
    return os.path.join(pasta_relatorios, arquivos_json[0])

# Carregar dados do relatório
def carregar_dados(caminho_arquivo):
    with open(caminho_arquivo, 'r', encoding='utf-8') as f:
        return json.load(f)

# Analisar e processar os resultados
def analisar_resultados(dados):
    # Converter para DataFrame para facilitar a análise
    df = pd.DataFrame(dados['resultados'])
    
    # Contagem por tipo de preço
    contagem_tipos = df['tipo_preco'].value_counts().to_dict()
    
    # Estatísticas de preços para produtos com preço normal
    df_com_preco = df[df['tipo_preco'] == 'Preço Normal'].copy()
    
    # Converter preços de string para float
    if not df_com_preco.empty:
        df_com_preco['preco_float'] = df_com_preco['preco'].str.replace(',', '.').astype(float)
        estatisticas_preco = {
            'min': df_com_preco['preco_float'].min(),
            'max': df_com_preco['preco_float'].max(),
            'media': df_com_preco['preco_float'].mean(),
            'mediana': df_com_preco['preco_float'].median()
        }
    else:
        estatisticas_preco = {'min': 0, 'max': 0, 'media': 0, 'mediana': 0}
    
    # Categorias de produtos com preço
    categorias = {}
    for _, row in df_com_preco.iterrows():
        descricao = row['descricao']
        palavras = descricao.split()
        for palavra in palavras:
            if len(palavra) > 3:  # Ignorar palavras muito curtas
                if palavra in categorias:
                    categorias[palavra] += 1
                else:
                    categorias[palavra] = 1
    
    # Pegar as 10 palavras mais comuns
    categorias_top = dict(sorted(categorias.items(), key=lambda x: x[1], reverse=True)[:10])
    
    return {
        'contagem_tipos': contagem_tipos,
        'estatisticas_preco': estatisticas_preco,
        'categorias_comuns': categorias_top,
        'produtos_com_preco': df_com_preco.to_dict('records') if not df_com_preco.empty else []
    }

# Gerar gráficos
def gerar_graficos(analise):
    # Criar pasta para gráficos se não existir
    pasta_graficos = 'relatorios/graficos'
    os.makedirs(pasta_graficos, exist_ok=True)
    
    # Gráfico de pizza para tipos de preço
    plt.figure(figsize=(10, 6))
    labels = list(analise['contagem_tipos'].keys())
    sizes = list(analise['contagem_tipos'].values())
    plt.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
    plt.axis('equal')
    plt.title('Distribuição de Tipos de Preço')
    plt.savefig(f'{pasta_graficos}/distribuicao_tipos_preco.png')
    plt.close()
    
    # Gráfico de barras para categorias comuns
    if analise['categorias_comuns']:
        plt.figure(figsize=(12, 6))
        categorias = list(analise['categorias_comuns'].keys())
        contagens = list(analise['categorias_comuns'].values())
        plt.bar(categorias, contagens)
        plt.xticks(rotation=45, ha='right')
        plt.title('Palavras-chave mais comuns em produtos com preço')
        plt.tight_layout()
        plt.savefig(f'{pasta_graficos}/categorias_comuns.png')
        plt.close()
    
    # Histograma de preços
    if analise['produtos_com_preco']:
        precos = [float(p['preco'].replace(',', '.')) for p in analise['produtos_com_preco']]
        plt.figure(figsize=(10, 6))
        plt.hist(precos, bins=10, edgecolor='black')
        plt.title('Distribuição de Preços')
        plt.xlabel('Preço (R$)')
        plt.ylabel('Quantidade de Produtos')
        plt.grid(axis='y', alpha=0.75)
        plt.savefig(f'{pasta_graficos}/distribuicao_precos.png')
        plt.close()

# Gerar relatório detalhado
def gerar_relatorio_detalhado(analise, caminho_arquivo_original):
    agora = datetime.now().strftime('%Y%m%d_%H%M%S')
    nome_arquivo = f'relatorios/analise_detalhada_{agora}.html'
    
    # Criar conteúdo HTML
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Análise Detalhada de Preços</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            h1, h2, h3 {{ color: #2c3e50; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .chart-container {{ margin: 20px 0; text-align: center; }}
            .chart {{ max-width: 100%; height: auto; }}
            .summary {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <h1>Análise Detalhada de Consultas de Preços</h1>
        <p>Relatório gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
        <p>Baseado no arquivo: {os.path.basename(caminho_arquivo_original)}</p>
        
        <div class="summary">
            <h2>Resumo</h2>
            <p>Total de consultas: {sum(analise['contagem_tipos'].values())}</p>
            <ul>
    '''
    
    # Adicionar contagem de tipos
    for tipo, contagem in analise['contagem_tipos'].items():
        percentual = (contagem / sum(analise['contagem_tipos'].values())) * 100
        html += f'<li>{tipo}: {contagem} ({percentual:.2f}%)</li>\n'
    
    html += '''
            </ul>
        </div>
        
        <h2>Estatísticas de Preços</h2>
    '''
    
    # Adicionar estatísticas de preço
    if analise['produtos_com_preco']:
        html += f'''
        <table>
            <tr>
                <th>Estatística</th>
                <th>Valor (R$)</th>
            </tr>
            <tr>
                <td>Preço Mínimo</td>
                <td>{analise['estatisticas_preco']['min']:.2f}</td>
            </tr>
            <tr>
                <td>Preço Máximo</td>
                <td>{analise['estatisticas_preco']['max']:.2f}</td>
            </tr>
            <tr>
                <td>Preço Médio</td>
                <td>{analise['estatisticas_preco']['media']:.2f}</td>
            </tr>
            <tr>
                <td>Preço Mediana</td>
                <td>{analise['estatisticas_preco']['mediana']:.2f}</td>
            </tr>
        </table>
        '''
    else:
        html += '<p>Nenhum produto com preço encontrado.</p>'
    
    # Adicionar gráficos
    html += '''
        <h2>Gráficos</h2>
        
        <div class="chart-container">
            <h3>Distribuição de Tipos de Preço</h3>
            <img class="chart" src="graficos/distribuicao_tipos_preco.png" alt="Distribuição de Tipos de Preço">
        </div>
    '''
    
    if analise['categorias_comuns']:
        html += '''
        <div class="chart-container">
            <h3>Palavras-chave mais comuns em produtos com preço</h3>
            <img class="chart" src="graficos/categorias_comuns.png" alt="Categorias Comuns">
        </div>
        '''
    
    if analise['produtos_com_preco']:
        html += '''
        <div class="chart-container">
            <h3>Distribuição de Preços</h3>
            <img class="chart" src="graficos/distribuicao_precos.png" alt="Distribuição de Preços">
        </div>
        '''
    
    # Adicionar lista de produtos com preço
    if analise['produtos_com_preco']:
        html += '''
        <h2>Lista de Produtos com Preço</h2>
        <table>
            <tr>
                <th>EAN</th>
                <th>Descrição</th>
                <th>Preço</th>
            </tr>
        '''
        
        for produto in analise['produtos_com_preco']:
            html += f'''
            <tr>
                <td>{produto['ean']}</td>
                <td>{produto['descricao']}</td>
                <td>R$ {produto['preco']}</td>
            </tr>
            '''
        
        html += '</table>'
    
    html += '''
    </body>
    </html>
    '''
    
    # Salvar arquivo HTML
    with open(nome_arquivo, 'w', encoding='utf-8') as f:
        f.write(html)
    
    return nome_arquivo

# Função principal
def main():
    # Encontrar relatório mais recente
    caminho_arquivo = encontrar_relatorio_recente()
    if not caminho_arquivo:
        return
    
    print(f"Analisando relatório: {caminho_arquivo}")
    
    # Carregar dados
    dados = carregar_dados(caminho_arquivo)
    
    # Analisar resultados
    analise = analisar_resultados(dados)
    
    # Gerar gráficos
    gerar_graficos(analise)
    
    # Gerar relatório detalhado
    caminho_relatorio = gerar_relatorio_detalhado(analise, caminho_arquivo)
    
    print(f"\nAnálise concluída!")
    print(f"Relatório detalhado salvo em: {caminho_relatorio}")
    print(f"Gráficos salvos em: relatorios/graficos/")

if __name__ == "__main__":
    main()