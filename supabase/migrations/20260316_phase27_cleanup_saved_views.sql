do $$
begin
  if to_regclass('sourcecrm.saved_views') is not null then
    delete from sourcecrm.saved_views
    where name <> '__columns__'
       or module not in ('contacts', 'investors', 'business');
  elsif to_regclass('public.saved_views') is not null then
    delete from public.saved_views
    where name <> '__columns__'
       or module not in ('contacts', 'investors', 'business');
  end if;
end
$$;
