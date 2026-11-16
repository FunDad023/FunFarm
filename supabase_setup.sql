-- Sky-Island Homestead: run the entire file in Supabase SQL Editor.
-- All gold, inventory and plot mutations run on PostgreSQL via authenticated RPC.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9]{3,24}$'),
  gold integer not null default 100 check (gold >= 0),
  exp integer not null default 0 check (exp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('seed', 'crop')),
  item_key text not null check (item_key in ('wheat', 'tomato', 'golden_pumpkin', 'crystal_berry')),
  quantity integer not null default 0 check (quantity >= 0),
  unique(user_id, item_type, item_key)
);

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plot_index integer not null check (plot_index between 0 and 35),
  is_unlocked boolean not null default false,
  crop_key text check (crop_key in ('wheat', 'tomato', 'golden_pumpkin', 'crystal_berry')),
  planted_at timestamptz,
  harvest_at timestamptz,
  is_watered boolean not null default false,
  is_stolen boolean not null default false,
  unique(user_id, plot_index),
  check ((crop_key is null and planted_at is null and harvest_at is null and is_watered = false and is_stolen = false)
      or (crop_key is not null and planted_at is not null and harvest_at is not null))
);

create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  island_owner_id uuid not null references public.profiles(id) on delete cascade,
  visitor_username text not null,
  action_type text not null check (action_type in ('message', 'water', 'steal')),
  content text not null check (char_length(trim(content)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists inventories_user_idx on public.inventories(user_id, item_type, item_key);
create index if not exists plots_island_idx on public.plots(user_id, plot_index);
create index if not exists guestbook_island_time_idx on public.guestbook(island_owner_id, created_at desc);
create index if not exists profiles_world_idx on public.profiles(level desc, username);

alter table public.profiles enable row level security;
alter table public.inventories enable row level security;
alter table public.plots enable row level security;
alter table public.guestbook enable row level security;

drop policy if exists "Authenticated players can view the world" on public.profiles;
create policy "Authenticated players can view the world" on public.profiles
  for select to authenticated using (true);
drop policy if exists "Players can view their own inventory" on public.inventories;
create policy "Players can view their own inventory" on public.inventories
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Authenticated players can view island plots" on public.plots;
create policy "Authenticated players can view island plots" on public.plots
  for select to authenticated using (true);
drop policy if exists "Authenticated players can view guestbooks" on public.guestbook;
create policy "Authenticated players can view guestbooks" on public.guestbook
  for select to authenticated using (true);

create or replace function public.sky_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))));
  if chosen_username !~ '^[a-z0-9]{3,24}$' then
    raise exception 'Username must contain 3 to 24 lowercase letters or digits.';
  end if;

  -- Supabase Auth still uses email internally. Mark our synthetic address confirmed at creation.
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = new.id;
  insert into public.profiles(id, username) values (new.id, chosen_username);
  insert into public.inventories(user_id, item_type, item_key, quantity)
    values (new.id, 'seed', 'wheat', 5);
  insert into public.plots(user_id, plot_index, is_unlocked)
    select new.id, plot_row.plot_index, plot_row.plot_index < 16 from generate_series(0, 35) as plot_row(plot_index);
  return new;
end;
$$;

drop trigger if exists sky_on_auth_user_created on auth.users;
create trigger sky_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.sky_handle_new_user();

create or replace function public.sky_award_exp(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set exp = exp + greatest(p_amount, 0),
      level = floor((exp + greatest(p_amount, 0))::numeric / 100)::integer + 1
  where id = p_user_id;
end;
$$;

create or replace function public.sky_inventory_add(p_user_id uuid, p_item_type text, p_item_key text, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive.'; end if;
  insert into public.inventories as inventory_row(user_id, item_type, item_key, quantity)
    values (p_user_id, p_item_type, p_item_key, p_quantity)
  on conflict (user_id, item_type, item_key)
  do update set quantity = inventory_row.quantity + excluded.quantity;
end;
$$;

create or replace function public.plant_seed(p_plot_id uuid, p_crop_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  grow_seconds integer;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  grow_seconds := case p_crop_key when 'wheat' then 30 when 'tomato' then 120 when 'golden_pumpkin' then 300 when 'crystal_berry' then 900 else null end;
  if grow_seconds is null then raise exception 'Unknown crop.'; end if;
  perform 1 from public.plots where id = p_plot_id and user_id = player_id and is_unlocked and crop_key is null for update;
  if not found then raise exception 'This plot is locked, occupied, or not yours.'; end if;
  update public.inventories set quantity = quantity - 1
    where user_id = player_id and item_type = 'seed' and item_key = p_crop_key and quantity > 0;
  if not found then raise exception 'You do not have that seed.'; end if;
  delete from public.inventories where user_id = player_id and item_type = 'seed' and item_key = p_crop_key and quantity = 0;
  update public.plots set crop_key = p_crop_key, planted_at = now(), harvest_at = now() + make_interval(secs => grow_seconds), is_watered = false, is_stolen = false
    where id = p_plot_id;
  return jsonb_build_object('ok', true, 'harvest_at', now() + make_interval(secs => grow_seconds));
end;
$$;

create or replace function public.water_plot(p_plot_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  owner_id uuid;
  crop text;
  finish_at timestamptz;
  shortened_at timestamptz;
  visitor text;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  select user_id, crop_key, harvest_at into owner_id, crop, finish_at
    from public.plots where id = p_plot_id and is_unlocked for update;
  if owner_id is null then raise exception 'Plot not found.'; end if;
  if crop is null or finish_at <= now() then raise exception 'Only growing crops can be watered.'; end if;
  if exists(select 1 from public.plots where id = p_plot_id and is_watered) then raise exception 'This crop has already been watered.'; end if;
  shortened_at := greatest(now(), finish_at - make_interval(secs => case crop when 'wheat' then 6 when 'tomato' then 24 when 'golden_pumpkin' then 60 when 'crystal_berry' then 180 end));
  update public.plots set is_watered = true, harvest_at = shortened_at where id = p_plot_id;
  if player_id <> owner_id then
    select username into visitor from public.profiles where id = player_id;
    update public.profiles set gold = gold + 10 where id = player_id;
    perform public.sky_award_exp(player_id, 5);
    insert into public.guestbook(island_owner_id, visitor_username, action_type, content)
      values (owner_id, visitor, 'water', 'đã tưới giúp một mầm cây.');
  end if;
  return jsonb_build_object('ok', true, 'harvest_at', shortened_at, 'visitor_reward', player_id <> owner_id);
end;
$$;

create or replace function public.harvest_crop(p_plot_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  crop text;
  stolen boolean;
  quantity_to_add integer;
  exp_gain integer;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  select crop_key, is_stolen into crop, stolen from public.plots
    where id = p_plot_id and user_id = player_id and is_unlocked for update;
  if crop is null then raise exception 'No crop to harvest on this plot.'; end if;
  if not exists(select 1 from public.plots where id = p_plot_id and harvest_at <= now()) then raise exception 'This crop is not ripe yet.'; end if;
  quantity_to_add := case when stolen then 1 else 2 end;
  exp_gain := case crop when 'wheat' then 5 when 'tomato' then 15 when 'golden_pumpkin' then 40 when 'crystal_berry' then 100 end;
  perform public.sky_inventory_add(player_id, 'crop', crop, quantity_to_add);
  perform public.sky_award_exp(player_id, exp_gain);
  update public.plots set crop_key = null, planted_at = null, harvest_at = null, is_watered = false, is_stolen = false where id = p_plot_id;
  return jsonb_build_object('ok', true, 'crop_key', crop, 'quantity', quantity_to_add, 'exp', exp_gain);
end;
$$;

create or replace function public.steal_crop(p_plot_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  owner_id uuid;
  crop text;
  visitor text;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  select user_id, crop_key into owner_id, crop from public.plots where id = p_plot_id and is_unlocked for update;
  if owner_id is null then raise exception 'Plot not found.'; end if;
  if owner_id = player_id then raise exception 'You cannot steal from your own island.'; end if;
  if crop is null or not exists(select 1 from public.plots where id = p_plot_id and harvest_at <= now() and not is_stolen) then
    raise exception 'This crop cannot be stolen.';
  end if;
  select username into visitor from public.profiles where id = player_id;
  update public.plots set is_stolen = true where id = p_plot_id;
  perform public.sky_inventory_add(player_id, 'crop', crop, 1);
  insert into public.guestbook(island_owner_id, visitor_username, action_type, content)
    values (owner_id, visitor, 'steal', 'đã hái trộm một nông sản chín!');
  return jsonb_build_object('ok', true, 'crop_key', crop, 'quantity', 1);
end;
$$;

create or replace function public.buy_seed(p_crop_key text, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  unit_price integer;
  total_cost integer;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  if p_quantity not between 1 and 99 then raise exception 'Choose between 1 and 99 seeds.'; end if;
  unit_price := case p_crop_key when 'wheat' then 10 when 'tomato' then 30 when 'golden_pumpkin' then 80 when 'crystal_berry' then 200 else null end;
  if unit_price is null then raise exception 'Unknown seed.'; end if;
  total_cost := unit_price * p_quantity;
  update public.profiles set gold = gold - total_cost where id = player_id and gold >= total_cost;
  if not found then raise exception 'Not enough gold.'; end if;
  perform public.sky_inventory_add(player_id, 'seed', p_crop_key, p_quantity);
  return jsonb_build_object('ok', true, 'cost', total_cost);
end;
$$;

create or replace function public.sell_crop(p_crop_key text, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  unit_price integer;
  total_value integer;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  if p_quantity not between 1 and 999 then raise exception 'Choose a valid quantity.'; end if;
  unit_price := case p_crop_key when 'wheat' then 25 when 'tomato' then 75 when 'golden_pumpkin' then 210 when 'crystal_berry' then 550 else null end;
  if unit_price is null then raise exception 'Unknown crop.'; end if;
  update public.inventories set quantity = quantity - p_quantity
    where user_id = player_id and item_type = 'crop' and item_key = p_crop_key and quantity >= p_quantity;
  if not found then raise exception 'Not enough crops to sell.'; end if;
  delete from public.inventories where user_id = player_id and item_type = 'crop' and item_key = p_crop_key and quantity = 0;
  total_value := unit_price * p_quantity;
  update public.profiles set gold = gold + total_value where id = player_id;
  return jsonb_build_object('ok', true, 'gold_earned', total_value);
end;
$$;

create or replace function public.unlock_plot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  unlocked_count integer;
  next_index integer;
  cost integer;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  perform 1 from public.profiles where id = player_id for update;
  select count(*) into unlocked_count from public.plots where user_id = player_id and is_unlocked;
  if unlocked_count >= 36 then raise exception 'Every plot is already unlocked.'; end if;
  next_index := unlocked_count;
  cost := 50 + greatest(unlocked_count - 16, 0) * 25;
  update public.profiles set gold = gold - cost where id = player_id and gold >= cost;
  if not found then raise exception 'Not enough gold to unlock the next plot.'; end if;
  update public.plots set is_unlocked = true where user_id = player_id and plot_index = next_index and not is_unlocked;
  if not found then raise exception 'Could not unlock the next plot.'; end if;
  return jsonb_build_object('ok', true, 'plot_index', next_index, 'cost', cost);
end;
$$;

create or replace function public.leave_message(p_island_owner_id uuid, p_content text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  visitor text;
begin
  if player_id is null then raise exception 'Please sign in first.'; end if;
  if p_island_owner_id = player_id then raise exception 'Write a guestbook note on a neighbor island.'; end if;
  if char_length(trim(coalesce(p_content, ''))) not between 1 and 300 then raise exception 'Message must be 1 to 300 characters.'; end if;
  select username into visitor from public.profiles where id = player_id;
  if not found or not exists(select 1 from public.profiles where id = p_island_owner_id) then raise exception 'Island not found.'; end if;
  insert into public.guestbook(island_owner_id, visitor_username, action_type, content)
    values (p_island_owner_id, visitor, 'message', trim(p_content));
  return jsonb_build_object('ok', true);
end;
$$;

-- Prevent clients from writing sensitive rows directly. Only SELECT policies above are available.
revoke all on public.profiles, public.inventories, public.plots, public.guestbook from anon, authenticated;
grant select on public.profiles, public.inventories, public.plots, public.guestbook to authenticated;
revoke all on function public.sky_award_exp(uuid, integer) from public, anon, authenticated;
revoke all on function public.sky_inventory_add(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.sky_handle_new_user() from public, anon, authenticated;

revoke all on function public.plant_seed(uuid, text) from public, anon;
revoke all on function public.water_plot(uuid) from public, anon;
revoke all on function public.harvest_crop(uuid) from public, anon;
revoke all on function public.steal_crop(uuid) from public, anon;
revoke all on function public.buy_seed(text, integer) from public, anon;
revoke all on function public.sell_crop(text, integer) from public, anon;
revoke all on function public.unlock_plot() from public, anon;
revoke all on function public.leave_message(uuid, text) from public, anon;
grant execute on function public.plant_seed(uuid, text) to authenticated;
grant execute on function public.water_plot(uuid) to authenticated;
grant execute on function public.harvest_crop(uuid) to authenticated;
grant execute on function public.steal_crop(uuid) to authenticated;
grant execute on function public.buy_seed(text, integer) to authenticated;
grant execute on function public.sell_crop(text, integer) to authenticated;
grant execute on function public.unlock_plot() to authenticated;
grant execute on function public.leave_message(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plots') then
      alter publication supabase_realtime add table public.plots;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guestbook') then
      alter publication supabase_realtime add table public.guestbook;
    end if;
  end if;
end;
$$;
