create table if not exists public.teryzon_chat_rate_limits (
  identifier_hash text primary key check (length(identifier_hash) = 64),
  request_times timestamptz[] not null default '{}'::timestamptz[],
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists teryzon_chat_rate_limits_updated_at_idx
  on public.teryzon_chat_rate_limits (updated_at);

alter table public.teryzon_chat_rate_limits enable row level security;
revoke all on table public.teryzon_chat_rate_limits from public, anon, authenticated;

create or replace function public.consume_teryzon_chat_rate_limit(
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_request_times timestamptz[];
  v_request_count integer;
begin
  if p_identifier_hash is null
    or length(p_identifier_hash) <> 64
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.teryzon_chat_rate_limits as current_limit (
    identifier_hash,
    request_times,
    updated_at
  )
  values (p_identifier_hash, array[v_now], v_now)
  on conflict (identifier_hash) do update
  set request_times = (
    select case
      when count(*) >= p_limit then coalesce(
        array_agg(previous_request.requested_at order by previous_request.requested_at),
        '{}'::timestamptz[]
      )
      else array_append(
        coalesce(
          array_agg(previous_request.requested_at order by previous_request.requested_at),
          '{}'::timestamptz[]
        ),
        v_now
      )
    end
    from unnest(current_limit.request_times) as previous_request(requested_at)
    where previous_request.requested_at > v_now - make_interval(secs => p_window_seconds)
  ),
  updated_at = v_now
  returning request_times into v_request_times;

  v_request_count := cardinality(v_request_times);

  return query
  select
    v_request_count <= p_limit,
    case
      when v_request_count <= p_limit then 0
      else greatest(
        1,
        ceil(extract(epoch from (v_request_times[1] + make_interval(secs => p_window_seconds) - v_now)))::integer
      )
    end;

  delete from public.teryzon_chat_rate_limits
  where identifier_hash in (
    select stale.identifier_hash
    from public.teryzon_chat_rate_limits as stale
    where stale.updated_at < v_now - interval '24 hours'
    order by stale.updated_at
    limit 100
  );
end;
$$;

revoke all on function public.consume_teryzon_chat_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_teryzon_chat_rate_limit(text, integer, integer) to service_role;
