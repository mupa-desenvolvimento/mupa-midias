UPDATE lite_products 
SET image_url = REPLACE(image_url, 'http://srv-mupa.ddns.net:5050/produto-imagem/', 'https://bgcnvyoseexfmrynqbfb.supabase.co/functions/v1/product-image-proxy?ean=')
WHERE image_url LIKE 'http://srv-mupa.ddns.net:5050/produto-imagem/%';