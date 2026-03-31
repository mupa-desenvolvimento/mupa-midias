document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const consultaForm = document.getElementById('consultaForm');
    const loading = document.querySelector('.loading');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    const resultado = document.getElementById('resultado');
    const errorMessage = document.getElementById('errorMessage');

    let token = localStorage.getItem('token');
    let currentEan = null;
    let imageCheckInterval = null;

    function showSuccess(message) {
        successAlert.textContent = message;
        successAlert.classList.remove('d-none');
        errorAlert.classList.add('d-none');
        setTimeout(() => successAlert.classList.add('d-none'), 5000);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.classList.remove('hidden');
        successAlert.classList.add('d-none');
        setTimeout(() => errorAlert.classList.add('d-none'), 5000);
    }

    function displayResult(data) {
        resultado.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    function checkImageStatus(ean) {
        fetch(`/imagem-status/${ean}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'disponivel') {
                    // Atualiza o resultado com a URL da imagem
                    const resultData = JSON.parse(resultado.textContent);
                    resultData.imagem_url = data.imagem_url;
                    resultData.imagem_status = 'disponivel';
                    displayResult(resultData);
                    
                    // Para o intervalo de verificação
                    if (imageCheckInterval) {
                        clearInterval(imageCheckInterval);
                        imageCheckInterval = null;
                    }
                } else if (data.status === 'erro') {
                    // Atualiza o resultado com o erro
                    const resultData = JSON.parse(resultado.textContent);
                    resultData.imagem_status = 'erro';
                    resultData.imagem_erro = data.mensagem;
                    displayResult(resultData);
                    
                    // Para o intervalo de verificação
                    if (imageCheckInterval) {
                        clearInterval(imageCheckInterval);
                        imageCheckInterval = null;
                    }
                }
            })
            .catch(error => {
                console.error('Erro ao verificar status da imagem:', error);
            });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                token = data.access_token;
                localStorage.setItem('token', token);
                showSuccess('Login realizado com sucesso!');
                loginForm.reset();
            } else {
                showError(data.error || 'Erro ao fazer login');
            }
        } catch (error) {
            showError('Erro ao conectar com o servidor');
            console.error('Erro:', error);
        }
    });

    consultaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const ean = document.getElementById('ean').value;
        const filial = document.getElementById('filial').value;

        // Validação básica
        if (!ean || !filial) {
            showError('Por favor, preencha todos os campos');
            return;
        }

        // Mostra loading
        loading.classList.remove('hidden');
        resultado.classList.add('hidden');
        errorAlert.classList.add('hidden');

        try {
            const response = await fetch(`/get_price_html/${ean}/${filial}`);
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            // Atualiza os campos com os dados
            document.getElementById('descricao').textContent = data.elementos.lblDcrProduto || 'Não disponível';
            document.getElementById('preco').textContent = data.elementos.lblPreco ? `R$ ${data.elementos.lblPreco}` : 'Não disponível';
            document.getElementById('preco-clube').textContent = data.elementos.lblPrecoDC ? `R$ ${data.elementos.lblPrecoDC}` : 'Não disponível';
            document.getElementById('codigo').textContent = data.elementos.lblScanner || 'Não disponível';

            // Atualiza a imagem
            const imagemProduto = document.getElementById('imagem-produto');
            if (data.imagem_status === 'disponivel') {
                imagemProduto.src = data.imagem_url;
                imagemProduto.classList.remove('hidden');
            } else {
                imagemProduto.classList.add('hidden');
            }

            // Mostra o resultado
            resultado.classList.remove('hidden');
        } catch (error) {
            showError('Erro ao realizar a consulta: ' + error.message);
        } finally {
            loading.classList.add('hidden');
        }
    });
}); 