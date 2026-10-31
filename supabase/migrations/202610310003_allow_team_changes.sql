-- Members may create, join, switch, or leave teams after logging progress.
-- Existing scores follow current membership; no progress entries are modified.
begin;
create or replace function public.create_team(cid uuid, team_name text) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 if (now() at time zone 'UTC')::date>(select ends_on from public.competitions where id=cid) then raise exception 'Team registration is closed'; end if;
 insert into public.teams(competition_id,name,created_by) values(cid,trim(team_name),auth.uid()) returning id into tid;
 update public.memberships set team_id=tid where competition_id=cid and user_id=auth.uid();
end $$;
create or replace function public.join_team(cid uuid, tid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 if (now() at time zone 'UTC')::date>(select ends_on from public.competitions where id=cid) then raise exception 'Team registration is closed'; end if;
 if tid is not null and not exists(select 1 from public.teams where id=tid and competition_id=cid) then raise exception 'Invalid team'; end if;
 update public.memberships set team_id=tid where competition_id=cid and user_id=auth.uid();
end $$;


-- Reassert the original authenticated-only execution permissions.
revoke execute on function public.create_team(uuid,text), public.join_team(uuid,uuid) from public,anon;
grant execute on function public.create_team(uuid,text), public.join_team(uuid,uuid) to authenticated;
commit;
