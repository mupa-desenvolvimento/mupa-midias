
-- Clean old seeded data for KNC-Teste
DELETE FROM public.playlist_items WHERE playlist_id IN (SELECT id FROM public.playlists WHERE tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127');
DELETE FROM public.device_group_members WHERE device_id IN (SELECT id FROM public.devices WHERE company_id = '3c11f254-54b6-466f-a961-06be38053517');
DELETE FROM public.devices WHERE company_id = '3c11f254-54b6-466f-a961-06be38053517';
DELETE FROM public.device_groups WHERE tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127';
DELETE FROM public.playlists WHERE tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127';
DELETE FROM public.media_items WHERE tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127';
DELETE FROM public.stores WHERE tenant_id = '6fb1ddb9-f804-4c96-82ff-182334a81127';

-- Re-seed with updated function
SELECT public.seed_tenant_defaults(
  '6fb1ddb9-f804-4c96-82ff-182334a81127'::uuid,
  '3c11f254-54b6-466f-a961-06be38053517'::uuid
);
