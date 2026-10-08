begin;
-- Run once in a new Supabase project. All functions are SECURITY INVOKER.
create extension if not exists btree_gist;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 timezone text not null default 'Asia/Ho_Chi_Minh',
 theme text not null default 'system' check(theme in ('light','dark','system')),
 weekly_goal_minutes integer not null default 600 check(weekly_goal_minutes between 1 and 10080),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.habits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80), kind text not null check(kind in ('checkbox','number','duration','measurement')),
 target numeric not null default 1 check(target>0), unit text not null default '' check(length(unit)<=24),
 days integer[] not null default '{0,1,2,3,4,5,6}' check(days <@ array[0,1,2,3,4,5,6] and cardinality(days)>0),
 start_date date not null default current_date, archived boolean not null default false,
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id), check(kind<>'checkbox' or target=1)
);
create table public.habit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 habit_id uuid not null, date date not null, value numeric not null check(value>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade,
 unique(habit_id,date)
);
create table public.study_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check(length(subject) between 1 and 100), note text not null default '' check(length(note)<=2000),
 status text not null check(status in ('running','paused','completed')),
 active_since timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status='running')=(active_since is not null)), unique(id,user_id)
);
create unique index one_unfinished_focus on public.study_sessions(user_id) where status <> 'completed';
create table public.study_segments (
 id uuid primary key default gen_random_uuid(), session_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null, ended_at timestamptz not null,
 foreign key(session_id,user_id) references public.study_sessions(id,user_id) on delete cascade,
 check(ended_at>started_at), check(ended_at-started_at<=interval '24 hours'),
 exclude using gist(user_id with =, tstzrange(started_at,ended_at,'[)') with &&)
);
create index habits_owner on public.habits(user_id,position);
create index logs_owner_date on public.habit_logs(user_id,date);
create index sessions_owner on public.study_sessions(user_id,created_at);
create index segments_owner_date on public.study_segments(user_id,started_at);
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger habits_updated before update on public.habits for each row execute function public.touch_updated_at();
create trigger logs_updated before update on public.habit_logs for each row execute function public.touch_updated_at();
create trigger sessions_updated before update on public.study_sessions for each row execute function public.touch_updated_at();
do $$ declare t text; begin
 foreach t in array array['profiles','habits','habit_logs','study_sessions','study_segments'] loop
 execute format('alter table public.%I enable row level security',t);
 if t='profiles' then
 execute format('create policy owner_all on public.%I for all to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()))',t);
 else
 execute format('create policy owner_all on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
 end if;
 execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
-- Atomic focus transitions; lock by user to serialize competing tabs/requests.
create function public.focus_transition(p_id uuid,p_action text,p_subject text default 'Self-study') returns void
language plpgsql security invoker set search_path=public as $$
declare s public.study_sessions; stamp timestamptz:=clock_timestamp(); begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_action='start' then
 insert into public.study_sessions(id,user_id,subject,status,active_since) values(p_id,auth.uid(),p_subject,'running',stamp) on conflict(id) do nothing;
 return;
 end if;
 select * into s from public.study_sessions where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Session not found'; end if;
 if p_action='resume' and s.status='paused' then
 update public.study_sessions set status='running',active_since=stamp where id=p_id;
 elsif p_action in ('pause','finish') and s.status<>'completed' then
 if s.status='running' and stamp>s.active_since then
 -- Cap abandoned timers at 24h; user can correct their log afterward.
 insert into public.study_segments(session_id,user_id,started_at,ended_at) values(p_id,auth.uid(),s.active_since,least(stamp,s.active_since+interval '24 hours')); 
 end if;
 update public.study_sessions set status=case when p_action='finish' then 'completed' else 'paused' end, active_since=null where id=p_id;
 elsif p_action not in ('pause','finish','resume') then raise exception 'Invalid action';
 end if;
end $$;
create function public.save_manual_session(p_id uuid,p_subject text,p_note text,p_start timestamptz,p_end timestamptz) returns void
language plpgsql security invoker set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_end<=p_start or p_end-p_start>interval '24 hours' or p_end>clock_timestamp()+interval '1 minute' then raise exception 'Invalid time range'; end if;
 if exists(select 1 from public.study_sessions where user_id=auth.uid() and status<>'completed') then raise exception 'Finish the active focus session first'; end if;
 if exists(select 1 from public.study_sessions where id=p_id and status<>'completed') then raise exception 'Finish this session first'; end if;
 insert into public.study_sessions(id,user_id,subject,note,status) values(p_id,auth.uid(),p_subject,p_note,'completed')
 on conflict(id) do update set subject=excluded.subject,note=excluded.note;
 delete from public.study_segments where session_id=p_id;
 insert into public.study_segments(session_id,user_id,started_at,ended_at) values(p_id,auth.uid(),p_start,p_end);
end $$;
revoke execute on function public.focus_transition(uuid,text,text) from public,anon;
revoke execute on function public.save_manual_session(uuid,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.focus_transition(uuid,text,text) to authenticated;
grant execute on function public.save_manual_session(uuid,text,text,timestamptz,timestamptz) to authenticated;

commit;
