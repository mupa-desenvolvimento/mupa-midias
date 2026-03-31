from flask import Flask, request, jsonify, send_file, render_template
from flask_jwt_extended import JWTManager, jwt_required, create_access_token
from flask_caching import Cache
from datetime import timedelta
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import requests
import os
import pytz
import traceback
import base64
import json
import re
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from config import settings
from models import ConsultaResponse, LoginRequest, TokenResponse
import threading
from queue import Queue
from PIL import Image
import io
import mysql.connector
import sqlite3
import time
import sys
import webbrowser
import pystray
from pystray import MenuItem as item
from PIL import Image
import threading
import os

# Função para acessar recursos (imagens, etc.) tanto no .exe quanto no modo desenvolvimento
def resource_path(relative_path):
    """Obtém o caminho absoluto para o recurso, considerando se está rodando como .exe ou não."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = settings.jwt_secret_key
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(seconds=settings.jwt_access_token_expires)
jwt = JWTManager(app)

# Configuração do cache
"""
Implementação de cache para melhorar a performance das requisições.

O cache utiliza SimpleCache (em memória) com tempo de expiração padrão de 5 minutos.
Para rotas específicas, os tempos de cache são configurados individualmente:
- Rotas de template: 1 hora (3600 segundos)
- Dashboard data: 60 segundos
- Últimas consultas e logs: 30 segundos com query string
- Exportação de relatórios: 5 minutos com query string
- Atualizações: 60 segundos

O cache é limpo automaticamente após operações de escrita como:
- Upload de arquivos
- Registro de entrada/saída
- Recebimento de webhooks

O cache também pode ser limpo manualmente através da rota /api/limpar-cache
"""
cache_config = {
    "CACHE_TYPE": "SimpleCache",  # Tipo de cache em memória
    "CACHE_DEFAULT_TIMEOUT": 300  # Tempo padrão de expiração em segundos (5 minutos)
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# Função para limpar o cache de uma rota específica
def limpar_cache_rota(rota):
    """Limpa o cache de uma rota específica"""
    try:
        cache.delete_memoized(rota)
        print(f"Cache da rota {rota.__name__} limpo com sucesso")
    except Exception as e:
        print(f"Erro ao limpar cache: {str(e)}")

# Função para limpar todo o cache
def limpar_todo_cache():
    """Limpa todo o cache da aplicação"""
    try:
        cache.clear()
        print("Todo o cache foi limpo com sucesso")
    except Exception as e:
        print(f"Erro ao limpar todo o cache: {str(e)}")

# Modelos Pydantic
class User(BaseModel):
    username: str
    password: str

class ProductInfo(BaseModel):
    ean: str
    filial: str
    tipo: str
    html_content: Optional[str] = None
    elementos: Dict[str, Any]

class ElementInfo(BaseModel):
    text: Optional[str] = None
    style: Optional[str] = None
    id: Optional[str] = None
    class_: Optional[List[str]] = Field(None, alias='class')
    html: Optional[str] = None

# Usuário e senha (hardcoded para simplificar, em um ambiente real, use um método mais seguro)
valid_user = {
    'username': 'api-unidasul@mupa.app',
    'password': '#Mupa@04051623$'
}

# Configurações da API Mupa
MUPA_API_URL = 'http://srv-mupa.ddns.net:5050'
MUPA_LOGIN = {
    'username': 'antunes@mupa.app',
    'password': '#Mupa04051623$'
}

# Lista para armazenar produtos sem imagem
PRODUTOS_SEM_IMAGEM = []

# Fila para armazenar resultados de downloads em background
download_queue = Queue()

# Lista para armazenar consultas
CONSULTAS_HISTORICO = []
MAX_HISTORICO = 1000  # Número máximo de consultas a serem armazenadas

# Lista para armazenar logs
SISTEMA_LOGS = []
MAX_LOGS = 1000  # Número máximo de logs a serem armazenados

# Configuração do SQLite
def init_db():
    conn = sqlite3.connect('mupa.db')
    c = conn.cursor()
    
    # Tabela de consultas
    c.execute('''
        CREATE TABLE IF NOT EXISTS consultas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_hora DATETIME,
            ean TEXT,
            descricao TEXT,
            filial INTEGER,
            tipo TEXT,
            preco REAL,
            preco_clube REAL,
            device_info TEXT
        )
    ''')
    
    # Tabela de logs
    c.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_hora DATETIME,
            nivel TEXT,
            mensagem TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

# Fila para processamento em background
background_queue = Queue()

def process_background_queue():
    while True:
        try:
            task = background_queue.get()
            if task['type'] == 'consulta':
                save_consulta(task['data'])
            elif task['type'] == 'log':
                save_log(task['data'])
            background_queue.task_done()
        except Exception as e:
            print(f"Erro no processamento em background: {str(e)}")

def save_consulta(data):
    conn = sqlite3.connect('mupa.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO consultas (data_hora, ean, descricao, filial, tipo, preco, preco_clube, device_info)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['data_hora'],
        data['ean'],
        data['descricao'],
        data['filial'],
        data['tipo'],
        data['preco'],
        data['preco_clube'],
        json.dumps(data['device_info'])
    ))
    conn.commit()
    conn.close()

def save_log(data):
    conn = sqlite3.connect('mupa.db')
    c = conn.cursor()
    c.execute('''
        INSERT INTO logs (data_hora, nivel, mensagem)
        VALUES (?, ?, ?)
    ''', (data['data_hora'], data['nivel'], data['mensagem']))
    conn.commit()
    conn.close()

# Inicializar o banco de dados
init_db()

# Iniciar thread de processamento em background
background_thread = threading.Thread(target=process_background_queue, daemon=True)
background_thread.start()

# Funções auxiliares
def extract_text_or_none(element, strip_empty=True):
    """Extrai texto de um elemento, retornando None se vazio ou não existir"""
    if not element:
        return None
    text = element.get_text(strip=True)
    if strip_empty and (not text or text == 'N/A' or text == ''):
        return None
    return text

def is_internet_available():
    try:
        response = requests.get("http://www.google.com", timeout=5)
        response.raise_for_status()
        return True
    except requests.RequestException:
        return False

def download_and_save_image(codigo_produto):
    if not is_internet_available():
        return os.path.join(IMG_PRODUTOS_DIR, 'sem_imagem.png')

    image_url = f'https://sabancoimagenspng.blob.core.windows.net/png1000x1000/{codigo_produto}_1.png?sp=rl&st=2025-09-16T14:13:08Z&se=2026-03-16T22:28:08Z&spr=https&sv=2024-11-04&sr=c&sig=55doi7f%2F1M89ZfIPim7tR98%2BHEZJOWr8Ll5ygGkvqMg%3D'

    response = requests.get(image_url)

    if response.status_code == 200:
        if not os.path.exists(IMG_PRODUTOS_DIR):
            os.makedirs(IMG_PRODUTOS_DIR)
        image_path = os.path.join(IMG_PRODUTOS_DIR, f'{codigo_produto}.png')

        with open(image_path, 'wb') as img_file:
            img_file.write(response.content)

        return image_path
    else:
        return os.path.join(IMG_PRODUTOS_DIR, 'sem_imagem.png')

def get_image_path(codigo_produto):
    return os.path.join(IMG_PRODUTOS_DIR, f'{codigo_produto}.png')

def get_default_image_path():
    return os.path.join(IMG_PRODUTOS_DIR, 'sem_imagem.png')

def extract_element_info(element):
    """Extrai informações completas de um elemento, incluindo texto e estilo"""
    if not element:
        return None
    
    # Extrai o texto e remove o "R$" se presente
    text = element.get_text(strip=True) if element else None
    if text and text.startswith('R$'):
        text = text[2:].strip()
    
    return {
        "text": text,
        "style": element.get('style', None),
        "id": element.get('id', None),
        "class": element.get('class', None),
        "html": str(element)
    }

def normalize_scanner_text(text: str) -> str:
    if not text:
        return text
    cleaned = text.strip()
    cleaned = re.sub(r'^\.\.:::+\s*', '', cleaned)
    cleaned = re.sub(r'\s*:::\.\.$', '', cleaned)
    return cleaned.strip()

def find_main_content(soup):
    """Tenta encontrar o conteúdo principal de várias formas"""
    # Tentar pelos IDs conhecidos
    for div_id in ['upConsulta', 'up1Consulta', 'UpdatePanel1']:
        content = soup.find('div', {'id': div_id})
        if content:
            return content
    
    # Tentar pelo form principal
    form = soup.find('form', {'name': 'form1'})
    if form:
        main_div = form.find('div', {'class': 'main'})
        if main_div:
            return main_div
    
    # Tentar encontrar pela div que contém os elementos principais
    elementos = {
        'descricao': soup.find('span', {'id': 'lblDcrProduto'}),
        'preco': soup.find('span', {'id': 'lblPreco'}),
        'preco_clube': soup.find('span', {'id': 'lblPrecoDC'}),
        'scanner': soup.find('span', {'id': 'lblScanner'}),
        'codigo': soup.find('span', {'id': 'lblCodProduto'})
    }
    
    # Se encontrou algum elemento, procurar o pai comum
    elementos_encontrados = [elem for elem in elementos.values() if elem]
    if elementos_encontrados:
        # Pegar o primeiro elemento como referência
        elemento = elementos_encontrados[0]
        # Procurar o pai que contém todos os elementos
        while elemento:
            if all(str(elem) in str(elemento) for elem in elementos_encontrados):
                return elemento
            elemento = elemento.parent
    
    return None

def get_mupa_token():
    """Obtém o token de autenticação da API Mupa usando form-urlencoded"""
    try:
        msg_inicio = f"Fazendo login na Mupa: {MUPA_API_URL}/login com usuário {MUPA_LOGIN['username']}"
        print(f"[DEBUG] {msg_inicio}")
        registrar_log(msg_inicio)
        response = requests.post(
            f'{MUPA_API_URL}/login',
            data={
                'username': MUPA_LOGIN['username'],
                'password': MUPA_LOGIN['password']
            },
            headers={
    'accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
}
        )
        msg_status = f"Status login: {response.status_code}"
        print(f"[DEBUG] {msg_status}")
        registrar_log(msg_status)
        msg_resp = f"Resposta login: {response.text}"
        print(f"[DEBUG] {msg_resp}")
        registrar_log(msg_resp)
        response.raise_for_status()
        token = response.json().get('access_token')
        if token:
            registrar_log("Token obtido com sucesso da Mupa")
        else:
            registrar_log("Token NÃO foi obtido da Mupa", 'error')
        return token
    except Exception as e:
        msg_erro = f"Erro ao obter token Mupa: {str(e)}"
        print(msg_erro)
        registrar_log(msg_erro, 'error')
        return None

def registrar_produto_sem_imagem(ean, descricao=None):
    """Registra um produto sem imagem na lista"""
    global PRODUTOS_SEM_IMAGEM
    
    # Verifica se o produto já está na lista
    if not any(p['ean'] == ean for p in PRODUTOS_SEM_IMAGEM):
        PRODUTOS_SEM_IMAGEM.append({
            'ean': ean,
            'descricao': descricao,
            'data_registro': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        # Salva a lista atualizada no arquivo
        with open('produtos_sem_imagem.json', 'w', encoding='utf-8') as f:
            json.dump(PRODUTOS_SEM_IMAGEM, f, ensure_ascii=False, indent=4)

def download_mupa_image(ean, descricao=None, max_retries=3):
    """Download e salva a imagem do produto, agora usando o Azure Blob Storage em vez da API Mupa."""
    try:
        print(f"INICIANDO download da imagem para o EAN {ean}")
        img_dir = IMG_PRODUTOS_DIR
        if not os.path.exists(img_dir):
            os.makedirs(img_dir)
            registrar_log(f"Diretório de imagens criado: {img_dir}")
        image_path = os.path.join(img_dir, f'{ean}.png')
        if os.path.exists(image_path):
            print(f"Imagem já existe para o EAN {ean}")
            registrar_log(f"Imagem já existe para o EAN {ean}")
            return image_path
            
        # Usar o novo link do Azure Blob Storage
        image_url = f'https://sabancoimagenspng.blob.core.windows.net/png1000x1000/{ean}_1.png?sp=rl&st=2025-09-16T14:13:08Z&se=2026-03-16T22:28:08Z&spr=https&sv=2024-11-04&sr=c&sig=55doi7f%2F1M89ZfIPim7tR98%2BHEZJOWr8Ll5ygGkvqMg%3D'
        print(f"Baixando imagem do Azure Blob Storage para o EAN {ean}")
        registrar_log(f"Baixando imagem do Azure Blob Storage para o EAN {ean}")
        
        try:
            response = requests.get(image_url, timeout=60)
            if response.status_code == 200:
                with open(image_path, 'wb') as f:
                    f.write(response.content)
                print(f"Imagem baixada do Azure e salva para EAN {ean} em {image_path} ({os.path.getsize(image_path)} bytes)")
                registrar_log(f"Imagem baixada do Azure e salva para EAN {ean}")
                return image_path
        except Exception as e:
            print(f"Erro ao baixar imagem do Azure para o EAN {ean}: {str(e)}")
            registrar_log(f"Erro ao baixar imagem do Azure para o EAN {ean}: {str(e)}", 'error')
        
        # Se chegou aqui, não conseguiu baixar do Azure, tenta o método antigo da Mupa como fallback
        token = get_mupa_token()
        if not token:
            print(f"Erro ao obter token Mupa para o EAN {ean}")
            registrar_log(f"Erro ao obter token Mupa para o EAN {ean}", 'error')
            registrar_produto_sem_imagem(ean, descricao)
            return None
        for attempt in range(max_retries):
            try:
                print(f"Iniciando tentativa {attempt + 1}/{max_retries} para o EAN {ean}")
                registrar_log(f"Iniciando tentativa {attempt + 1}/{max_retries} para o EAN {ean}")
                response = requests.get(
                    f'{MUPA_API_URL}/produto-imagem/{ean}',
                    headers={
                        'Authorization': f'Bearer {token}',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout=60
                )
                print(f"Resposta recebida para o EAN {ean}: {response.status_code}")
                registrar_log(f"Resposta recebida para o EAN {ean}: {response.status_code}")
                if response.status_code == 200:
                    content_type = response.headers.get('Content-Type', '')
                    print(f"Tipo de conteúdo da resposta para o EAN {ean}: {content_type}")
                    registrar_log(f"Tipo de conteúdo da resposta para o EAN {ean}: {content_type}")
                    # Caso 1: resposta já é imagem
                    if content_type.startswith('image/'):
                        print(f"Salvando imagem para o EAN {ean}")
                        registrar_log(f"Salvando imagem para o EAN {ean}")
                        with open(image_path, 'wb') as f:
                            f.write(response.content)
                        print(f"Imagem salva com sucesso para o EAN {ean}")
                        registrar_log(f"Imagem salva com sucesso para o EAN {ean}")
                        return image_path
                    # Caso 2: resposta é JSON com imagem_url
                    elif 'application/json' in content_type:
                        print(f"Resposta é JSON para o EAN {ean}")
                        registrar_log(f"Resposta é JSON para o EAN {ean}")
                        data = response.json()
                        image_url = data.get('imagem_url')
                        if image_url:
                            print(f"Baixando imagem via imagem_url para o EAN {ean}")
                            registrar_log(f"Baixando imagem via imagem_url para o EAN {ean}")
                            # Normaliza barras invertidas para barras normais
                            image_url = image_url.replace('\\', '/')
                            print(f"[DEBUG] Baixando via imagem_url: {image_url}")
                            try:
                                img_response = requests.get(image_url, timeout=60)
                                print(f"[DEBUG] Status img_url: {img_response.status_code}, Content-Type: {img_response.headers.get('Content-Type')}")
                                if img_response.status_code == 200 and img_response.headers.get('Content-Type', '').startswith('image/'):
                                    with open(image_path, 'wb') as f:
                                        f.write(img_response.content)
                                    print(f"[DEBUG] Imagem baixada via imagem_url e salva para EAN {ean} em {image_path} ({os.path.getsize(image_path)} bytes)")
                                    registrar_log(f"Imagem baixada via imagem_url e salva para EAN {ean}")
                                    return image_path
                                else:
                                    registrar_log(f"Falha ao baixar imagem da imagem_url para EAN {ean}: Status {img_response.status_code}", 'error')
                                    print(f"[DEBUG] Falha ao baixar imagem da imagem_url para EAN {ean}: Status {img_response.status_code}")
                            except Exception as e:
                                import traceback
                                print(f"[DEBUG] Exceção ao baixar imagem da imagem_url para EAN {ean}: {str(e)}")
                                print(traceback.format_exc())
                                registrar_log(f"Exceção ao baixar imagem da imagem_url para EAN {ean}: {str(e)}", 'error')
                        else:
                            print(f"imagem_url não encontrada no JSON para o EAN {ean}")
                            registrar_log(f"imagem_url não encontrada no JSON para o EAN {ean}", 'error')
                # Se chegou aqui, tenta novamente ou registra erro
                if attempt < max_retries - 1:
                    print(f"Tentativa {attempt + 1} falhou para o EAN {ean}, aguardando 2 segundos...")
                    registrar_log(f"Tentativa {attempt + 1} falhou para o EAN {ean}, aguardando 2 segundos...")
                    time.sleep(2)
                    continue
                print(f"Todas as tentativas falharam para o EAN {ean}")
                registrar_log(f"Todas as tentativas falharam para o EAN {ean}", 'error')
                registrar_produto_sem_imagem(ean, descricao)
                return None
            except Exception as e:
                print(f"Erro inesperado ao baixar imagem para o EAN {ean}: {str(e)}")
                registrar_log(f"Erro inesperado ao baixar imagem para o EAN {ean}: {str(e)}", 'error')
                if attempt < max_retries - 1:
                    print(f"Tentativa {attempt + 1} falhou para o EAN {ean} devido a erro inesperado, aguardando 2 segundos...")
                    registrar_log(f"Tentativa {attempt + 1} falhou para o EAN {ean} devido a erro inesperado, aguardando 2 segundos...")
                    time.sleep(2)
                    continue
                registrar_produto_sem_imagem(ean, descricao)
                return None
    except Exception as e:
        print(f"Erro inesperado ao baixar imagem Mupa para o EAN {ean}: {str(e)}")
        registrar_log(f"Erro inesperado ao baixar imagem Mupa para o EAN {ean}: {str(e)}", 'error')
        registrar_produto_sem_imagem(ean, descricao)
        return None

def download_image_background(ean, descricao):
    """Função para download de imagem em background usando Azure Blob Storage"""
    try:
        print(f"[BG] INICIANDO download em background para EAN {ean}")
        registrar_log(f"Iniciando processo de download em background para EAN {ean}")
        
        # Verifica se a imagem já existe
        image_path = os.path.join(IMG_PRODUTOS_DIR, f'{ean}.png')
        if os.path.exists(image_path):
            registrar_log(f"Imagem já existe para o EAN {ean}")
            download_queue.put((ean, image_path))
            print(f"[BG] Download em background FINALIZADO (imagem já existia) para EAN {ean}")
            return

        # Se não existe, tenta baixar do Azure Blob Storage
        image_path = download_mupa_image(ean, descricao)
        if image_path:
            registrar_log(f"Download concluído com sucesso do Azure Blob Storage para EAN {ean}")
            download_queue.put((ean, image_path))
            print(f"[BG] Download em background FINALIZADO com sucesso para EAN {ean}")
        else:
            registrar_log(f"Falha no download da imagem do Azure Blob Storage para EAN {ean}", 'error')
            download_queue.put((ean, None))
            print(f"[BG] Download em background FALHOU para EAN {ean}")
            
    except Exception as e:
        registrar_log(f"Erro inesperado no download em background para EAN {ean}: {str(e)}", 'error')
        download_queue.put((ean, None))
        print(f"[BG] Download em background ERRO inesperado para EAN {ean}: {str(e)}")
        print(f"[BG] Download em background FINALIZADO com erro para EAN {ean}")

def registrar_consulta(ean, filial, descricao, preco, preco_clube=None, device_info=None):
    """Registra uma consulta no histórico"""
    global CONSULTAS_HISTORICO
    consulta = {
        'data_hora': datetime.now().isoformat(),
        'ean': ean,
        'filial': filial,
        'descricao': descricao,
        'preco': preco,
        'preco_clube': preco_clube,
        'device_info': device_info or {}
    }
    CONSULTAS_HISTORICO.insert(0, consulta)
    if len(CONSULTAS_HISTORICO) > MAX_HISTORICO:
        CONSULTAS_HISTORICO = CONSULTAS_HISTORICO[:MAX_HISTORICO]

def registrar_log(mensagem, nivel='info'):
    """Registra um log do sistema e salva também em arquivo sistema.log"""
    global SISTEMA_LOGS
    log = {
        'timestamp': datetime.now().isoformat(),
        'message': mensagem,
        'level': nivel
    }
    SISTEMA_LOGS.insert(0, log)
    if len(SISTEMA_LOGS) > MAX_LOGS:
        SISTEMA_LOGS = SISTEMA_LOGS[:MAX_LOGS]
    # Salva também no arquivo de log
    try:
        with open('sistema.log', 'a', encoding='utf-8') as f:
            f.write(f"[{log['timestamp']}] [{nivel.upper()}] {mensagem}\n")
    except Exception as e:
        print(f"[ERRO] Falha ao registrar log em arquivo: {str(e)}")

# Criar tabela de logs se não existir
def create_logs_table():
    conn = sqlite3.connect('mupa.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            tipo TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            detalhes TEXT
        )
    ''')
    conn.commit()
    conn.close()

# Chamar a função para criar a tabela
create_logs_table()

# Rotas
@app.route("/")
@cache.cached(timeout=3600)  # Cache por 1 hora
def index():
    """Página inicial do sistema"""
    return render_template("index.html")

@app.route("/admin")
@cache.cached(timeout=3600)  # Cache por 1 hora
def admin():
    """Página de consulta de produtos"""
    return render_template("admin.html")

@app.route("/consulta")
@cache.cached(timeout=3600)  # Cache por 1 hora
def consulta():
    """Página de consulta de produtos"""
    return render_template("consulta.html")

@app.route("/dashboard")
@cache.cached(timeout=3600)  # Cache por 1 hora
def dashboard():
    """Página do dashboard"""
    return render_template("dashboard.html")

@app.route("/consultas_hora")
@cache.cached(timeout=3600)  # Cache por 1 hora
def consultas_hora():
    """Página de consultas por hora"""
    return render_template("consultas_hora.html")

@app.route("/ultimas_consultas")
@cache.cached(timeout=3600)  # Cache por 1 hora
def ultimas_consultas():
    """Página de últimas consultas"""
    return render_template("ultimas_consultas.html")

@app.route("/logs")
def logs():
    """Página de logs do sistema"""
    return render_template("logs.html")

@app.route("/relatorios")
def relatorios():
    """Página de exportação de relatórios"""
    return render_template("relatorios.html")

@app.route("/api/consulta/<ean>/<num_filial>")
def consulta_produto(ean, num_filial):
    try:
        # Formata o número da filial para ter 3 dígitos
        num_filial = str(num_filial).zfill(3)
        
        # Constrói a URL
        url = f"http://www.unidasul.com.br/consulta_preco.aspx?filial={num_filial}"
        
        # Headers necessários
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Faz a requisição POST
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        
        # Salva o HTML completo para debug
        os.makedirs("debug_html", exist_ok=True)
        with open(f"debug_html/{ean}_f{num_filial}_full.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        
        # Parse do HTML
        soup = BeautifulSoup(response.text, "html.parser")
        
        try:
            content = find_main_content(soup)
        except ValueError as e:
            return ConsultaResponse(
                success=False,
                ean=ean,
                filial=num_filial,
                tipo="ERRO",
                dados={},
                error=str(e),
                html=response.text[:1000]  # Primeiros 1000 caracteres para debug
            ).model_dump()
        
        # Extrai os elementos
        img = content.find("img", id="imgProduto")
        descricao = content.find("span", id="lblDescricao")
        preco = content.find("span", id="lblPreco")
        preco_clube = content.find("span", id="lblPrecoClube")
        codigo = content.find("span", id="lblCodigo")
        scanner = content.find("span", id="lblScanner")
        inputs = content.find_all("input")
        
        # Verifica se é terminal de consulta
        tipo = "TERMINAL_CONSULTA" if scanner and "TERMINAL DE CONSULTA" in scanner.get_text() else "PRODUTO"
        
        # Monta a resposta
        dados = {
            "imagem": extract_element_info(img),
            "descricao": extract_element_info(descricao),
            "preco": extract_element_info(preco),
            "preco_clube": extract_element_info(preco_clube),
            "codigo": extract_element_info(codigo),
            "scanner": extract_element_info(scanner),
            "inputs": [extract_element_info(input) for input in inputs]
        }
        
        # Salva o HTML processado para debug
        with open(f"debug_html/{ean}_f{num_filial}_processed.html", "w", encoding="utf-8") as f:
            f.write(str(content))
        
        return ConsultaResponse(
            success=True,
            ean=ean,
            filial=num_filial,
            tipo=tipo,
            dados=dados,
            html=str(content)
        ).model_dump()
        
    except Exception as e:
        return ConsultaResponse(
            success=False,
            ean=ean,
            filial=num_filial,
            tipo="ERRO",
            dados={},
            error=str(e)
        ).model_dump()

@app.route('/get_price', methods=['GET'])
def get_price():
    """Rota alternativa para consulta de preços"""
    try:
        ean = request.args.get('ean')
        num_filial = request.args.get('num_filial')
        format_type = request.args.get('format', 'html')  # Novo parâmetro para formato de resposta
        
        if not ean or not num_filial:
            return jsonify({
                'error': 'Parâmetros EAN e num_filial são obrigatórios'
            }), 400
        
        # Se o formato solicitado for JSON, usar a nova função
        if format_type.lower() == 'json':
            return get_product_json(ean, num_filial)
        else:
            return get_product_html(ean, num_filial)
    except Exception as e:
        return jsonify({
            'error': 'Erro ao processar requisição',
            'details': str(e)
        }), 500

@app.route('/get_price_html/<ean>/<num_filial>', methods=['GET'])
def get_product_html(ean, num_filial):
    """Rota para consulta de preços"""
    try:
        print(f"\nIniciando consulta para EAN {ean} na filial {num_filial}")
        
        # Obtém informações do dispositivo
        user_agent = request.headers.get('User-Agent', 'Desconhecido')
        ip_address = request.remote_addr
        device_info = {
            'user_agent': user_agent,
            'ip_address': ip_address,
            'timestamp': datetime.now().isoformat()
        }
        
        # Formata o número da filial para garantir que tenha 3 dígitos
        num_filial = str(num_filial).zfill(3)
        
        # Construa a URL
        url = f"http://f{num_filial}srv01.filial.unidasul.local/webprice/"
        print(f"URL da consulta: {url}")
        
        # Headers necessários para ASP.NET
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        
        # Primeiro request para obter o __VIEWSTATE
        print("Obtendo VIEWSTATE...")
        response_inicial = requests.get(url, headers=headers, timeout=10)
        response_inicial.raise_for_status()
        
        soup_inicial = BeautifulSoup(response_inicial.text, 'html.parser')
        viewstate = soup_inicial.find('input', {'name': '__VIEWSTATE'})
        
        if not viewstate:
            print("Erro: VIEWSTATE não encontrado na página inicial")
            return jsonify({
                'error': 'VIEWSTATE não encontrado',
                'details': 'Não foi possível obter o VIEWSTATE da página inicial',
                'device_info': device_info
            }), 500
            
        viewstate = viewstate['value']
        print("VIEWSTATE obtido com sucesso")
        
        # Dados do formulário para a consulta
        form_data = {
            "txtBarras": ean,
            "__LASTFOCUS": "",
            "__EVENTTARGET": "txtBarras",
            "__EVENTARGUMENT": "",
            "__VIEWSTATE": viewstate
        }
        
        # Fazer a requisição POST simulando o preenchimento do campo
        print("Enviando requisição POST...")
        response = requests.post(url, data=form_data, headers=headers, timeout=10)
        response.raise_for_status()
        print("Resposta POST recebida com sucesso")
        
        # Parsear o HTML da resposta
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extrair todos os elementos da página
        elementos = {}
        for elemento in soup.find_all(['span', 'div', 'input']):
            if elemento.get('id'):
                id_elem = elemento.get('id')
                texto = elemento.get_text(strip=True)
                if id_elem == 'lblPreco':
                    # Remove o 'R$' apenas do lblPreco
                    if texto.startswith('R$'):
                        texto = texto[2:].strip()
                elif id_elem == 'lblScanner':
                    texto = normalize_scanner_text(texto)
                # Para lblPrecoDC e lblPrecoDC2, mantém o valor original (com ou sem 'R$')
                elementos[id_elem] = texto

        scanner = elementos.get('lblScanner')
        promo = elementos.get('lblPromoPdv')
        if promo:
            promo = promo.strip()
        if scanner:
            scanner = scanner.strip()
        if promo and promo != 'N/A':
            if scanner and scanner != 'N/A':
                if promo not in scanner:
                    elementos['lblScanner'] = f"{scanner}\n{promo}"
            else:
                elementos['lblScanner'] = promo
        
        # Adiciona o EAN aos elementos
        elementos['ean'] = ean
        
        # Verificar se a imagem já existe
        image_path = os.path.join(IMG_PRODUTOS_DIR, f'{ean}.png')
        
        # Obtém a URL base do servidor
        server_url = request.host_url.rstrip('/')
        
        # Verifica se a imagem existe
        if os.path.exists(image_path):
            imagem_url = f"{server_url}/imgs_produtos/{ean}.png"
            imagem_status = 'disponivel'
        else:
            imagem_url = None
            imagem_status = 'indisponivel'
        
        # Dispara o download da imagem em background, sem interferir na resposta
        try:
            descricao = elementos.get('lblDcrProduto')
            threading.Thread(target=download_image_background, args=(ean, descricao), daemon=True).start()
        except Exception as e:
            registrar_log(f"[IMG][AUTO][BG] Erro ao iniciar thread para baixar imagem do EAN {ean}: {str(e)}", 'error')

        # Preparar o resultado
        resultado = {
            'success': True,
            'elementos': elementos,
            'imagem_url': imagem_url,
            'imagem_status': imagem_status,
            'device_info': device_info
        }
        
        print("Consulta finalizada com sucesso")
        
        # Após obter os dados com sucesso, registra a consulta
        if resultado.get('success'):
            registrar_consulta(
                ean=ean,
                filial=num_filial,
                descricao=elementos.get('lblDcrProduto'),
                preco=elementos.get('lblPreco'),
                preco_clube=elementos.get('lblPrecoDC'),
                device_info=device_info
            )
            registrar_log(f"Consulta realizada: EAN {ean} na filial {num_filial} pelo dispositivo {user_agent}")
        
        return jsonify(resultado)
        
    except requests.exceptions.ConnectionError as e:
        print(f"Erro de conexão: {str(e)}")
        return jsonify({
            'error': f'Não foi possível conectar ao servidor da filial {num_filial}.',
            'details': str(e),
            'device_info': device_info
        }), 503
    except requests.exceptions.Timeout as e:
        print(f"Erro de timeout: {str(e)}")

@app.route('/get_price_json/<ean>/<num_filial>', methods=['GET'])
def get_product_json(ean, num_filial):
    """Rota para consulta de preços com retorno em JSON incluindo informações de promoção"""
    try:
        print(f"\nIniciando consulta JSON para EAN {ean} na filial {num_filial}")
        
        # Obtém informações do dispositivo
        user_agent = request.headers.get('User-Agent', 'Desconhecido')
        ip_address = request.remote_addr
        device_info = {
            'user_agent': user_agent,
            'ip_address': ip_address,
            'timestamp': datetime.now().isoformat()
        }
        
        # Primeiro obtém os dados básicos do produto usando a função existente
        resultado_base = get_product_html(ean, num_filial)
        if isinstance(resultado_base, tuple):
            # Se retornou um erro, repassa o erro
            return resultado_base
        
        # Converte o resultado para dicionário se for uma resposta JSON
        if hasattr(resultado_base, 'get_json'):
            resultado_base = resultado_base.get_json()
        
        # Verifica se há dados do produto
        if not resultado_base.get('success') or 'elementos' not in resultado_base:
            return jsonify({
                'error': 'Produto não encontrado',
                'details': 'Não foi possível obter informações do produto',
                'device_info': device_info
            }), 404
        
        elementos = resultado_base['elementos']
        
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
            import re
            
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
        
        # Montar resultado enriquecido
        resultado_enriquecido = {
            'success': True,
            'ean': ean,
            'descricao': descricao,
            'codigo': codigo,
            'tipo_preco': tipo_preco,
            'preco': preco_normal,
            'preco_str': preco_str if preco_str != 'N/A' else None,
            'preco_clube': preco_clube,
            'preco_clube_str': preco_clube_str if preco_clube_str != 'N/A' else None,
            'promocao': tipo_promocao if tem_promocao_especial else None,
            'detalhes_promocao': detalhes_promocao,
            'calculos_quantidades': calculos_quantidades,
            'elementos': elementos,
            'imagem_url': resultado_base.get('imagem_url'),
            'imagem_status': resultado_base.get('imagem_status'),
            'device_info': device_info
        }
        
        print("Consulta JSON finalizada com sucesso")
        
        # Registrar a consulta (já foi registrada pela função get_product_html)
        
        return jsonify(resultado_enriquecido)
        
    except Exception as e:
        print(f"Erro na consulta JSON: {str(e)}")
        return jsonify({
            'error': 'Erro ao processar requisição JSON',
            'details': str(e),
            'device_info': device_info if 'device_info' in locals() else {}
        }), 500
    except requests.exceptions.Timeout as e:
        print(f"Erro de timeout: {str(e)}")
        return jsonify({
            'error': f'Tempo limite excedido ao tentar conectar ao servidor da filial {num_filial}.',
            'details': str(e),
            'device_info': device_info
        }), 504
    except requests.exceptions.RequestException as e:
        print(f"Erro na requisição: {str(e)}")
        return jsonify({
            'error': f'Erro ao fazer requisição para o servidor da filial {num_filial}.',
            'details': str(e),
            'device_info': device_info
        }), 500
    except Exception as e:
        print(f"Erro inesperado: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        registrar_log(f"Erro na consulta: {str(e)}", 'error')
        return jsonify({
            'error': 'Erro interno ao processar a requisição.',
            'details': str(e),
            'traceback': traceback.format_exc(),
            'device_info': device_info
        }), 500

@app.route('/imgs_produtos/<ean>')
@app.route('/imgs_produtos/<ean>.<ext>')
def get_product_image(ean, ext=None):
    """Rota para servir as imagens dos produtos"""
    try:
        registrar_log(f"[IMG] Início da requisição de imagem para EAN {ean}")
        # Todas as imagens são mantidas com extensão .png
        image_path_png = os.path.join(IMG_PRODUTOS_DIR, f'{ean}.png')
        
        if os.path.exists(image_path_png):
            registrar_log(f"[IMG] Imagem PNG encontrada localmente para EAN {ean}")
            return send_file(image_path_png, mimetype='image/png')
        else:
            registrar_log(f"[IMG] Imagem não encontrada localmente para EAN {ean}, tentando baixar do Azure Blob Storage...")
            # Tenta baixar do Azure Blob Storage
            image_path = download_mupa_image(ean)
            if image_path and os.path.exists(image_path):
                registrar_log(f"[IMG] Imagem baixada do Azure Blob Storage para EAN {ean}")
                return send_file(image_path, mimetype='image/png')
            registrar_log(f"[IMG] Imagem NÃO encontrada para EAN {ean} nem local nem no Azure Blob Storage", 'error')
            return jsonify({
                'error': 'Imagem não encontrada',
                'details': f'Não foi encontrada imagem para o EAN {ean} nem no Azure Blob Storage'
            }), 404
    except Exception as e:
        msg_erro = f"[IMG] Erro ao servir imagem para EAN {ean}: {str(e)}"
        print(msg_erro)
        registrar_log(msg_erro, 'error')
        return jsonify({
            'error': 'Erro ao servir imagem',
            'details': str(e)
        }), 500

@app.route('/produtos-sem-imagem', methods=['GET'])
def listar_produtos_sem_imagem():
    """Rota para listar produtos sem imagem"""
    try:
        # Carrega a lista do arquivo se existir
        if os.path.exists('produtos_sem_imagem.json'):
            with open('produtos_sem_imagem.json', 'r', encoding='utf-8') as f:
                produtos = json.load(f)
        else:
            produtos = PRODUTOS_SEM_IMAGEM
            
        return jsonify({
            'total': len(produtos),
            'produtos': produtos
        })
    except Exception as e:
        return jsonify({
            'error': 'Erro ao listar produtos sem imagem',
            'details': str(e)
        }), 500

@app.route('/generate-token', methods=['POST'])
def generate_token():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Check if the provided credentials are valid
    if username == valid_user['username'] and password == valid_user['password']:
        # Set the time zone to Brazil
        brazil_tz = pytz.timezone('America/Sao_Paulo')

        # Generate an access token with expiration time set to 30 minutes
        expiration_time = datetime.utcnow() + timedelta(minutes=30)
        expiration_time = expiration_time.replace(tzinfo=pytz.utc).astimezone(brazil_tz)

        access_token = create_access_token(identity=username, expires_delta=timedelta(minutes=30))

        # Return expiration time in the response body
        return {'access_token': access_token, 'expires_at': expiration_time.strftime('%Y-%m-%dT%H:%M:%S %Z')}, 200
    else:
        return {'message': 'Invalid credentials'}, 401

@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = LoginRequest(**request.get_json())
        # Aqui você implementaria a lógica de autenticação
        # Por enquanto, vamos aceitar qualquer usuário/senha
        access_token = create_access_token(identity=data.username)
        return TokenResponse(access_token=access_token).model_dump()
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/imagem-status/<ean>')
def check_image_status(ean):
    """Verifica o status do download da imagem"""
    try:
        # Verifica se a imagem existe (apenas extensão .png é suportada)
        image_path = os.path.join(IMG_PRODUTOS_DIR, f'{ean}.png')
        image_ext = 'png'
        
        if os.path.exists(image_path):
            image_path = image_path
        else:
            image_path = None
        
        if image_path:
            return jsonify({
                'status': 'disponivel',
                'imagem_url': f'{server_url}/imgs_produtos/{ean}{image_ext}',
                'imagem_extensao': image_ext
            })
        
        # Verifica se há resultado na fila
        while not download_queue.empty():
            queue_ean, queue_path = download_queue.get()
            if queue_ean == ean:
                if queue_path:
                    # Extrai a extensão do arquivo
                    _, ext = os.path.splitext(queue_path)
                    return jsonify({
                        'status': 'disponivel',
                        'imagem_url': f'{server_url}/imgs_produtos/{ean}{ext}',
                        'imagem_extensao': ext[1:]  # Remove o ponto da extensão
                    })
                else:
                    return jsonify({
                        'status': 'erro',
                        'mensagem': 'Erro ao baixar imagem'
                    })
        
        # Se não encontrou na fila e não existe, verifica se está na lista de produtos sem imagem
        if any(p['ean'] == ean for p in PRODUTOS_SEM_IMAGEM):
            return jsonify({
                'status': 'erro',
                'mensagem': 'Produto sem imagem disponível'
            })
        
        # Se não encontrou nada, o download ainda está em andamento
        return jsonify({
            'status': 'download_em_andamento'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'erro',
            'mensagem': str(e)
        }), 500

@app.route('/api/dashboard-data', methods=['GET'])
@cache.cached(timeout=60)  # Cache por 60 segundos
def dashboard_data():
    """API para fornecer dados ao dashboard"""
    try:
        # Calcula estatísticas
        hoje = datetime.now().date()
        consultas_hoje = len([c for c in CONSULTAS_HISTORICO 
                            if datetime.fromisoformat(c['data_hora']).date() == hoje])
        
        # Calcula consultas por hora
        consultas_por_hora = {}
        for consulta in CONSULTAS_HISTORICO:
            hora = datetime.fromisoformat(consulta['data_hora']).strftime('%H:00')
            consultas_por_hora[hora] = consultas_por_hora.get(hora, 0) + 1
        
        # Encontra a hora mais ativa
        hora_mais_ativa = max(consultas_por_hora.items(), key=lambda x: x[1])[0] if consultas_por_hora else '--:--'
        
        # Prepara dados para o gráfico
        horas_ordenadas = sorted(consultas_por_hora.items())
        consultas_por_hora_data = [{'hora': h, 'quantidade': q} for h, q in horas_ordenadas]
        
        # Prepara as últimas consultas com tipo e descrição
        ultimas_consultas = []
        for consulta in CONSULTAS_HISTORICO[:10]:
            tipo_consulta = "Preço Clube" if consulta.get('preco_clube') else "Preço Normal"
            ultimas_consultas.append({
                'data_hora': consulta['data_hora'],
                'ean': consulta['ean'],
                'filial': consulta['filial'],
                'descricao': consulta.get('descricao', 'Não disponível'),
                'tipo': tipo_consulta,
                'preco': consulta.get('preco', 'Não disponível'),
                'preco_clube': consulta.get('preco_clube', 'Não disponível')
            })
        
        return jsonify({
            'total_consultas': len(CONSULTAS_HISTORICO),
            'consultas_hoje': consultas_hoje,
            'hora_mais_ativa': hora_mais_ativa,
            'ultimas_consultas': ultimas_consultas,
            'consultas_por_hora': consultas_por_hora_data,
            'logs': SISTEMA_LOGS[:50]  # Últimos 50 logs
        })
    except Exception as e:
        registrar_log(f"Erro ao gerar dados do dashboard: {str(e)}", 'error')
        return jsonify({'error': str(e)}), 500

@app.route('/api/ultimas-consultas', methods=['GET'])
@cache.cached(timeout=30, query_string=True)  # Cache por 30 segundos, considerando os parâmetros da query
def get_ultimas_consultas():
    try:
        tipo = request.args.get('tipo', 'todos')
        periodo = request.args.get('periodo', 'hoje')
        filial = request.args.get('filial', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))

        # Construir a query base
        query = """
            SELECT 
                c.data_hora,
                c.ean,
                c.descricao,
                c.filial,
                c.tipo,
                c.preco,
                c.preco_clube
            FROM consultas c
            WHERE 1=1
        """

        # Adicionar filtros
        params = []
        if tipo == 'preco':
            query += " AND c.preco IS NOT NULL AND c.preco_clube IS NULL"
        elif tipo == 'preco_clube':
            query += " AND c.preco_clube IS NOT NULL"
        elif tipo != 'todos':
            query += " AND c.tipo = ?"
            params.append(tipo)
        
        if periodo == 'hoje':
            query += " AND DATE(c.data_hora) = DATE('now')"
        elif periodo == 'semana':
            query += " AND c.data_hora >= DATE('now', '-7 days')"
        elif periodo == 'mes':
            query += " AND c.data_hora >= DATE('now', '-30 days')"
        
        if filial and filial != 'todas':
            query += " AND c.filial = ?"
            params.append(filial)

        # Contar total de registros
        count_query = f"SELECT COUNT(*) FROM ({query}) as sub"
        conn = sqlite3.connect('mupa.db')
        c = conn.cursor()
        c.execute(count_query, params)
        total = c.fetchone()[0]

        # Adicionar ordenação e paginação
        query += " ORDER BY c.data_hora DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        # Executar a query
        c.execute(query, params)
        consultas = c.fetchall()
        conn.close()

        # Formatar os resultados
        resultados = []
        for consulta in consultas:
            tipo_consulta = "Preço Clube" if consulta[6] else "Preço Normal"
            resultados.append({
                'data_hora': consulta[0],
                'ean': consulta[1],
                'descricao': consulta[2],
                'filial': consulta[3],
                'tipo': tipo_consulta,
                'preco': float(consulta[5]) if consulta[5] else None,
                'preco_clube': float(consulta[6]) if consulta[6] else None
            })

        return jsonify({
            'status': 'success',
            'consultas': resultados,
            'pagination': {
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        registrar_log(f"Erro ao buscar últimas consultas: {str(e)}", 'error')
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/logs', methods=['GET'])
@cache.cached(timeout=30, query_string=True)  # Cache por 30 segundos, considerando os parâmetros da query
def get_logs():
    """Retorna os logs do sistema"""
    try:
        # Obter parâmetros de paginação
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Verificar se a tabela de logs existe e criar se necessário
        conn = sqlite3.connect('mupa.db')
        cursor = conn.cursor()
        
        # Verificar se a tabela existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='logs'")
        if not cursor.fetchone():
            # Criar a tabela se não existir
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
                    tipo TEXT NOT NULL,
                    mensagem TEXT NOT NULL,
                    detalhes TEXT
                )
            ''')
            conn.commit()
            
            # Inserir um log inicial
            cursor.execute('''
                INSERT INTO logs (tipo, mensagem, detalhes)
                VALUES (?, ?, ?)
            ''', ('info', 'Sistema iniciado', 'Tabela de logs criada'))
            conn.commit()
        
        # Contar total de registros
        cursor.execute('SELECT COUNT(*) FROM logs')
        total = cursor.fetchone()[0]
        
        # Se não houver registros, retornar lista vazia
        if total == 0:
            return jsonify({
                'status': 'success',
                'logs': [],
                'pagination': {
                    'total': 0,
                    'page': page,
                    'per_page': per_page,
                    'total_pages': 0
                }
            })
        
        # Buscar logs com paginação
        cursor.execute('''
            SELECT data_hora, tipo, mensagem, detalhes
            FROM logs
            ORDER BY data_hora DESC
            LIMIT ? OFFSET ?
        ''', (per_page, (page - 1) * per_page))
        logs = cursor.fetchall()
        conn.close()
        
        # Formata os logs
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                'data_hora': log[0],
                'tipo': log[1],
                'mensagem': log[2],
                'detalhes': log[3] if log[3] and len(log) > 3 else ''
            })
            
        return jsonify({
            'status': 'success',
            'logs': formatted_logs,
            'pagination': {
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page if total > 0 else 0
            }
        })
        
    except Exception as e:
        # Registrar erro sem chamar a função registrar_log para evitar recursão
        print(f"Erro ao buscar logs: {str(e)}")
        try:
            # Salvar o erro em arquivo de log diretamente
            with open('sistema.log', 'a', encoding='utf-8') as f:
                f.write(f"[{datetime.now().isoformat()}] [ERROR] Erro ao buscar logs: {str(e)}\n")
        except:
            pass
            
        # Retornar uma lista vazia em caso de erro para não quebrar a interface
        return jsonify({
            'status': 'success',
            'logs': [],
            'pagination': {
                'total': 0,
                'page': 1,
                'per_page': 10,
                'total_pages': 0
            }
        })

def log_sistema(tipo, mensagem, detalhes=None):
    """Registra um log no sistema"""
    try:
        # Adiciona à lista em memória
        SISTEMA_LOGS.insert(0, {
            'data_hora': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'tipo': tipo,
            'mensagem': mensagem,
            'detalhes': detalhes
        })
        
        # Mantém apenas os últimos MAX_LOGS registros
        if len(SISTEMA_LOGS) > MAX_LOGS:
            SISTEMA_LOGS = SISTEMA_LOGS[:MAX_LOGS]
            
        # Salva no banco de dados
        conn = sqlite3.connect('mupa.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO logs (tipo, mensagem, detalhes)
            VALUES (?, ?, ?)
        ''', (tipo, mensagem, detalhes))
        conn.commit()
        conn.close()
        
    except Exception as e:
        print(f"Erro ao registrar log: {str(e)}")

@app.route("/api/exportar-relatorio", methods=['POST'])
@cache.cached(timeout=300, query_string=True)  # Cache por 5 minutos, considerando os parâmetros da query
def exportar_relatorio():
    """API para exportar relatórios"""
    try:
        data = request.get_json()
        tipo = data.get('tipo', 'consultas')
        periodo = data.get('periodo', 'hoje')
        filial = data.get('filial', 'todas')
        formato = data.get('formato', 'csv')

        # Construir a query base
        query = """
            SELECT 
                c.data_hora,
                c.ean,
                c.descricao,
                c.filial,
                c.tipo,
                c.preco,
                c.preco_clube
            FROM consultas c
            WHERE 1=1
        """

        # Adicionar filtros
        if tipo != 'todos':
            query += f" AND c.tipo = '{tipo}'"
        
        if periodo == 'hoje':
            query += " AND DATE(c.data_hora) = CURRENT_DATE"
        elif periodo == 'semana':
            query += " AND c.data_hora >= DATE('now', '-7 days')"
        elif periodo == 'mes':
            query += " AND c.data_hora >= DATE('now', '-30 days')"
        
        if filial != 'todas':
            query += f" AND c.filial = {filial}"

        # Executar a query
        conn = sqlite3.connect('mupa.db')
        c = conn.cursor()
        c.execute(query)
        consultas = c.fetchall()
        conn.close()

        # Formatar os resultados
        resultados = []
        for consulta in consultas:
            resultados.append({
                'data_hora': consulta[0],
                'ean': consulta[1],
                'descricao': consulta[2],
                'filial': consulta[3],
                'tipo': consulta[4],
                'preco': float(consulta[5]) if consulta[5] else None,
                'preco_clube': float(consulta[6]) if consulta[6] else None
            })

        # Gerar o arquivo no formato solicitado
        if formato == 'csv':
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Escrever cabeçalho
            writer.writerow(['Data/Hora', 'EAN', 'Descrição', 'Filial', 'Tipo', 'Preço', 'Preço Clube'])
            
            # Escrever dados
            for consulta in resultados:
                writer.writerow([
                    consulta['data_hora'],
                    consulta['ean'],
                    consulta['descricao'],
                    consulta['filial'],
                    consulta['tipo'],
                    consulta['preco'],
                    consulta['preco_clube']
                ])
            
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'relatorio_consultas_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
            
        elif formato == 'json':
            return send_file(
                io.BytesIO(json.dumps(resultados, ensure_ascii=False, indent=2).encode('utf-8')),
                mimetype='application/json',
                as_attachment=True,
                download_name=f'relatorio_consultas_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            
        else:
            return jsonify({
                'error': 'Formato de exportação não suportado'
            }), 400

    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

# --- Rotas de upload ---
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['GET'])
@cache.cached(timeout=3600)  # Cache por 1 hora
def upload_page():
    return render_template('upload.html')

@app.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        # Limpar o cache após upload de arquivo
        limpar_todo_cache()
        return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 201
    return jsonify({'error': 'Invalid file type'}), 400
# --- Fim das rotas de upload ---

# --- Gerenciamento de imagens de produtos ---
from flask import send_from_directory

# Caminho absoluto para a pasta imgs_produtos ao lado do executável ou script
if getattr(sys, 'frozen', False):
    # Executável
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Script Python
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_PRODUTOS_DIR = os.path.join(BASE_DIR, 'imgs_produtos')
DEFAULT_IMG_PATH = os.path.join(IMG_PRODUTOS_DIR, 'sem_imagem.png')

@app.route('/gerenciar_imagens', methods=['GET'])
def gerenciar_imagens_page():
    return render_template('gerenciar_imagens.html')

@app.route('/gerenciar_imagens/view/<ean>', methods=['GET'])
def view_produto_img(ean):
    filename = f'{ean}.png'
    img_path = os.path.join(IMG_PRODUTOS_DIR, filename)
    if os.path.exists(img_path):
        return send_from_directory(IMG_PRODUTOS_DIR, filename)
    else:
        return send_file(DEFAULT_IMG_PATH) if os.path.exists(DEFAULT_IMG_PATH) else ('', 404)

@app.route('/gerenciar_imagens/upload', methods=['POST'])
def upload_produto_img():
    ean = request.form.get('ean', '').strip()
    file = request.files.get('file')
    if not ean or not file:
        return jsonify({'error': 'EAN e arquivo são obrigatórios.'}), 400
    if not file.filename.lower().endswith('.png'):
        return jsonify({'error': 'Apenas imagens PNG são permitidas.'}), 400
    # Sempre salvar como PNG, independentemente da extensão original
    filename = f'{ean}.png'
    save_path = os.path.join(IMG_PRODUTOS_DIR, filename)
    if not os.path.exists(IMG_PRODUTOS_DIR):
        os.makedirs(IMG_PRODUTOS_DIR)
    file.save(save_path)
    
    # Enviar request PUT para o Firebase para notificar que a imagem foi alterada
    try:
        firebase_url = f'https://imgsprodutos-default-rtdb.firebaseio.com/{ean}.json'
        # Criar o payload JSON conforme solicitado
        current_time = int(time.time() * 1000)  # Timestamp atual em milissegundos
        payload = {
            "codbar": f"\"{ean}\"",
            "comando": "\"update\"",  # Comando para alteração
            "time": f"{current_time}"
        }
        response = requests.put(firebase_url, json=payload)
        if response.status_code == 200:
            registrar_log(f"Firebase atualizado para o EAN {ean} após alteração de imagem")
        else:
            registrar_log(f"Erro ao atualizar Firebase para o EAN {ean}: {response.status_code}", 'error')
    except Exception as e:
        registrar_log(f"Exceção ao atualizar Firebase para o EAN {ean}: {str(e)}", 'error')
    
    return jsonify({'message': 'Imagem enviada com sucesso!', 'filename': filename})

@app.route('/gerenciar_imagens/delete', methods=['POST'])
def delete_produto_img():
    data = request.get_json()
    ean = data.get('ean', '').strip()
    found = False
    # Como agora todas as imagens são salvas como PNG, verificamos apenas essa extensão
    img_path = os.path.join(IMG_PRODUTOS_DIR, f'{ean}.png')
    if os.path.exists(img_path):
        os.remove(img_path)
        found = True
    
    # Enviar request PUT para o Firebase para notificar que a imagem foi apagada
    try:
        firebase_url = f'https://imgsprodutos-default-rtdb.firebaseio.com/{ean}.json'
        # Criar o payload JSON conforme solicitado
        current_time = int(time.time() * 1000)  # Timestamp atual em milissegundos
        payload = {
            "codbar": f"\"{ean}\"",
            "comando": "\"delete\"",
            "time": f"{current_time}"
        }
        response = requests.put(firebase_url, json=payload)
        if response.status_code == 200:
            registrar_log(f"Firebase atualizado para o EAN {ean} após deleção de imagem")
        else:
            registrar_log(f"Erro ao atualizar Firebase para o EAN {ean}: {response.status_code}", 'error')
    except Exception as e:
        registrar_log(f"Exceção ao atualizar Firebase para o EAN {ean}: {str(e)}", 'error')
    
    if found:
        return jsonify({'message': 'Imagem deletada com sucesso.'})
    else:
        return jsonify({'error': 'Imagem não encontrada.'}), 404
# --- Fim do gerenciamento de imagens de produtos ---

# --- Página para listar todas as imagens dos produtos ---
@app.route('/imagens_produtos', methods=['GET'])
def imagens_produtos_page():
    page = int(request.args.get('page', 1))
    per_page = 20
    q = request.args.get('q', '').strip().lower()
    imagens = []
    print('DEBUG - IMG_PRODUTOS_DIR:', IMG_PRODUTOS_DIR)
    if os.path.exists(IMG_PRODUTOS_DIR):
        arquivos = os.listdir(IMG_PRODUTOS_DIR)
        print('DEBUG - Arquivos encontrados:', arquivos)
        for fname in arquivos:
            # Apenas arquivos PNG devem ser listados, já que todas as imagens são mantidas com extensão .png
            if fname.lower().endswith('.png') and fname != 'sem_imagem.png':
                if not q or q in fname.lower():
                    ean = fname.rsplit('.', 1)[0]
                    imagens.append({'nome': fname, 'ean': ean})
    else:
        print('DEBUG - Pasta imgs_produtos NÃO encontrada!')
    imagens = sorted(imagens, key=lambda x: x['nome'])
    total = len(imagens)
    total_pages = max(1, (total + per_page - 1) // per_page)
    start = (page - 1) * per_page
    end = start + per_page
    imagens_pagina = imagens[start:end]
    print('DEBUG - Imagens para exibir:', imagens_pagina)
    return render_template('imagens_produtos.html', imagens=imagens_pagina, page=page, total_pages=total_pages, q=q)
# --- Fim da página de imagens dos produtos ---

import socket

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Não precisa estar acessível, só força a escolha da interface correta
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

LOCAL_IP = get_local_ip()
PORT = 5000


def run_tray_icon():
    def on_open():
        webbrowser.open(f'http://{LOCAL_IP}:{PORT}')
    def on_restart():
        python = sys.executable
        os.execl(python, python, *sys.argv)
    def on_exit(icon, item):
        icon.stop()
        os._exit(0)
    icon_path = os.path.join(os.path.dirname(__file__), 'icon_sistema.ico')
    image = Image.open(icon_path)
    menu = (
        item('Abrir', lambda: on_open()),
        item('Reiniciar', lambda: on_restart()),
        item('Fechar', on_exit)
    )
    tray_icon = pystray.Icon("api-unidasul", image, "API Unidasul", menu)
    tray_icon.run()

def is_running_as_service():
    return os.environ.get('RUNNING_AS_SERVICE', '0') == '1'

@app.route('/registro', methods=['POST'])
@jwt_required()
def registrar_entrada_saida():
    data = request.get_json()
    usuario = data.get('usuario')
    tipo = data.get('tipo')  # 'entrada' ou 'saida'
    timestamp = data.get('timestamp') or datetime.now().isoformat()
    # Aqui você pode salvar no banco de dados, por exemplo
    # Exemplo simples: salvar em arquivo
    log_path = os.path.join(os.path.dirname(__file__), 'registro_entradas_saidas.log')
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(f"{usuario},{tipo},{timestamp}\n")
    # Limpar o cache do dashboard após registro de entrada/saída
    limpar_cache_rota(dashboard_data)
    return jsonify({'message': f'{tipo.capitalize()} registrada com sucesso', 'usuario': usuario, 'timestamp': timestamp})

# Endpoint webhook para push de atualizações
@app.route('/webhook/atualizacao', methods=['POST'])
def webhook_atualizacao():
    # Recebe notificação de atualização do frontend
    payload = request.get_json()
    # Aqui você pode processar o payload e notificar outros sistemas, se necessário
    # Exemplo: salvar notificação em arquivo
    webhook_log = os.path.join(os.path.dirname(__file__), 'webhook_updates.log')
    with open(webhook_log, 'a', encoding='utf-8') as f:
        f.write(json.dumps(payload, ensure_ascii=False) + '\n')
    # Limpar o cache da rota de atualizações após receber um novo webhook
    limpar_cache_rota(get_atualizacoes)
    return jsonify({'message': 'Webhook recebido com sucesso'})

# Endpoint para frontend buscar atualizações
@app.route('/atualizacoes', methods=['GET'])
@cache.cached(timeout=60)  # Cache por 60 segundos
def get_atualizacoes():
    webhook_log = os.path.join(os.path.dirname(__file__), 'webhook_updates.log')
    updates = []
    if os.path.exists(webhook_log):
        with open(webhook_log, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    updates.append(json.loads(line.strip()))
                except Exception:
                    continue
    return jsonify({'updates': updates})

# Endpoint para limpar o cache manualmente
@app.route('/api/limpar-cache', methods=['POST'])
@jwt_required()
def limpar_cache_api():
    """Endpoint para limpar o cache manualmente"""
    try:
        rota = request.args.get('rota')
        if rota:
            # Limpar cache de uma rota específica
            rotas = {
                'dashboard_data': dashboard_data,
                'get_ultimas_consultas': get_ultimas_consultas,
                'get_logs': get_logs,
                'get_atualizacoes': get_atualizacoes,
                'exportar_relatorio': exportar_relatorio
            }
            if rota in rotas:
                limpar_cache_rota(rotas[rota])
                return jsonify({'message': f'Cache da rota {rota} limpo com sucesso'})
            else:
                return jsonify({'error': 'Rota não encontrada'}), 404
        else:
            # Limpar todo o cache
            limpar_todo_cache()
            return jsonify({'message': 'Todo o cache foi limpo com sucesso'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("MAIN.PY EXECUTADO DE:", __file__)
    print(app.url_map)
    print(f"Acesse o sistema em: http://{LOCAL_IP}:{PORT}")
    if not is_running_as_service():
        tray_thread = threading.Thread(target=run_tray_icon, daemon=True)
        tray_thread.start()
    app.run(host='0.0.0.0', port=PORT, debug=not is_running_as_service())
