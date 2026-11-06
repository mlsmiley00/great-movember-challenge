-- Registration stays closed until CAPTCHA and email verification are configured.
begin;
alter table public.competitions add column public_registration_enabled boolean not null default false;

create function public.public_registration_open() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select public_registration_enabled from public.competitions where id='20260000-0000-4000-8000-000000000001'),false);
$$;
revoke execute on function public.public_registration_open() from public;
grant execute on function public.public_registration_open() to anon,authenticated;

create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare token text; mail text; chosen_name text;
begin
 mail:=lower(event->'user'->>'email');
 if public.public_registration_open() then
  chosen_name:=trim(regexp_replace(event->'user'->'user_metadata'->>'display_name','[[:space:]]+',' ','g'));
  if mail is null or mail='' or chosen_name is null or char_length(chosen_name) not between 2 and 60
   or (event->'user'->'user_metadata'->'club_consent') is distinct from 'true'::jsonb then
   return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','A display name and privacy consent are required.'));
  end if;
  return '{}'::jsonb;
 end if;
 -- Preserve the existing invitation flow while registration is not enabled.
 token:=event->'user'->'user_metadata'->>'invitation_token';
 if token is null or mail is null or not exists(
  select 1 from public.invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex')
  and lower(email)=mail and used_at is null and expires_at>now()
 ) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration is not open. A valid invitation is required.'));
 end if;
 return '{}'::jsonb;
end $$;

create function public.enroll_verified_public_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare chosen_name text;
begin
 if new.email_confirmed_at is null or not public.public_registration_open() then return new; end if;
 chosen_name:=trim(regexp_replace(new.raw_user_meta_data->>'display_name','[[:space:]]+',' ','g'));
 if chosen_name is null or char_length(chosen_name) not between 2 and 60
  or (new.raw_user_meta_data->'club_consent') is distinct from 'true'::jsonb then return new; end if;
 insert into public.memberships(competition_id,user_id,display_name,role,status)
 values('20260000-0000-4000-8000-000000000001',new.id,chosen_name,'member','active')
 on conflict(competition_id,user_id) do nothing;
 return new;
end $$;
revoke execute on function public.enroll_verified_public_user() from public,anon,authenticated;
create trigger enroll_verified_public_user after insert or update of email_confirmed_at on auth.users
for each row execute function public.enroll_verified_public_user();

-- Existing verified accounts can complete consent/name once, without an invitation.
create function public.join_public_competition(chosen_name text,consented boolean)
returns void language plpgsql security definer set search_path='' as $$
declare normalized text; existing_status text;
begin
 if not public.public_registration_open() then raise exception 'Registration is closed'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email first'; end if;
 normalized:=trim(regexp_replace(chosen_name,'[[:space:]]+',' ','g'));
 if consented is distinct from true or normalized is null or char_length(normalized) not between 2 and 60 then raise exception 'Name and consent required'; end if;
 insert into public.memberships(competition_id,user_id,display_name,role,status)
 values('20260000-0000-4000-8000-000000000001',auth.uid(),normalized,'member','active')
 on conflict(competition_id,user_id) do nothing;
 select status into existing_status from public.memberships
 where competition_id='20260000-0000-4000-8000-000000000001' and user_id=auth.uid();
 if existing_status<>'active' then raise exception 'Membership suspended; contact an administrator'; end if;
end $$;
revoke execute on function public.join_public_competition(text,boolean) from public,anon;
grant execute on function public.join_public_competition(text,boolean) to authenticated;
commit;
-- After enabling Supabase CAPTCHA + email confirmation, deploying the widget,
-- and verifying rejection of fake CAPTCHA tokens, enable registration separately:
-- update public.competitions set public_registration_enabled=true
-- where id='20260000-0000-4000-8000-000000000001';
