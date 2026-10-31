-- Members can edit only their own display name within an authorized competition.
begin;
create or replace function public.update_display_name(cid uuid, chosen_name text)
returns void language plpgsql security definer set search_path='' as $$
declare normalized_name text;
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 normalized_name := trim(regexp_replace(chosen_name, '[[:space:]]+', ' ', 'g'));
 if normalized_name is null or char_length(normalized_name) not between 2 and 60 then
  raise exception 'Display name must contain 2 to 60 characters';
 end if;
 update public.memberships set display_name=normalized_name
 where competition_id=cid and user_id=auth.uid();
end $$;
revoke execute on function public.update_display_name(uuid,text) from public,anon;
grant execute on function public.update_display_name(uuid,text) to authenticated;
commit;
