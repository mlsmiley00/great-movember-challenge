-- Local-calendar reporting dates, historical catch-up, and owner-only goal removal.
-- This migration is independent of the optional chat migration.
begin;
create function public.record_progress(gid uuid, day date, amount numeric, entry_notes text, screenshot_path text, reporting_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare g public.goals; c public.competitions; eid uuid; existing public.progress_entries; local_today date;
begin
 if reporting_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names t where t.name=reporting_timezone) then raise exception 'Invalid reporting timezone'; end if;
 local_today := (now() at time zone reporting_timezone)::date;
 -- Serialize progress writes and goal removal on the same goal.
 select goal.* into g from public.goals goal where goal.id=gid and goal.user_id=auth.uid() for update;
 if g.id is null or not public.is_member(g.competition_id) then raise exception 'Forbidden'; end if;
 select * into c from public.competitions where id=g.competition_id;
 if day is null or day<c.starts_on or day>c.ends_on or day>local_today or not (extract(dow from day)::int=any(g.weekdays)) then raise exception 'Not a scheduled competition day'; end if;
 -- 48 hour grace after the final UTC day; edits/review stay possible for admins.
 if now() >= (c.ends_on+3)::timestamp at time zone 'UTC' then raise exception 'Reporting is closed'; end if;
 select * into existing from public.progress_entries where goal_id=gid and logged_on=day for update;
 if existing.verification in ('verified','rejected') then raise exception 'Reviewed entries are locked; contact an administrator'; end if;
 if screenshot_path is not null and (split_part(screenshot_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='progress-evidence' and name=screenshot_path)) then raise exception 'Invalid evidence'; end if;
 insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,notes,verification)
 values(g.competition_id,auth.uid(),gid,day,amount,coalesce(entry_notes,''),case when screenshot_path is null then 'honor' else 'pending' end)
 on conflict(goal_id,logged_on) do update set value=excluded.value,notes=excluded.notes,verification=excluded.verification,updated_at=now()
 returning id into eid;
 delete from public.evidence where entry_id=eid;
 if screenshot_path is not null then insert into public.evidence(entry_id,user_id,competition_id,path) values(eid,auth.uid(),g.competition_id,screenshot_path); end if;
 return eid;
end $$;

-- Keep the original five-argument API working for clients without a timezone.
create or replace function public.record_progress(gid uuid, day date, amount numeric, entry_notes text default '', screenshot_path text default null)
returns uuid language sql security invoker set search_path='' as $$
 select public.record_progress(gid,day,amount,entry_notes,screenshot_path,'UTC');
$$;
revoke execute on function public.record_progress(uuid,date,numeric,text,text,text) from public,anon;
grant execute on function public.record_progress(uuid,date,numeric,text,text,text) to authenticated;

create function public.remove_own_goal(gid uuid)
returns text[] language plpgsql security definer set search_path='' as $$
declare g public.goals; paths text[];
begin
 select goal.* into g from public.goals goal where goal.id=gid and goal.user_id=auth.uid() for update;
 if g.id is null or not public.is_member(g.competition_id) then raise exception 'Forbidden'; end if;
 select coalesce(array_agg(e.path),'{}'::text[]) into paths
 from public.evidence e join public.progress_entries p on p.id=e.entry_id where p.goal_id=gid;
 -- Existing foreign keys cascade removal to evidence metadata, comments and reactions.
 delete from public.progress_entries where goal_id=gid;
 delete from public.goals where id=gid;
 return paths;
end $$;
revoke execute on function public.remove_own_goal(uuid) from public,anon;
grant execute on function public.remove_own_goal(uuid) to authenticated;
commit;
