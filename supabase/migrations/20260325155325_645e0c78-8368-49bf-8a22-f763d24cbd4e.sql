
INSERT INTO lite_products (tenant_id, company_id, ean, description, normal_price, promo_price, image_url, is_active)
VALUES
  ('56940f6d-f147-4534-a7ad-0ef300f95b8a', 'a7794ee1-4bf7-47e9-aa2b-b685ab4533e9', '7891000100103', 'Leite Condensado Moça 395g', 8.49, 6.99, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', true),
  ('56940f6d-f147-4534-a7ad-0ef300f95b8a', 'a7794ee1-4bf7-47e9-aa2b-b685ab4533e9', '7891910000197', 'Coca-Cola Lata 350ml', 4.99, 3.49, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400', true),
  ('56940f6d-f147-4534-a7ad-0ef300f95b8a', 'a7794ee1-4bf7-47e9-aa2b-b685ab4533e9', '7896004006017', 'Arroz Camil Tipo 1 5kg', 29.90, 24.90, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', true),
  ('56940f6d-f147-4534-a7ad-0ef300f95b8a', 'a7794ee1-4bf7-47e9-aa2b-b685ab4533e9', '7891149101603', 'Biscoito Oreo 90g', 3.99, NULL, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400', true),
  ('56940f6d-f147-4534-a7ad-0ef300f95b8a', 'a7794ee1-4bf7-47e9-aa2b-b685ab4533e9', '7891000305232', 'Nescafé Clássico 200g', 18.90, 14.99, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', true)
ON CONFLICT (company_id, ean) DO UPDATE SET
  description = EXCLUDED.description,
  normal_price = EXCLUDED.normal_price,
  promo_price = EXCLUDED.promo_price,
  image_url = EXCLUDED.image_url,
  updated_at = now();
