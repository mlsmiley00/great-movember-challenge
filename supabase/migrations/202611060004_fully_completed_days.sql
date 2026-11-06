begin;
-- One row per member/date with at least one scheduled goal. Missing reports
-- and rejected reports cannot complete a goal; over-target reports count once.
create view public.daily_completion with(security_invoker=true) as
 select g.competition_id,g.user_id,d.day::date as activity_date,
 count(*)::integer as scheduled_goals,
 count(p.id) filter(where p.verification<>'rejected' and p.value>=g.target)::integer as completed_goals,
 bool_and(coalesce(p.verification<>'rejected' and p.value>=g.target,false)) as is_complete
 from public.goals g join public.competitions c on c.id=g.competition_id
 cross join lateral generate_series(c.starts_on::timestamp,least(c.ends_on,(now() at time zone 'UTC')::date)::timestamp,interval '1 day') d(day)
 left join public.progress_entries p on p.goal_id=g.id and p.logged_on=d.day::date
 where extract(dow from d.day)::int=any(g.weekdays)
 group by g.competition_id,g.user_id,d.day::date;
revoke all on public.daily_completion from public,anon,authenticated;
grant select on public.daily_completion to authenticated;

-- Preserve the weighted score formula and per-goal completion counts. Only the
-- member's completed_days column becomes a count of distinct fully complete days.
create or replace view public.individual_scores with(security_invoker=true) as
 select m.competition_id,m.user_id,m.display_name,m.team_id,
 coalesce(round(sum(g.score*g.weight)/nullif(sum(g.weight),0),2),0) as score,
 (select count(*)::integer from public.daily_completion d where d.competition_id=m.competition_id and d.user_id=m.user_id and d.is_complete) as completed_days,
 coalesce(sum(g.logged_days),0)::integer as logged_days,
 count(g.id)::integer as goal_count
 from public.memberships m left join public.goal_scores g on g.competition_id=m.competition_id and g.user_id=m.user_id
 where m.status='active' group by m.competition_id,m.user_id;
commit;
