// Função para mostrar/esconder loading
function toggleLoading(show) {
    const loading = document.querySelector('.loading');
    if (loading) {
        loading.classList.toggle('active', show);
    }
}

// Função para mostrar mensagens de alerta
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Fechar">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto remove após 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Função para formatar valores monetários
function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Função para validar EAN
function validateEAN(ean) {
    return /^\d{13}$/.test(ean);
}

// Função para validar número da filial
function validateFilial(filial) {
    return /^\d{1,3}$/.test(filial);
}

// Função para fazer consulta de produto
async function consultarProduto(ean, filial) {
    if (!validateEAN(ean)) {
        showAlert('EAN inválido. Digite 13 dígitos.', 'danger');
        return;
    }
    
    if (!validateFilial(filial)) {
        showAlert('Número da filial inválido.', 'danger');
        return;
    }
    
    toggleLoading(true);
    
    try {
        const response = await fetch(`/api/consulta/${ean}/${filial}`);
        const data = await response.json();
        
        if (data.error) {
            showAlert(data.error, 'danger');
            return;
        }
        
        // Atualizar resultado na página
        const resultadoDiv = document.querySelector('.resultado');
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `
                <h4>Resultado da Consulta</h4>
                <p><strong>EAN:</strong> ${data.ean}</p>
                <p><strong>Filial:</strong> ${data.filial}</p>
                <p><strong>Tipo:</strong> ${data.tipo}</p>
                <pre>${JSON.stringify(data.dados, null, 2)}</pre>
            `;
        }
        
        showAlert('Consulta realizada com sucesso!', 'success');
    } catch (error) {
        showAlert('Erro ao realizar consulta: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Form de consulta
    const formConsulta = document.querySelector('#formConsulta');
    if (formConsulta) {
        formConsulta.addEventListener('submit', function(e) {
            e.preventDefault();
            const ean = this.querySelector('[name="ean"]').value;
            const filial = this.querySelector('[name="filial"]').value;
            consultarProduto(ean, filial);
        });
    }
}); 