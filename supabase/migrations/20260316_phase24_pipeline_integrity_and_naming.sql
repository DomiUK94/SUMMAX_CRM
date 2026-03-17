create schema if not exists sourcecrm;
create schema if not exists fact;

do $$
begin
  if to_regclass('sourcecrm.saved_views') is not null then
    update sourcecrm.saved_views
    set module = 'business',
        updated_at = now()
    where module = 'deals';

    update sourcecrm.saved_views
    set module = 'tasks',
        updated_at = now()
    where module = 'activities';

    alter table sourcecrm.saved_views
      drop constraint if exists saved_views_module_check;

    alter table sourcecrm.saved_views
      add constraint saved_views_module_check
      check (module in ('contacts', 'investors', 'business', 'tasks'));
  end if;
end
$$;

do $$
begin
  if to_regclass('sourcecrm.audit_log') is not null then
    update sourcecrm.audit_log
    set entity_type = 'opportunity'
    where entity_type = 'deal';

    update sourcecrm.audit_log
    set entity_type = 'task'
    where entity_type = 'activity';

    alter table sourcecrm.audit_log
      drop constraint if exists audit_log_entity_type_check;

    alter table sourcecrm.audit_log
      add constraint audit_log_entity_type_check
      check (entity_type in ('contact', 'investor', 'lead', 'opportunity', 'task', 'product', 'saved_view', 'tag'));
  end if;
end
$$;

do $$
begin
  if to_regclass('sourcecrm.entity_tags') is not null then
    update sourcecrm.entity_tags
    set entity_type = 'opportunity'
    where entity_type = 'deal';

    update sourcecrm.entity_tags
    set entity_type = 'task'
    where entity_type = 'activity';

    alter table sourcecrm.entity_tags
      drop constraint if exists entity_tags_entity_type_check;

    alter table sourcecrm.entity_tags
      add constraint entity_tags_entity_type_check
      check (entity_type in ('contact', 'investor', 'lead', 'opportunity', 'task', 'product'));
  end if;
end
$$;

create or replace view sourcecrm.state as
select * from dim.state;

create or replace view sourcecrm.task as
select * from dim.task;

create or replace view sourcecrm.product as
select * from dim.product;

create or replace view sourcecrm.pipeline_event as
select * from fact.pipeline_event;

grant select on sourcecrm.state to authenticated, service_role;
grant select on sourcecrm.task to authenticated, service_role;
grant select on sourcecrm.product to authenticated, service_role;
grant select, insert on sourcecrm.pipeline_event to authenticated, service_role;

create or replace function sourcecrm.pipeline_convert_lead_to_opportunity(
  p_lead_id uuid,
  p_product_id uuid,
  p_opportunity_state_id uuid,
  p_opportunity_name text default null,
  p_owner_user_id uuid default null,
  p_owner_email text default null,
  p_actor_user_id uuid default null,
  p_actor_email text default null,
  p_estimated_amount numeric default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns table (
  lead_id uuid,
  opportunity_id uuid
)
language plpgsql
security definer
set search_path = sourcecrm, dim, fact, public
as $$
declare
  v_lead sourcecrm.leads%rowtype;
  v_current_state dim.state%rowtype;
  v_opportunity sourcecrm.opportunities%rowtype;
begin
  select *
  into v_lead
  from sourcecrm.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead no encontrado';
  end if;

  if v_lead.resolution <> 'open' then
    raise exception 'Solo se pueden convertir leads abiertos';
  end if;

  select *
  into v_current_state
  from dim.state
  where id = v_lead.current_state_id;

  if not found or not v_current_state.is_conversion_state then
    raise exception 'El lead no esta en un estado convertible';
  end if;

  insert into sourcecrm.opportunities (
    lead_id,
    company_id,
    contact_id,
    product_id,
    current_state_id,
    name,
    owner_user_id,
    owner_email,
    created_by_user_id,
    created_by_email,
    opened_at,
    estimated_amount,
    notes
  )
  values (
    v_lead.id,
    v_lead.company_id,
    v_lead.contact_id,
    p_product_id,
    p_opportunity_state_id,
    coalesce(nullif(trim(p_opportunity_name), ''), v_lead.name),
    coalesce(p_owner_user_id, v_lead.owner_user_id),
    coalesce(nullif(trim(p_owner_email), ''), v_lead.owner_email),
    coalesce(p_actor_user_id, v_lead.created_by_user_id),
    coalesce(nullif(trim(p_actor_email), ''), v_lead.created_by_email),
    coalesce(p_occurred_at, now()),
    p_estimated_amount,
    coalesce(nullif(trim(p_notes), ''), v_lead.notes)
  )
  returning *
  into v_opportunity;

  update sourcecrm.leads
  set resolution = 'converted',
      converted_at = coalesce(p_occurred_at, now()),
      updated_at = now()
  where id = v_lead.id
  returning *
  into v_lead;

  insert into fact.pipeline_event (
    entity_type,
    lead_id,
    company_id,
    contact_id,
    state_id,
    event_type,
    occurred_at,
    actor_user_id,
    actor_email,
    notes,
    metadata
  )
  values (
    'lead',
    v_lead.id,
    v_lead.company_id,
    v_lead.contact_id,
    v_lead.current_state_id,
    'converted',
    coalesce(p_occurred_at, now()),
    p_actor_user_id,
    p_actor_email,
    nullif(trim(p_notes), ''),
    jsonb_build_object(
      'opportunity_id', v_opportunity.id,
      'product_id', v_opportunity.product_id
    )
  );

  insert into fact.pipeline_event (
    entity_type,
    opportunity_id,
    company_id,
    contact_id,
    product_id,
    state_id,
    event_type,
    occurred_at,
    actor_user_id,
    actor_email,
    notes,
    metadata
  )
  values (
    'opportunity',
    v_opportunity.id,
    v_opportunity.company_id,
    v_opportunity.contact_id,
    v_opportunity.product_id,
    v_opportunity.current_state_id,
    'state_entered',
    coalesce(p_occurred_at, now()),
    p_actor_user_id,
    p_actor_email,
    'Opportunity creada desde lead',
    jsonb_build_object('lead_id', v_lead.id)
  );

  return query
  select v_lead.id, v_opportunity.id;
end;
$$;

create or replace function sourcecrm.pipeline_complete_task(
  p_entity_type text,
  p_lead_id uuid default null,
  p_opportunity_id uuid default null,
  p_task_id uuid default null,
  p_actor_user_id uuid default null,
  p_actor_email text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns table (
  entity_type text,
  lead_id uuid,
  opportunity_id uuid,
  resulting_state_id uuid,
  resulting_resolution text,
  terminal_event_type text,
  task_name text,
  resulting_state_name text
)
language plpgsql
security definer
set search_path = sourcecrm, dim, fact, public
as $$
declare
  v_task dim.task%rowtype;
  v_target_state dim.state%rowtype;
  v_lead sourcecrm.leads%rowtype;
  v_opportunity sourcecrm.opportunities%rowtype;
  v_next_resolution text;
  v_terminal_event_type text;
  v_state_changed boolean;
begin
  select *
  into v_task
  from dim.task
  where id = p_task_id;

  if not found then
    raise exception 'Tarea no encontrada';
  end if;

  if v_task.entity_type <> 'both' and v_task.entity_type <> p_entity_type then
    raise exception 'La tarea no aplica a esta entidad';
  end if;

  select *
  into v_target_state
  from dim.state
  where id = coalesce(v_task.resulting_state_id, v_task.state_id);

  if not found then
    raise exception 'Estado destino no encontrado';
  end if;

  if p_entity_type = 'lead' then
    select *
    into v_lead
    from sourcecrm.leads
    where id = p_lead_id
    for update;

    if not found then
      raise exception 'Lead no encontrado';
    end if;

    if v_lead.current_state_id <> v_task.state_id then
      raise exception 'La tarea no corresponde al estado actual del lead';
    end if;

    insert into fact.pipeline_event (
      entity_type,
      lead_id,
      company_id,
      contact_id,
      state_id,
      task_id,
      event_type,
      occurred_at,
      actor_user_id,
      actor_email,
      notes,
      metadata
    )
    values (
      'lead',
      v_lead.id,
      v_lead.company_id,
      v_lead.contact_id,
      v_lead.current_state_id,
      v_task.id,
      'task_logged',
      coalesce(p_occurred_at, now()),
      p_actor_user_id,
      p_actor_email,
      nullif(trim(p_notes), ''),
      jsonb_build_object(
        'task_name', v_task.name,
        'resulting_state_id', v_target_state.id
      )
    );

    v_next_resolution :=
      case
        when not v_target_state.is_terminal then 'open'
        when v_target_state.code = 'descartado' then 'discarded'
        else 'closed'
      end;

    v_terminal_event_type :=
      case
        when not v_target_state.is_terminal then null
        when v_target_state.code = 'descartado' then 'discarded'
        else null
      end;

    v_state_changed := v_lead.current_state_id <> v_target_state.id or v_lead.resolution <> v_next_resolution;

    if v_state_changed then
      update sourcecrm.leads
      set current_state_id = v_target_state.id,
          resolution = v_next_resolution,
          closed_at = case when v_target_state.is_terminal then coalesce(p_occurred_at, now()) else null end,
          updated_at = now()
      where id = v_lead.id
      returning *
      into v_lead;

      insert into fact.pipeline_event (
        entity_type,
        lead_id,
        company_id,
        contact_id,
        state_id,
        event_type,
        occurred_at,
        actor_user_id,
        actor_email,
        notes,
        metadata
      )
      values (
        'lead',
        v_lead.id,
        v_lead.company_id,
        v_lead.contact_id,
        v_lead.current_state_id,
        'state_entered',
        coalesce(p_occurred_at, now()),
        p_actor_user_id,
        p_actor_email,
        format('Estado actualizado por tarea: %s', v_task.name),
        jsonb_build_object(
          'task_id', v_task.id,
          'previous_state_id', v_task.state_id,
          'resulting_state_id', v_target_state.id
        )
      );

      if v_terminal_event_type is not null then
        insert into fact.pipeline_event (
          entity_type,
          lead_id,
          company_id,
          contact_id,
          state_id,
          event_type,
          occurred_at,
          actor_user_id,
          actor_email,
          notes,
          metadata
        )
        values (
          'lead',
          v_lead.id,
          v_lead.company_id,
          v_lead.contact_id,
          v_lead.current_state_id,
          v_terminal_event_type,
          coalesce(p_occurred_at, now()),
          p_actor_user_id,
          p_actor_email,
          nullif(trim(p_notes), ''),
          jsonb_build_object('task_id', v_task.id)
        );
      end if;
    end if;

    return query
    select 'lead', v_lead.id, null::uuid, v_target_state.id, v_lead.resolution, v_terminal_event_type, v_task.name, v_target_state.name;
  else
    select *
    into v_opportunity
    from sourcecrm.opportunities
    where id = p_opportunity_id
    for update;

    if not found then
      raise exception 'Opportunity no encontrada';
    end if;

    if v_opportunity.current_state_id <> v_task.state_id then
      raise exception 'La tarea no corresponde al estado actual de la opportunity';
    end if;

    insert into fact.pipeline_event (
      entity_type,
      opportunity_id,
      company_id,
      contact_id,
      product_id,
      state_id,
      task_id,
      event_type,
      occurred_at,
      actor_user_id,
      actor_email,
      notes,
      metadata
    )
    values (
      'opportunity',
      v_opportunity.id,
      v_opportunity.company_id,
      v_opportunity.contact_id,
      v_opportunity.product_id,
      v_opportunity.current_state_id,
      v_task.id,
      'task_logged',
      coalesce(p_occurred_at, now()),
      p_actor_user_id,
      p_actor_email,
      nullif(trim(p_notes), ''),
      jsonb_build_object(
        'task_name', v_task.name,
        'resulting_state_id', v_target_state.id
      )
    );

    v_next_resolution :=
      case
        when not v_target_state.is_terminal then 'open'
        when v_target_state.code = 'descartado' then 'lost'
        when v_target_state.code = 'ingreso_cuenta' then 'won'
        else 'cancelled'
      end;

    v_terminal_event_type :=
      case
        when not v_target_state.is_terminal then null
        when v_target_state.code = 'descartado' then 'lost'
        when v_target_state.code = 'ingreso_cuenta' then 'won'
        else null
      end;

    v_state_changed := v_opportunity.current_state_id <> v_target_state.id or v_opportunity.resolution <> v_next_resolution;

    if v_state_changed then
      update sourcecrm.opportunities
      set current_state_id = v_target_state.id,
          resolution = v_next_resolution,
          closed_at = case when v_target_state.is_terminal then coalesce(p_occurred_at, now()) else null end,
          updated_at = now()
      where id = v_opportunity.id
      returning *
      into v_opportunity;

      insert into fact.pipeline_event (
        entity_type,
        opportunity_id,
        company_id,
        contact_id,
        product_id,
        state_id,
        event_type,
        occurred_at,
        actor_user_id,
        actor_email,
        notes,
        metadata
      )
      values (
        'opportunity',
        v_opportunity.id,
        v_opportunity.company_id,
        v_opportunity.contact_id,
        v_opportunity.product_id,
        v_opportunity.current_state_id,
        'state_entered',
        coalesce(p_occurred_at, now()),
        p_actor_user_id,
        p_actor_email,
        format('Estado actualizado por tarea: %s', v_task.name),
        jsonb_build_object(
          'task_id', v_task.id,
          'previous_state_id', v_task.state_id,
          'resulting_state_id', v_target_state.id
        )
      );

      if v_terminal_event_type is not null then
        insert into fact.pipeline_event (
          entity_type,
          opportunity_id,
          company_id,
          contact_id,
          product_id,
          state_id,
          event_type,
          occurred_at,
          actor_user_id,
          actor_email,
          notes,
          metadata
        )
        values (
          'opportunity',
          v_opportunity.id,
          v_opportunity.company_id,
          v_opportunity.contact_id,
          v_opportunity.product_id,
          v_opportunity.current_state_id,
          v_terminal_event_type,
          coalesce(p_occurred_at, now()),
          p_actor_user_id,
          p_actor_email,
          nullif(trim(p_notes), ''),
          jsonb_build_object('task_id', v_task.id)
        );
      end if;
    end if;

    return query
    select 'opportunity', null::uuid, v_opportunity.id, v_target_state.id, v_opportunity.resolution, v_terminal_event_type, v_task.name, v_target_state.name;
  end if;
end;
$$;

create or replace function sourcecrm.pipeline_change_state(
  p_entity_type text,
  p_lead_id uuid default null,
  p_opportunity_id uuid default null,
  p_target_state_id uuid default null,
  p_actor_user_id uuid default null,
  p_actor_email text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns table (
  entity_type text,
  lead_id uuid,
  opportunity_id uuid,
  resulting_state_id uuid,
  resulting_resolution text,
  terminal_event_type text,
  resulting_state_name text
)
language plpgsql
security definer
set search_path = sourcecrm, dim, fact, public
as $$
declare
  v_current_state dim.state%rowtype;
  v_target_state dim.state%rowtype;
  v_lead sourcecrm.leads%rowtype;
  v_opportunity sourcecrm.opportunities%rowtype;
  v_next_resolution text;
  v_terminal_event_type text;
begin
  select *
  into v_target_state
  from dim.state
  where id = p_target_state_id;

  if not found then
    raise exception 'No se ha podido resolver la transicion de estado';
  end if;

  if p_entity_type = 'lead' then
    select *
    into v_lead
    from sourcecrm.leads
    where id = p_lead_id
    for update;

    if not found then
      raise exception 'Lead no encontrado';
    end if;

    select *
    into v_current_state
    from dim.state
    where id = v_lead.current_state_id;

    if not found then
      raise exception 'No se ha podido resolver la transicion de estado';
    end if;

    if v_target_state.entity_type not in ('lead', 'both') then
      raise exception 'El estado destino no aplica a leads';
    end if;

    if v_target_state.id = v_current_state.id then
      raise exception 'La transicion manual no es valida para este lead';
    end if;

    if not (
      v_target_state.code = 'descartado'
      or v_target_state.previous_state_id = v_current_state.id
      or v_current_state.previous_state_id = v_target_state.id
    ) then
      raise exception 'La transicion manual no es valida para este lead';
    end if;

    v_next_resolution :=
      case
        when not v_target_state.is_terminal then 'open'
        when v_target_state.code = 'descartado' then 'discarded'
        else 'closed'
      end;

    v_terminal_event_type :=
      case
        when not v_target_state.is_terminal then null
        when v_target_state.code = 'descartado' then 'discarded'
        else null
      end;

    update sourcecrm.leads
    set current_state_id = v_target_state.id,
        resolution = v_next_resolution,
        closed_at = case when v_target_state.is_terminal then coalesce(p_occurred_at, now()) else null end,
        updated_at = now()
    where id = v_lead.id
    returning *
    into v_lead;

    insert into fact.pipeline_event (
      entity_type,
      lead_id,
      company_id,
      contact_id,
      state_id,
      event_type,
      occurred_at,
      actor_user_id,
      actor_email,
      notes,
      metadata
    )
    values (
      'lead',
      v_lead.id,
      v_lead.company_id,
      v_lead.contact_id,
      v_lead.current_state_id,
      'state_entered',
      coalesce(p_occurred_at, now()),
      p_actor_user_id,
      p_actor_email,
      coalesce(nullif(trim(p_notes), ''), format('Cambio manual a %s', v_target_state.name)),
      jsonb_build_object(
        'previous_state_id', v_current_state.id,
        'change_mode', 'manual'
      )
    );

    if v_terminal_event_type is not null then
      insert into fact.pipeline_event (
        entity_type,
        lead_id,
        company_id,
        contact_id,
        state_id,
        event_type,
        occurred_at,
        actor_user_id,
        actor_email,
        notes,
        metadata
      )
      values (
        'lead',
        v_lead.id,
        v_lead.company_id,
        v_lead.contact_id,
        v_lead.current_state_id,
        v_terminal_event_type,
        coalesce(p_occurred_at, now()),
        p_actor_user_id,
        p_actor_email,
        nullif(trim(p_notes), ''),
        jsonb_build_object('change_mode', 'manual')
      );
    end if;

    return query
    select 'lead', v_lead.id, null::uuid, v_target_state.id, v_lead.resolution, v_terminal_event_type, v_target_state.name;
  else
    select *
    into v_opportunity
    from sourcecrm.opportunities
    where id = p_opportunity_id
    for update;

    if not found then
      raise exception 'Opportunity no encontrada';
    end if;

    select *
    into v_current_state
    from dim.state
    where id = v_opportunity.current_state_id;

    if not found then
      raise exception 'No se ha podido resolver la transicion de estado';
    end if;

    if v_target_state.entity_type not in ('opportunity', 'both') then
      raise exception 'El estado destino no aplica a opportunities';
    end if;

    if v_target_state.id = v_current_state.id then
      raise exception 'La transicion manual no es valida para esta opportunity';
    end if;

    if not (
      v_target_state.code = 'descartado'
      or v_target_state.previous_state_id = v_current_state.id
      or v_current_state.previous_state_id = v_target_state.id
    ) then
      raise exception 'La transicion manual no es valida para esta opportunity';
    end if;

    v_next_resolution :=
      case
        when not v_target_state.is_terminal then 'open'
        when v_target_state.code = 'descartado' then 'lost'
        when v_target_state.code = 'ingreso_cuenta' then 'won'
        else 'cancelled'
      end;

    v_terminal_event_type :=
      case
        when not v_target_state.is_terminal then null
        when v_target_state.code = 'descartado' then 'lost'
        when v_target_state.code = 'ingreso_cuenta' then 'won'
        else null
      end;

    update sourcecrm.opportunities
    set current_state_id = v_target_state.id,
        resolution = v_next_resolution,
        closed_at = case when v_target_state.is_terminal then coalesce(p_occurred_at, now()) else null end,
        updated_at = now()
    where id = v_opportunity.id
    returning *
    into v_opportunity;

    insert into fact.pipeline_event (
      entity_type,
      opportunity_id,
      company_id,
      contact_id,
      product_id,
      state_id,
      event_type,
      occurred_at,
      actor_user_id,
      actor_email,
      notes,
      metadata
    )
    values (
      'opportunity',
      v_opportunity.id,
      v_opportunity.company_id,
      v_opportunity.contact_id,
      v_opportunity.product_id,
      v_opportunity.current_state_id,
      'state_entered',
      coalesce(p_occurred_at, now()),
      p_actor_user_id,
      p_actor_email,
      coalesce(nullif(trim(p_notes), ''), format('Cambio manual a %s', v_target_state.name)),
      jsonb_build_object(
        'previous_state_id', v_current_state.id,
        'change_mode', 'manual'
      )
    );

    if v_terminal_event_type is not null then
      insert into fact.pipeline_event (
        entity_type,
        opportunity_id,
        company_id,
        contact_id,
        product_id,
        state_id,
        event_type,
        occurred_at,
        actor_user_id,
        actor_email,
        notes,
        metadata
      )
      values (
        'opportunity',
        v_opportunity.id,
        v_opportunity.company_id,
        v_opportunity.contact_id,
        v_opportunity.product_id,
        v_opportunity.current_state_id,
        v_terminal_event_type,
        coalesce(p_occurred_at, now()),
        p_actor_user_id,
        p_actor_email,
        nullif(trim(p_notes), ''),
        jsonb_build_object('change_mode', 'manual')
      );
    end if;

    return query
    select 'opportunity', null::uuid, v_opportunity.id, v_target_state.id, v_opportunity.resolution, v_terminal_event_type, v_target_state.name;
  end if;
end;
$$;

grant execute on function sourcecrm.pipeline_convert_lead_to_opportunity(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function sourcecrm.pipeline_complete_task(text, uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated, service_role;
grant execute on function sourcecrm.pipeline_change_state(text, uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated, service_role;
