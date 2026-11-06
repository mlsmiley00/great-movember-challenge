-- Honor reporting is the default, including entries with optional screenshots.
begin;
alter table public.competitions add column require_progress_review boolean not null default false;

-- Release the existing review queue without changing any completed review decision.
update public.progress_entries set verification='honor',updated_at=now() where verification='pending';

create or replace function public.record_progress(gid uuid, day date, amount numeric, entry_notes text, screenshot_path text, reporting_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare g public.goals; c public.competitions; eid uuid; existing public.progress_entries; local_today date;
begin
 if reporting_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names t where t.name=reporting_timezone) then raise exception 'Invalid reporting timezone'; end if;
 local_today := (now() at time zone reporting_timezone)::date;
 -- Serialize progress writes and goal removal on the same goal.
 select goal.* into g from public.goals goal where goal.id=gid and goal.user_id=auth.uid() for update;
 if g.id is null or not public.is_member(g.competition_id) then raise exception 'Forbidden'; end if;
 select * into c from public.competitions where id=g.competition_id for share;
 if day is null or day<c.starts_on or day>c.ends_on or day>local_today or not (extract(dow from day)::int=any(g.weekdays)) then raise exception 'Not a scheduled competition day'; end if;
 -- 48 hour grace after the final UTC day; edits/review stay possible for admins.
 if now() >= (c.ends_on+3)::timestamp at time zone 'UTC' then raise exception 'Reporting is closed'; end if;
 select * into existing from public.progress_entries where goal_id=gid and logged_on=day for update;
 if existing.verification in ('verified','rejected') then raise exception 'Reviewed entries are locked; contact an administrator'; end if;
 if screenshot_path is not null and (split_part(screenshot_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='progress-evidence' and name=screenshot_path)) then raise exception 'Invalid evidence'; end if;
 insert into public.progress_entries(competition_id,user_id,goal_id,logged_on,value,notes,verification)
 values(g.competition_id,auth.uid(),gid,day,amount,coalesce(entry_notes,''),case when c.require_progress_review then 'pending' else 'honor' end)
 on conflict(goal_id,logged_on) do update set value=excluded.value,notes=excluded.notes,verification=excluded.verification,updated_at=now()
 returning id into eid;
 delete from public.evidence where entry_id=eid;
 if screenshot_path is not null then insert into public.evidence(entry_id,user_id,competition_id,path) values(eid,auth.uid(),g.competition_id,screenshot_path); end if;
 return eid;
end $$;

create function public.set_progress_review(cid uuid, review_required boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 if review_required is null then raise exception 'Review mode is required'; end if;
 -- Coordinate with progress submissions so the selected policy applies atomically.
 update public.competitions set require_progress_review=review_required where id=cid;
 if not review_required then
  update public.progress_entries set verification='honor',updated_at=now()
  where competition_id=cid and verification='pending';
 end if;
end $$;
revoke execute on function public.set_progress_review(uuid,boolean) from public,anon;
grant execute on function public.set_progress_review(uuid,boolean) to authenticated;
commit;
