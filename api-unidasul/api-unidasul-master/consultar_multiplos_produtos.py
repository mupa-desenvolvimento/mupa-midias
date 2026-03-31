import requests
import json
from datetime import datetime
import re

# Configurações
API_URL = 'http://localhost:5000/get_price'
FILIAL = '086'

# Função para consultar o preço de um produto
def consultar_preco(ean, filial):
    try:
        print(f"Consultando produto com EAN: {ean} na filial {filial}...")
        response = requests.get(f"{API_URL}?ean={ean}&num_filial={filial}", timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Erro na consulta do EAN {ean}: {response.status_code}")
            return None
    except Exception as e:
        print(f"Erro ao consultar o EAN {ean}: {e}")
        return None

# Função para extrair números de uma string de promoção
def extrair_numeros_promocao(texto_promocao):
    # Padrão para encontrar "COMPRA DE XX UN" e "PAGUE YY UN"
    padrao_compra = r'COMPRA DE (\d+) UN'
    padrao_pague = r'PAGUE (\d+) UN'
    
    # Padrão alternativo para "LEVE X PAGUE Y"
    padrao_leve = r'LEVE (\d+)'
    padrao_pague_alt = r'PAGUE (\d+)'
    
    # Padrão para "NA COMPRA DE X UN ... PAGUE Y UN"
    padrao_na_compra = r'NA COMPRA DE (\d+) UN'
    
    # Tentar os diferentes padrões
    compra = re.search(padrao_compra, texto_promocao.upper())
    if not compra:
        compra = re.search(padrao_leve, texto_promocao.upper())
    if not compra:
        compra = re.search(padrao_na_compra, texto_promocao.upper())
    
    pague = re.search(padrao_pague, texto_promocao.upper())
    if not pague:
        pague = re.search(padrao_pague_alt, texto_promocao.upper())
    
    qtd_compra = int(compra.group(1)) if compra else None
    qtd_pague = int(pague.group(1)) if pague else None
    
    # Se encontrou apenas um dos valores, tentar inferir o outro
    if qtd_compra and not qtd_pague and 'GRATIS' in texto_promocao.upper():
        # Se menciona grátis, assume que paga 1 unidade menos que compra
        qtd_pague = qtd_compra - 1
    elif qtd_compra and not qtd_pague:
        # Caso não tenha informação clara, assume que paga metade
        qtd_pague = max(1, qtd_compra // 2)
    elif not qtd_compra and qtd_pague:
        # Se só tem informação de pagamento, assume que compra 1 unidade a mais
        qtd_compra = qtd_pague + 1
    
    return qtd_compra, qtd_pague

# Função para calcular economia com diferentes quantidades
def calcular_economia_quantidades(preco_normal, qtd_compra, qtd_pague, quantidades_alternativas=None):
    if not quantidades_alternativas:
        quantidades_alternativas = [1, 2, 3, 6, 12]  # Quantidades padrão para calcular
    
    resultados = []
    
    # Calcular a proporção de desconto
    proporcao_pague = qtd_pague / qtd_compra if qtd_compra > 0 else 1
    
    for qtd in quantidades_alternativas:
        # Calcular quantas unidades seriam pagas com base na proporção
        unidades_a_pagar = round(qtd * proporcao_pague)
        unidades_gratis = qtd - unidades_a_pagar
        
        # Calcular valores
        valor_total_normal = qtd * preco_normal
        valor_total_promocao = unidades_a_pagar * preco_normal
        economia = valor_total_normal - valor_total_promocao
        percentual_economia = (economia / valor_total_normal) * 100 if valor_total_normal > 0 else 0
        preco_medio_unitario = valor_total_promocao / qtd if qtd > 0 else 0
        
        resultados.append({
            'quantidade': qtd,
            'unidades_pagas': unidades_a_pagar,
            'unidades_gratis': unidades_gratis,
            'valor_total_normal': valor_total_normal,
            'valor_total_promocao': valor_total_promocao,
            'economia': economia,
            'percentual_economia': percentual_economia,
            'preco_medio_unitario': preco_medio_unitario
        })
    
    return resultados

# Função para classificar o tipo de preço e calcular detalhes
def analisar_produto(resultado, ean):
    if not resultado or 'elementos' not in resultado:
        return {
            'ean': ean,
            'descricao': 'N/A',
            'codigo': 'N/A',
            'tipo_preco': 'Erro',
            'preco': None,
            'preco_clube': None,
            'promocao': None,
            'detalhes_promocao': None,
            'calculos_quantidades': None,
            'dados_adicionais': {}
        }
    
    elementos = resultado['elementos']
    
    # Extrair informações básicas
    descricao = elementos.get('lblDcrProduto', 'N/A')
    codigo = elementos.get('lblScanner', 'N/A')
    preco_str = elementos.get('lblPreco', 'N/A')
    preco_clube_str = elementos.get('lblPrecoDC', 'N/A')
    promocao_pdv = elementos.get('lblPromoPdv', '')
    
    # Converter strings de preço para valores numéricos
    preco_normal = 0
    preco_clube = 0
    try:
        if preco_str and preco_str.strip() and preco_str != 'N/A':
            # Remover qualquer texto que não seja número, vírgula ou ponto
            preco_limpo = ''.join([c for c in preco_str if c.isdigit() or c in ',.'])
            preco_limpo = preco_limpo.replace(',', '.')
            # Se houver mais de um ponto, manter apenas o último (como separador decimal)
            if preco_limpo.count('.') > 1:
                partes = preco_limpo.split('.')
                preco_limpo = ''.join(partes[:-1]) + '.' + partes[-1]
            if preco_limpo:
                preco_normal = float(preco_limpo)
        
        if preco_clube_str and preco_clube_str.strip() and preco_clube_str != 'N/A':
            # Verificar se há um valor numérico no texto
            import re
            match = re.search(r'\d+[,.]\d+', preco_clube_str)
            if match:
                preco_limpo = match.group().replace(',', '.')
                preco_clube = float(preco_limpo)
            else:
                print(f"Não foi possível extrair preço clube de: {preco_clube_str}")
    except Exception as e:
        print(f"Erro ao converter preços: {e}")
        print(f"Preço normal (texto): {preco_str}")
        print(f"Preço clube (texto): {preco_clube_str}")
    
    # Verificar se há promoção especial
    tem_promocao_especial = False
    tipo_promocao = ""
    detalhes_promocao = None
    calculos_quantidades = None
    
    if promocao_pdv and promocao_pdv.strip() and promocao_pdv != "N/A":
        tem_promocao_especial = True
        tipo_promocao = promocao_pdv.strip()
        
        # Tentar extrair detalhes da promoção
        qtd_compra, qtd_pague = extrair_numeros_promocao(tipo_promocao)
        
        if qtd_compra and qtd_pague and qtd_compra > qtd_pague:
            qtd_gratis = qtd_compra - qtd_pague
            economia = qtd_gratis * preco_normal
            percentual_desconto = (qtd_gratis / qtd_compra) * 100
            preco_medio = (qtd_pague * preco_normal / qtd_compra) if qtd_compra > 0 else 0
            
            detalhes_promocao = {
                'tipo': 'compre_pague',
                'qtd_compra': qtd_compra,
                'qtd_pague': qtd_pague,
                'qtd_gratis': qtd_gratis,
                'economia_unitaria': economia / qtd_compra if qtd_compra > 0 else 0,
                'economia_total': economia,
                'percentual_desconto': percentual_desconto,
                'preco_medio_unitario': preco_medio
            }
            
            # Calcular economia com diferentes quantidades
            calculos_quantidades = calcular_economia_quantidades(preco_normal, qtd_compra, qtd_pague)
    
    # Determinar tipo de oferta
    tipo_preco = ""
    if preco_clube_str and preco_clube_str.strip() and preco_clube_str != "N/A":
        tipo_preco = "Preço Clube"
        
        # Calcular diferença e percentual de desconto
        diferenca = preco_normal - preco_clube if preco_normal > 0 else 0
        percentual_desconto = (diferenca / preco_normal) * 100 if preco_normal > 0 else 0
        
        detalhes_promocao = {
            'tipo': 'preco_clube',
            'preco_normal': preco_normal,
            'preco_clube': preco_clube,
            'economia': diferenca,
            'percentual_desconto': percentual_desconto
        }
        
    elif preco_str and preco_str.strip() and preco_str != "N/A":
        tipo_preco = "Preço Normal"
        # Detalhes da promoção já foram calculados acima se houver promoção especial
    else:
        tipo_preco = "Sem Preço"
    
    # Coletar dados adicionais
    dados_adicionais = {}
    for chave, valor in elementos.items():
        if chave not in ['lblDcrProduto', 'lblScanner', 'lblPreco', 'lblPrecoDC', 'lblPromoPdv'] and valor:
            dados_adicionais[chave] = valor
    
    # Montar resultado
    return {
        'ean': ean,
        'descricao': descricao,
        'codigo': codigo,
        'tipo_preco': tipo_preco,
        'preco': preco_str if preco_str != 'N/A' else None,
        'preco_clube': preco_clube_str if preco_clube_str != 'N/A' else None,
        'promocao': tipo_promocao if tem_promocao_especial else None,
        'detalhes_promocao': detalhes_promocao,
        'calculos_quantidades': calculos_quantidades,
        'dados_adicionais': dados_adicionais
    }

# Função para formatar a saída de um produto
def formatar_saida_produto(produto):
    resultado = f"\n{'=' * 50}\n"
    resultado += f"EAN: {produto['ean']}\n"
    resultado += f"Descrição: {produto['descricao']}\n"
    resultado += f"Código interno: {produto['codigo']}\n"
    resultado += f"Tipo de preço: {produto['tipo_preco']}\n"
    
    if produto['preco']:
        resultado += f"Preço: {produto['preco']}\n"
    
    if produto['preco_clube']:
        resultado += f"Preço clube: {produto['preco_clube']}\n"
    
    if produto['promocao']:
        resultado += f"\n===== PROMOÇÃO ESPECIAL =====\n"
        resultado += f"{produto['promocao']}\n"
    
    if produto['detalhes_promocao']:
        resultado += f"\n===== DETALHES DA PROMOÇÃO =====\n"
        
        if produto['detalhes_promocao']['tipo'] == 'compre_pague':
            resultado += f"Compre {produto['detalhes_promocao']['qtd_compra']} unidades e pague {produto['detalhes_promocao']['qtd_pague']} unidades\n"
            resultado += f"Unidades grátis: {produto['detalhes_promocao']['qtd_gratis']}\n"
            resultado += f"Economia total: R$ {produto['detalhes_promocao']['economia_total']:.2f} ({produto['detalhes_promocao']['percentual_desconto']:.2f}%)\n"
            resultado += f"Valor médio por unidade: R$ {produto['detalhes_promocao']['preco_medio_unitario']:.2f}\n"
        
        elif produto['detalhes_promocao']['tipo'] == 'preco_clube':
            resultado += f"Preço normal: R$ {produto['detalhes_promocao']['preco_normal']:.2f}\n"
            resultado += f"Preço clube: R$ {produto['detalhes_promocao']['preco_clube']:.2f}\n"
            resultado += f"Economia: R$ {produto['detalhes_promocao']['economia']:.2f} ({produto['detalhes_promocao']['percentual_desconto']:.2f}%)\n"
    
    if produto['calculos_quantidades']:
        resultado += f"\n===== ECONOMIA COM DIFERENTES QUANTIDADES =====\n"
        resultado += "Qtd   | Pagas | Grátis | Valor Normal | Valor Promo  | Economia     | Economia % | Preço Médio  \n"
        resultado += "----- | ----- | ------ | ------------ | ------------ | ------------ | ---------- | ------------\n"
        
        for calc in produto['calculos_quantidades']:
            try:
                resultado += f"{calc['quantidade']:<5} | {calc['unidades_pagas']:<5} | {calc['unidades_gratis']:<6} | "
                resultado += f"R$ {calc['valor_total_normal']:.2f} | R$ {calc['valor_total_promocao']:.2f} | "
                resultado += f"R$ {calc['economia']:.2f} | {calc['percentual_economia']:.2f}% | R$ {calc['preco_medio_unitario']:.2f}\n"
            except Exception as e:
                resultado += f"Erro ao formatar linha: {e}\n"
    
    resultado += f"\n===== DADOS ADICIONAIS =====\n"
    for chave, valor in produto['dados_adicionais'].items():
        resultado += f"{chave}: {valor}\n"
    
    return resultado

# Função para gerar um relatório JSON formatado
def gerar_relatorio_json(produtos):
    return {
        'data_consulta': datetime.now().isoformat(),
        'filial': FILIAL,
        'total_produtos': len(produtos),
        'produtos': produtos
    }

# Função principal
def main():
    # Lista de EANs a consultar
    eans = [
        '7896029092347',
        '7896434920778',
        '7896045101665',
        '8711000712580',
        '7891097104886'
    ]
    
    print(f"Iniciando consulta de {len(eans)} produtos...\n")
    
    resultados = []
    
    for ean in eans:
        resultado = consultar_preco(ean, FILIAL)
        if resultado:
            produto = analisar_produto(resultado, ean)
            resultados.append(produto)
            print(formatar_saida_produto(produto))
        else:
            print(f"Não foi possível consultar o produto com EAN {ean}\n")
    
    # Gerar relatório JSON
    relatorio = gerar_relatorio_json(resultados)
    
    # Salvar relatório em arquivo JSON
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = f"relatorio_produtos_{timestamp}.json"
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=4)
    
    print(f"\nRelatório JSON salvo em: {json_path}")

if __name__ == "__main__":
    main()