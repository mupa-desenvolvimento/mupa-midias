import requests
import json
from datetime import datetime

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
    import re
    # Padrão para encontrar "COMPRA DE XX UN" e "PAGUE YY UN"
    padrao_compra = r'COMPRA DE (\d+) UN'
    padrao_pague = r'PAGUE (\d+) UN'
    
    compra = re.search(padrao_compra, texto_promocao.upper())
    pague = re.search(padrao_pague, texto_promocao.upper())
    
    qtd_compra = int(compra.group(1)) if compra else None
    qtd_pague = int(pague.group(1)) if pague else None
    
    return qtd_compra, qtd_pague

# Função para classificar o tipo de preço e calcular detalhes
def analisar_produto(resultado):
    if not resultado or 'elementos' not in resultado:
        print("Erro: Não foi possível obter informações do produto")
        return
    
    elementos = resultado['elementos']
    
    # Extrair informações básicas
    descricao = elementos.get('lblDcrProduto', 'N/A')
    codigo = elementos.get('lblScanner', 'N/A')
    preco_str = elementos.get('lblPreco', 'N/A')
    preco_clube_str = elementos.get('lblPrecoDC', 'N/A')
    promocao_pdv = elementos.get('lblPromoPdv', '')
    
    print("\n===== DETALHES DO PRODUTO =====")
    print(f"EAN: {ean}")
    print(f"Descrição: {descricao}")
    print(f"Código interno: {codigo}")
    
    # Verificar se há promoção especial
    tem_promocao_especial = False
    tipo_promocao = ""
    if promocao_pdv and promocao_pdv.strip() and promocao_pdv != "N/A":
        tem_promocao_especial = True
        tipo_promocao = promocao_pdv.strip()
    
    # Determinar tipo de oferta
    if preco_clube_str and preco_clube_str.strip():
        tipo_preco = "Preço Clube"
        
        # Converter strings de preço para valores numéricos
        try:
            preco_normal = float(preco_str.replace('R$', '').replace(',', '.').strip()) if preco_str and preco_str.strip() else 0
            preco_clube = float(preco_clube_str.replace('R$', '').replace(',', '.').strip()) if preco_clube_str and preco_clube_str.strip() else 0
            
            # Calcular diferença e percentual de desconto
            diferenca = preco_normal - preco_clube if preco_normal > 0 else 0
            percentual_desconto = (diferenca / preco_normal) * 100 if preco_normal > 0 else 0
            
            print(f"\n===== TIPO DE OFERTA: {tipo_preco} =====")
            print(f"Preço normal: {preco_str}")
            print(f"Preço clube: {preco_clube_str}")
            print(f"Economia: R$ {diferenca:.2f} ({percentual_desconto:.2f}%)")
        except Exception as e:
            print(f"Erro ao calcular valores: {e}")
            print(f"Preço normal (texto): {preco_str}")
            print(f"Preço clube (texto): {preco_clube_str}")
    
    elif preco_str and preco_str.strip():
        tipo_preco = "Preço Normal"
        print(f"\n===== TIPO DE OFERTA: {tipo_preco} =====")
        print(f"Preço: {preco_str}")
        
        if tem_promocao_especial:
            print(f"\n===== PROMOÇÃO ESPECIAL DETECTADA! =====")
            print(f"Tipo de promoção: {tipo_promocao}")
            
            # Tentar calcular economia na promoção
            try:
                preco_normal = float(preco_str.replace('R$', '').replace(',', '.').strip()) if preco_str and preco_str.strip() else 0
                qtd_compra, qtd_pague = extrair_numeros_promocao(tipo_promocao)
                
                if qtd_compra and qtd_pague and qtd_compra > qtd_pague:
                    qtd_gratis = qtd_compra - qtd_pague
                    economia = qtd_gratis * preco_normal
                    percentual_desconto = (qtd_gratis / qtd_compra) * 100
                    
                    print(f"\n===== CÁLCULO DA PROMOÇÃO =====")
                    print(f"Compre {qtd_compra} unidades e pague {qtd_pague} unidades")
                    print(f"Unidades grátis: {qtd_gratis}")
                    print(f"Valor unitário: R$ {preco_normal:.2f}")
                    print(f"Economia total: R$ {economia:.2f} ({percentual_desconto:.2f}%)")
                    print(f"Valor médio por unidade: R$ {(qtd_pague * preco_normal / qtd_compra):.2f}")
            except Exception as e:
                print(f"Não foi possível calcular detalhes da promoção: {e}")
        else:
            print("Não há oferta especial para este produto")
    
    else:
        tipo_preco = "Sem Preço"
        print(f"\n===== TIPO DE OFERTA: {tipo_preco} =====")
        print("Produto sem informação de preço disponível")
        
        if tem_promocao_especial:
            print(f"\n===== PROMOÇÃO ESPECIAL DETECTADA! =====")
            print(f"Tipo de promoção: {tipo_promocao}")
    
    # Exibir dados adicionais se disponíveis
    print("\n===== DADOS ADICIONAIS =====")
    for chave, valor in elementos.items():
        if chave not in ['lblDcrProduto', 'lblScanner', 'lblPreco', 'lblPrecoDC', 'lblPromoPdv'] and valor:
            print(f"{chave}: {valor}")

# Código de barras a consultar
ean = '8711000712580'

# Realizar consulta
resultado = consultar_preco(ean, FILIAL)

if resultado:
    analisar_produto(resultado)
else:
    print(f"Não foi possível consultar o produto com EAN {ean}")