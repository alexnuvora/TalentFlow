alter table public.call_gateway_commands
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.call_gateway_commands
  drop constraint if exists call_gateway_commands_action_check;

alter table public.call_gateway_commands
  add constraint call_gateway_commands_action_check
  check (action in ('hangup','dtmf'));

alter table public.call_gateway_commands
  drop constraint if exists call_gateway_commands_dtmf_payload_check;

alter table public.call_gateway_commands
  add constraint call_gateway_commands_dtmf_payload_check
  check (
    action <> 'dtmf'
    or (
      jsonb_typeof(payload) = 'object'
      and payload ? 'tones'
      and (payload->>'tones') ~ '^[0-9*#,]{1,64}$'
    )
  );

comment on column public.call_gateway_commands.payload is
  'Ephemeral handset command parameters. DTMF payloads are cleared after device acknowledgement.';
