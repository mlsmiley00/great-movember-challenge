-- Run with psql after replacing the psql variable with your verified account email:
-- psql "$DATABASE_URL" -v admin_email='you@example.com' -f scripts/bootstrap-admin.sql
-- Or replace :'admin_email' below with a quoted email in Supabase SQL Editor.
begin;
create temporary table bootstrap_user as
select id from auth.users where lower(email)=lower(:'admin_email') and email_confirmed_at is not null;
do $$ begin if (select count(*) from bootstrap_user)<>1 then raise exception 'Create and verify exactly one matching account first'; end if; end $$;
insert into public.memberships(competition_id,user_id,display_name,role)
select '20260000-0000-4000-8000-000000000001',id,'Challenge Host','admin' from bootstrap_user
on conflict(competition_id,user_id) do update set role='admin',status='active';
insert into public.goals(competition_id,user_id,title,category,target,unit,weekdays)
select '20260000-0000-4000-8000-000000000001',id,'Walk 10,000 steps every day','fitness',10000,'steps',array[0,1,2,3,4,5,6] from bootstrap_user b
where not exists(select 1 from public.goals g where g.user_id=b.id and g.competition_id='20260000-0000-4000-8000-000000000001' and g.title='Walk 10,000 steps every day');
commit;
