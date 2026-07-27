drop policy if exists suro_cabinet_download_documents on storage.objects;

drop function if exists public.suro_cabinet_list_application_documents(uuid);
drop function if exists public.suro_cabinet_can_access_application(uuid);
