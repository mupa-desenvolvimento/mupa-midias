# API de Consulta de Produtos Unidasul

API para consulta de produtos da rede Unidasul através do código EAN (código de barras) e número da filial. O sistema oferece uma interface web amigável e endpoints de API para integração com outros sistemas.

## Documentação

A documentação completa do sistema está disponível nos seguintes arquivos:

- [Documentação da API](./API_DOCUMENTATION.md): Documentação técnica de todas as APIs disponíveis
- [Manual de Uso](./MANUAL_DE_USO.md): Instruções detalhadas sobre como utilizar o sistema

## Funcionalidades

- Consulta de produtos por código EAN e filial
- Interface web responsiva e moderna com Tailwind CSS
- Dashboard com estatísticas de consultas
- Sistema de autenticação com JWT
- Gerenciamento de imagens de produtos
- Integração com API Mupa para obtenção de imagens
- Armazenamento de consultas em banco de dados SQLite
- Sistema de logs para monitoramento
- Exportação de relatórios
- Ícone na bandeja do sistema (tray icon)

## Requisitos

- Python 3.8+
- Flask 3.0.2
- Flask-JWT-Extended 4.6.0
- Requests 2.31.0
- BeautifulSoup4 4.12.3
- Pillow 10.2.0
- Pystray 0.19.5
- PyWin32 306 (para Windows)
- Python-dotenv 1.0.1
- MySQL-connector-python 9.2.0 (opcional)
- PyTZ 2024.1

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/api-unidasul.git
cd api-unidasul
```

2. Crie um ambiente virtual:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. Instale as dependências:
```bash
pip install -r requirements.txt
```

## Configuração

1. Crie um arquivo `.env` na raiz do projeto:
```env
FLASK_APP=main.py
FLASK_ENV=development
JWT_SECRET_KEY=sua-chave-secreta
```

2. Ajuste as configurações de URL e outras variáveis no arquivo `main.py` conforme necessário.

## Uso

1. Inicie o servidor:
```bash
python main.py
```
Ou use o executável compilado (se disponível):
```bash
api-unidasul-imgs.exe
```

2. Acesse a interface principal:
```
http://localhost:5000
```

3. Páginas disponíveis:
- `/` - Página inicial
- `/consulta` - Consulta de produtos
- `/dashboard` - Dashboard com estatísticas
- `/admin` - Interface administrativa
- `/consultas_hora` - Consultas por hora
- `/ultimas_consultas` - Últimas consultas realizadas
- `/logs` - Visualização de logs do sistema
- `/relatorios` - Exportação de relatórios

4. Para consultar um produto via API:
```
GET /api/consulta/<ean>/<num_filial>
```

5. Para obter uma imagem de produto:
```
GET /imgs_produtos/<ean>
```

## Estrutura do Projeto

```
api-unidasul/
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── admin.js
│       ├── main.js
│       └── script.js
├── templates/
│   ├── admin/
│   │   └── index.html
│   ├── admin.html
│   ├── base.html
│   ├── consulta.html
│   ├── consultas_hora.html
│   ├── dashboard.html
│   ├── gerenciar_imagens.html
│   ├── imagens_produtos.html
│   ├── index.html
│   ├── logs.html
│   ├── relatorios.html
│   ├── ultimas_consultas.html
│   └── upload.html
├── imgs_produtos/
│   └── [imagens dos produtos em .png]
├── debug_html/
├── config.py
├── models.py
├── main.py
├── mupa.db
├── requirements.txt
├── .env
└── README.md
```

## Resposta da API

A API retorna um JSON com as seguintes informações:

```json
{
    "success": true,
    "ean": "1234567890123",
    "filial": "035",
    "tipo": "PRODUTO",
    "dados": {
        "descricao": "Nome do Produto",
        "preco": 10.99,
        "preco_clube": 9.99,
        "codigo": "123456",
        "imagem_url": "/imgs_produtos/1234567890123.png"
    },
    "html": "..."
}
```

Em caso de erro:

```json
{
    "success": false,
    "ean": "1234567890123",
    "filial": "035",
    "tipo": "ERRO",
    "dados": {},
    "error": "Mensagem de erro"
}
```

## Debug e Logs

### Arquivos de Debug
Os arquivos de debug são salvos no diretório `debug_html/` com o formato:
- `{ean}_f{filial}_full.html`: HTML completo da resposta

### Sistema de Logs
O sistema mantém logs de operações em:
1. Banco de dados SQLite (tabela `logs`)
2. Arquivo `sistema.log`

Os logs incluem informações sobre:
- Consultas realizadas
- Erros encontrados
- Autenticações
- Download de imagens

## Banco de Dados

O sistema utiliza SQLite (arquivo `mupa.db`) com as seguintes tabelas:

### Tabela `consultas`
- id (INTEGER, chave primária)
- data_hora (DATETIME)
- ean (TEXT)
- descricao (TEXT)
- filial (INTEGER)
- tipo (TEXT)
- preco (REAL)
- preco_clube (REAL)
- device_info (TEXT)

### Tabela `logs`
- id (INTEGER, chave primária)
- data_hora (DATETIME)
- nivel (TEXT)
- mensagem (TEXT)
- detalhes (TEXT)

## Autenticação

O sistema utiliza autenticação JWT (JSON Web Token):

```
POST /generate-token

Body:
{
    "username": "api-unidasul@mupa.app",
    "password": "senha"
}

Response:
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2023-05-01T15:30:00 BRT"
}
```

## Compilação para Executável

O projeto pode ser compilado para um executável Windows usando PyInstaller:

```bash
pyinstaller --onedir --windowed --icon=icon_sistema.ico main.py
```

O executável gerado estará na pasta `output/api-unidasul-imgs/`.

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Crie um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.
