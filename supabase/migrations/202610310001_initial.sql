-- All dates and schedules are UTC. Each competition is a separate privacy boundary.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.competitions (
 id uuid primary key, name text not null, starts_on date not null, ends_on date not null,
 check (ends_on >= starts_on)
);
insert into public.competitions values ('20260000-0000-4000-8000-000000000001','The Great Movember Challenge 2026','2026-11-01','2026-11-30');
create table public.teams (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references public.competitions,
 name text not null check(length(trim(name)) between 2 and 60), created_by uuid not null references auth.users,
 unique(competition_id,name), unique(id,competition_id)
);
create table public.memberships (
 competition_id uuid not null references public.competitions, user_id uuid not null references auth.users on delete cascade,
 display_name text not null check(length(trim(display_name)) between 2 and 60), role text not null default 'member' check(role in ('member','admin')),
 status text not null default 'active' check(status in ('active','suspended')), team_id uuid,
 joined_at timestamptz not null default now(), primary key(competition_id,user_id),
 foreign key(team_id,competition_id) references public.teams(id,competition_id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references public.competitions,
 email text not null, token_hash text not null unique, created_by uuid not null references auth.users,
 expires_at timestamptz not null default now()+interval '7 days', used_by uuid references auth.users, used_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.goals (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null, user_id uuid not null,
 title text not null check(length(trim(title)) between 2 and 100), category text not null check(category in ('fitness','personal')),
 target numeric not null check(target>0 and target<=1000000000), unit text not null check(length(trim(unit)) between 1 and 30),
 weekdays integer[] not null default '{0,1,2,3,4,5,6}', created_at timestamptz not null default now(),
 foreign key(competition_id,user_id) references public.memberships(competition_id,user_id),
 check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]),
 unique(id,competition_id,user_id)
);
create table public.progress_entries (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null, user_id uuid not null, goal_id uuid not null,
 logged_on date not null, value numeric not null check(value>=0 and value<=1000000000), notes text not null default '' check(length(notes)<=1000),
 verification text not null check(verification in ('honor','pending','verified','rejected')),
 reviewed_by uuid references auth.users, review_note text not null default '' check(length(review_note)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(goal_id,competition_id,user_id) references public.goals(id,competition_id,user_id), unique(goal_id,logged_on)
);
-- Screenshot paths live in a separate table. Member-readable progress never exposes paths.
create table public.evidence (
 entry_id uuid primary key references public.progress_entries on delete cascade,
 user_id uuid not null references auth.users, competition_id uuid not null references public.competitions,
 path text not null unique, created_at timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references public.competitions,
 entry_id uuid not null references public.progress_entries on delete cascade, user_id uuid not null references auth.users,
 body text not null check(length(trim(body)) between 1 and 500), created_at timestamptz not null default now()
);
create table public.reactions (
 competition_id uuid not null references public.competitions, entry_id uuid not null references public.progress_entries on delete cascade,
 user_id uuid not null references auth.users, created_at timestamptz not null default now(), primary key(entry_id,user_id)
);
create table public.announcements (
 id uuid primary key default gen_random_uuid(),competition_id uuid not null references public.competitions,
 body text not null check(length(trim(body)) between 1 and 2000), created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.prizes (
 competition_id uuid not null references public.competitions, place integer not null check(place between 1 and 3),
 description text not null default 'To Be Announced' check(length(trim(description)) between 1 and 300), primary key(competition_id,place)
);
insert into public.prizes select '20260000-0000-4000-8000-000000000001',n,'To Be Announced' from generate_series(1,3) n;
create index progress_competition_date on public.progress_entries(competition_id,logged_on desc);
create index goals_member on public.goals(competition_id,user_id);
create index comments_entry on public.comments(entry_id,created_at);
create index memberships_user on public.memberships(user_id);

create function public.is_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.competition_id=cid and m.user_id=auth.uid() and m.status='active' and u.email_confirmed_at is not null);
$$;
create function public.is_admin(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_member(cid) and exists(select 1 from public.memberships where competition_id=cid and user_id=auth.uid() and role='admin');
$$;

alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.goals enable row level security;
alter table public.progress_entries enable row level security;
alter table public.evidence enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.announcements enable row level security;
alter table public.prizes enable row level security;
create policy member_read on public.competitions for select to authenticated using(public.is_member(id));
create policy member_read on public.memberships for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.teams for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.goals for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.progress_entries for select to authenticated using(public.is_member(competition_id));
create policy evidence_read on public.evidence for select to authenticated using(public.is_member(competition_id) and (user_id=auth.uid() or public.is_admin(competition_id)));
create policy admin_read on public.invitations for select to authenticated using(public.is_admin(competition_id));
create policy member_read on public.comments for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.reactions for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.announcements for select to authenticated using(public.is_member(competition_id));
create policy member_read on public.prizes for select to authenticated using(public.is_member(competition_id));
-- Mutations only via narrowly scoped functions below; no direct client writes.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.competitions,public.memberships,public.teams,public.goals,public.progress_entries,public.evidence,public.invitations,public.comments,public.reactions,public.announcements,public.prizes to authenticated;

create function public.accept_invitation(token text, chosen_name text) returns void language plpgsql security definer set search_path='' as $$
declare inv public.invitations; mail text;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email first'; end if;
 select * into inv from public.invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex') for update;
 if inv.id is null or lower(inv.email)<>mail or inv.used_at is not null or inv.expires_at<now() then raise exception 'Invalid, expired, or already used invitation'; end if;
 if exists(select 1 from public.memberships where competition_id=inv.competition_id and user_id=auth.uid()) then raise exception 'Membership already exists; contact an administrator'; end if;
 insert into public.memberships(competition_id,user_id,display_name) values(inv.competition_id,auth.uid(),trim(chosen_name));
 update public.invitations set used_by=auth.uid(),used_at=now() where id=inv.id;
end $$;

create function public.create_invitation(cid uuid, invited_email text, token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 if length(token)<32 or length(invited_email)>254 or invited_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation'; end if;
 insert into public.invitations(competition_id,email,token_hash,created_by) values(cid,lower(trim(invited_email)),encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
end $$;

create function public.save_goal(cid uuid, goal_title text, goal_category text, goal_target numeric, goal_unit text, goal_weekdays integer[]) returns void language plpgsql security definer set search_path='' as $$
declare end_day date;
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 select ends_on into end_day from public.competitions where id=cid;
 if (now() at time zone 'UTC')::date > end_day and not public.is_admin(cid) then raise exception 'Goal registration is closed; ask an administrator'; end if;
 if (select count(*) from public.goals where competition_id=cid and user_id=auth.uid())>=10 then raise exception 'Maximum 10 goals'; end if;
 insert into public.goals(competition_id,user_id,title,category,target,unit,weekdays)
 values(cid,auth.uid(),trim(goal_title),goal_category,goal_target,trim(goal_unit),array(select distinct unnest(goal_weekdays)));
end $$;

create function public.record_progress(gid uuid, day date, amount numeric, entry_notes text default '', screenshot_path text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare g public.goals; c public.competitions; eid uuid; existing public.progress_entries;
begin
 select * into g from public.goals where id=gid and user_id=auth.uid();
 if g.id is null or not public.is_member(g.competition_id) then raise exception 'Forbidden'; end if;
 select * into c from public.competitions where id=g.competition_id;
 if day<c.starts_on or day>c.ends_on or day>(now() at time zone 'UTC')::date or not (extract(dow from day)::int=any(g.weekdays)) then raise exception 'Not a scheduled competition day'; end if;
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

create function public.review_progress(eid uuid, decision text, reason text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select competition_id into cid from public.progress_entries where id=eid;
 if not public.is_admin(cid) or decision not in ('verified','rejected','honor') then raise exception 'Forbidden or invalid decision'; end if;
 update public.progress_entries set verification=decision,reviewed_by=auth.uid(),review_note=coalesce(reason,''),updated_at=now() where id=eid;
end $$;

create function public.create_team(cid uuid, team_name text) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; start_day date;
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 if exists(select 1 from public.progress_entries where competition_id=cid and user_id=auth.uid()) then raise exception 'Team choice locks after your first progress entry'; end if;
 if (now() at time zone 'UTC')::date>(select ends_on from public.competitions where id=cid) then raise exception 'Team registration is closed'; end if;
 insert into public.teams(competition_id,name,created_by) values(cid,trim(team_name),auth.uid()) returning id into tid;
 update public.memberships set team_id=tid where competition_id=cid and user_id=auth.uid();
end $$;
create function public.join_team(cid uuid, tid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 if exists(select 1 from public.progress_entries where competition_id=cid and user_id=auth.uid()) then raise exception 'Team choice locks after your first progress entry'; end if;
 if (now() at time zone 'UTC')::date>(select ends_on from public.competitions where id=cid) then raise exception 'Team registration is closed'; end if;
 if tid is not null and not exists(select 1 from public.teams where id=tid and competition_id=cid) then raise exception 'Invalid team'; end if;
 update public.memberships set team_id=tid where competition_id=cid and user_id=auth.uid();
end $$;

create function public.add_comment(eid uuid, content text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select competition_id into cid from public.progress_entries where id=eid;
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 insert into public.comments(competition_id,entry_id,user_id,body) values(cid,eid,auth.uid(),trim(content));
end $$;
create function public.toggle_reaction(eid uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select competition_id into cid from public.progress_entries where id=eid;
 if not public.is_member(cid) then raise exception 'Forbidden'; end if;
 delete from public.reactions where entry_id=eid and user_id=auth.uid();
 if not found then insert into public.reactions(competition_id,entry_id,user_id) values(cid,eid,auth.uid()); end if;
end $$;
create function public.manage_member(cid uuid, uid uuid, member_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(cid) or uid=auth.uid() or member_status not in ('active','suspended') then raise exception 'Forbidden'; end if;
 update public.memberships set status=member_status where competition_id=cid and user_id=uid and role<>'admin';
end $$;
create function public.publish_announcement(cid uuid, content text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 insert into public.announcements(competition_id,body,created_by) values(cid,trim(content),auth.uid());
end $$;
create function public.set_prize(cid uuid, prize_position integer, content text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 update public.prizes set description=trim(content) where competition_id=cid and place=prize_position;
end $$;
create function public.admin_edit_goal(gid uuid, goal_title text, goal_category text, goal_target numeric, goal_unit text, goal_weekdays integer[]) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select competition_id into cid from public.goals where id=gid;
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 update public.goals set title=trim(goal_title),category=goal_category,target=goal_target,unit=trim(goal_unit),weekdays=array(select distinct unnest(goal_weekdays)) where id=gid;
end $$;
create function public.revoke_invitation(iid uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select competition_id into cid from public.invitations where id=iid;
 if not public.is_admin(cid) then raise exception 'Forbidden'; end if;
 update public.invitations set expires_at=now() where id=iid and used_at is null;
end $$;

-- Invoker views retain underlying table RLS. Scores ignore rejected entries and cap over-reporting.
create view public.goal_scores with (security_invoker=true) as
 select g.id,g.competition_id,g.user_id,g.title,g.category,g.target,g.unit,g.weekdays,
 case when g.category='fitness' then 2 else 1 end as weight,
 count(d.day)::integer as scheduled_days,
 count(p.id) filter(where p.verification<>'rejected')::integer as logged_days,
 count(p.id) filter(where p.verification<>'rejected' and p.value>=g.target)::integer as completed_days,
 coalesce(round(100*(0.7*coalesce(sum(case when p.verification<>'rejected' then least(1,p.value/g.target) else 0 end),0)+0.3*count(p.id) filter(where p.verification<>'rejected' and p.value>=g.target))/nullif(count(d.day),0),2),0) as score
 from public.goals g join public.competitions c on c.id=g.competition_id
 left join lateral (select dd::date as day from generate_series(c.starts_on::timestamp,least(c.ends_on,(now() at time zone 'UTC')::date)::timestamp,interval '1 day') dd where extract(dow from dd)::int=any(g.weekdays)) d on true
 left join public.progress_entries p on p.goal_id=g.id and p.logged_on=d.day
 group by g.id;
create view public.individual_scores with(security_invoker=true) as
 select m.competition_id,m.user_id,m.display_name,m.team_id,
 coalesce(round(sum(g.score*g.weight)/nullif(sum(g.weight),0),2),0) as score,
 coalesce(sum(g.completed_days),0)::integer as completed_days,
 coalesce(sum(g.logged_days),0)::integer as logged_days,
 count(g.id)::integer as goal_count
 from public.memberships m left join public.goal_scores g on g.competition_id=m.competition_id and g.user_id=m.user_id
 where m.status='active' group by m.competition_id,m.user_id;
create view public.team_scores with(security_invoker=true) as
 select t.id,t.competition_id,t.name,count(s.user_id)::integer as member_count,coalesce(round(avg(s.score),2),0) as score
 from public.teams t left join public.individual_scores s on s.team_id=t.id and s.competition_id=t.competition_id group by t.id;
grant select on public.goal_scores,public.individual_scores,public.team_scores to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('progress-evidence','progress-evidence',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy evidence_upload on storage.objects for insert to authenticated with check(
 bucket_id='progress-evidence' and (storage.foldername(name))[1]=auth.uid()::text and public.is_member('20260000-0000-4000-8000-000000000001')
);
create policy evidence_download on storage.objects for select to authenticated using(
 bucket_id='progress-evidence' and (((storage.foldername(name))[1]=auth.uid()::text and public.is_member('20260000-0000-4000-8000-000000000001')) or exists(select 1 from public.evidence e where e.path=name and public.is_admin(e.competition_id)))
);
create policy orphan_evidence_delete on storage.objects for delete to authenticated using(
 bucket_id='progress-evidence' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.evidence e where e.path=name)
);
-- Explicit execution grants: public/anonymous cannot call privileged functions.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_member(uuid),public.is_admin(uuid),public.accept_invitation(text,text),public.create_invitation(uuid,text,text),public.save_goal(uuid,text,text,numeric,text,integer[]),public.record_progress(uuid,date,numeric,text,text),public.review_progress(uuid,text,text),public.create_team(uuid,text),public.join_team(uuid,uuid),public.add_comment(uuid,text),public.toggle_reaction(uuid),public.manage_member(uuid,uuid,text),public.publish_announcement(uuid,text),public.set_prize(uuid,integer,text),public.admin_edit_goal(uuid,text,text,numeric,text,integer[]),public.revoke_invitation(uuid) to authenticated;
commit;
