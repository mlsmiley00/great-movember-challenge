-- Run ONLY after the app is deployed with a production Turnstile site key,
-- Supabase CAPTCHA is enabled with the matching secret, email confirmation is
-- enabled, and missing/fake CAPTCHA tokens have been confirmed to fail.
update public.competitions set public_registration_enabled=true
where id='20260000-0000-4000-8000-000000000001';
select public.public_registration_open();
