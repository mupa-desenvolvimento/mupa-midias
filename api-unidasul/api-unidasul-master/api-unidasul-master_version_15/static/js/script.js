// Função para mostrar o loading
function showLoading() {
    document.querySelector('.loading').classList.add('show');
}

// Função para esconder o loading
function hideLoading() {
    document.querySelector('.loading').classList.remove('show');
}

// Função para mostrar mensagem de erro
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    document.querySelector('.resultado').prepend(alertDiv);
}

// Função para mostrar mensagem de sucesso
function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    document.querySelector('.resultado').prepend(alertDiv);
}

// Função para formatar preço
function formatPrice(price) {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(price);
}

// Função para exibir o resultado da consulta
function displayResult(data) {
    const resultadoDiv = document.querySelector('.resultado');
    resultadoDiv.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="card-title">Resultado da Consulta</h5>
            </div>
            <div class="card-body">
                <div class="info-item">
                    <span class="info-label">EAN:</span>
                    <span class="info-value">${data.ean}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Filial:</span>
                    <span class="info-value">${data.filial}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Código:</span>
                    <span class="info-value">${data.dados.codigo || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Descrição:</span>
                    <span class="info-value">${data.dados.descricao || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Preço:</span>
                    <span class="info-value">${formatPrice(data.dados.preco)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Preço Clube:</span>
                    <span class="info-value">${formatPrice(data.dados.preco_clube)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Mensagem Promocional:</span>
                    <span class="info-value">${data.dados.mensagem_promocional || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    resultadoDiv.style.display = 'block';
}

// Função para realizar a consulta
async function consultarProduto(e) {
    e.preventDefault();
    
    const ean = document.getElementById('ean').value;
    const filial = document.getElementById('filial').value;
    
    if (!ean || !filial) {
        showError('Por favor, preencha todos os campos.');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`/api/consulta/${ean}/${filial}`);
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            displayResult(data);
            showSuccess('Consulta realizada com sucesso!');
        }
    } catch (error) {
        showError('Erro ao realizar a consulta. Por favor, tente novamente.');
        console.error('Erro:', error);
    } finally {
        hideLoading();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    form.addEventListener('submit', consultarProduto);
});

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('consultaForm');
    const loading = document.getElementById('loading');
    const alertSuccess = document.getElementById('alertSuccess');
    const alertError = document.getElementById('alertError');
    const resultado = document.getElementById('resultado');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const ean = document.getElementById('ean').value;
        const filial = document.getElementById('filial').value;

        if (!ean || !filial) {
            showError('Por favor, preencha todos os campos');
            return;
        }

        try {
            showLoading();
            hideAlerts();
            
            const response = await fetch(`/api/consulta/${ean}/${filial}`);
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            showSuccess('Consulta realizada com sucesso!');
            displayResult(data);
        } catch (error) {
            showError('Erro ao realizar consulta: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    function showLoading() {
        loading.style.display = 'block';
    }

    function hideLoading() {
        loading.style.display = 'none';
    }

    function showSuccess(message) {
        alertSuccess.textContent = message;
        alertSuccess.style.display = 'block';
    }

    function showError(message) {
        alertError.textContent = message;
        alertError.style.display = 'block';
    }

    function hideAlerts() {
        alertSuccess.style.display = 'none';
        alertError.style.display = 'none';
    }

    function displayResult(data) {
        let html = '<h3>Resultado da Consulta</h3>';
        
        if (data.tipo === 'TERMINAL_CONSULTA') {
            html += '<p><strong>Tipo:</strong> Terminal de Consulta</p>';
        } else {
            html += `
                <p><strong>Código:</strong> ${data.dados.codigo || 'N/A'}</p>
                <p><strong>Descrição:</strong> ${data.dados.descricao || 'N/A'}</p>
                <p><strong>Preço:</strong> ${data.dados.preco || 'N/A'}</p>
                <p><strong>Preço Clube:</strong> ${data.dados.preco_clube || 'N/A'}</p>
                <p><strong>Mensagem Promocional:</strong> ${data.dados.mensagem_promocional || 'N/A'}</p>
            `;
        }

        resultado.innerHTML = html;
        resultado.style.display = 'block';
    }
}); 