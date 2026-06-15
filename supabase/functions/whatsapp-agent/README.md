# ACTSIX WhatsApp Agent

Webhook URL:

```text
https://ylwyfpmbmhlfjrztvasl.supabase.co/functions/v1/whatsapp-agent
```

Required Supabase secret:

```bash
npx supabase secrets set WHATSAPP_AGENT_WEBHOOK_SECRET="choose-a-long-random-secret" --project-ref ylwyfpmbmhlfjrztvasl
```

Deploy:

```bash
npx supabase functions deploy whatsapp-agent --project-ref ylwyfpmbmhlfjrztvasl
npx supabase db push --linked
```

If the project is not linked locally:

```bash
npx supabase login
npx supabase link --project-ref ylwyfpmbmhlfjrztvasl
npx supabase db push --linked
```

Twilio WhatsApp sandbox/inbound message webhook:

```text
POST https://ylwyfpmbmhlfjrztvasl.supabase.co/functions/v1/whatsapp-agent
```

Add this header if `WHATSAPP_AGENT_WEBHOOK_SECRET` is set:

```text
x-actsix-webhook-secret: choose-a-long-random-secret
```

Link a WhatsApp number to an ACTSIX user/workspace:

```sql
insert into public.whatsapp_agent_identities (
  workspace_id,
  auth_user_id,
  person_id,
  phone_number,
  display_name
) values (
  'workspace-uuid',
  'auth-user-uuid',
  'person-uuid-or-null',
  '+27737754927',
  'Michelle'
);
```

JSON smoke test:

```bash
curl -X POST "https://ylwyfpmbmhlfjrztvasl.supabase.co/functions/v1/whatsapp-agent" \
  -H "content-type: application/json" \
  -H "x-actsix-webhook-secret: choose-a-long-random-secret" \
  -d '{"response_mode":"json","from":"+27737754927","body":"Add Fetch kids to tasks"}'
```

Supported first-pass prompts:

- `What are my tasks for today?`
- `What songs are in the set for the upcoming service?`
- `Add "Fetch kids" to tasks`
