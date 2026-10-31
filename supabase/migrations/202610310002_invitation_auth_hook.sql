-- Enable this Before User Created hook in Supabase Authentication > Hooks
-- AFTER creating and verifying the initial administrator account.
create function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare token text; mail text;
begin
 token:=event->'user'->'user_metadata'->>'invitation_token';
 mail:=lower(event->'user'->>'email');
 if token is null or mail is null or not exists(
  select 1 from public.invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex')
  and lower(email)=mail and used_at is null and expires_at>now()
 ) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','A valid invitation for this email is required. / Se requiere una invitación válida para este correo.'));
 end if;
 return '{}'::jsonb;
end $$;
revoke execute on function public.before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
