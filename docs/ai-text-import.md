# AI text import

The browser never receives the provider API key. Cardcraft calls the authenticated
Supabase Edge Function `text-to-cards`, which owns the prompts, provider settings,
validation, rate limiting, and secret access.

## Deployment

1. Apply `supabase/migrations/0004_create_ai_requests.sql` with the normal database migration workflow.
2. Configure Edge Function secrets (do not prefix them with `NEXT_PUBLIC_`):

   ```bash
   supabase secrets set AI_API_KEY=replace-me
   supabase secrets set AI_BASE_URL=https://provider.example/v1
   supabase secrets set AI_MODEL=model-name
   supabase secrets set AI_REASONING_ENABLED=false
   supabase secrets set AI_ALLOWED_ORIGINS=https://maaloznal.github.io,http://localhost:3000
   supabase secrets set AI_DAILY_REQUEST_LIMIT=20
   ```

3. Deploy the function:

   ```bash
   supabase functions deploy text-to-cards
   ```

`AI_BASE_URL` is the OpenAI-compatible API root. The function appends
`/chat/completions`, so do not include that suffix in the secret.

`AI_REASONING_ENABLED` defaults to `false`. Set it to `true` only after
comparing output quality and token usage: reasoning can materially increase
latency and billed tokens even for a short request. The setting is read only
by the Edge Function and is never exposed to the browser.

## Security contract

- A valid Supabase user session is mandatory.
- Source text is limited to 10,000 characters and never logged by the function.
- Provider URL, key, model, prompts, and daily limit are server-owned.
- Provider reasoning is server-controlled and disabled by default.
- The default quota is 20 requests per user per rolling 24 hours.
- The provider must support OpenAI-compatible chat completions and JSON mode.
- Every source segment must appear exactly once in the model's card mapping.
- The server and browser both validate field lengths before cards enter state.

Do not put `AI_API_KEY`, `AI_BASE_URL`, or `AI_MODEL` in `.env`, GitHub Pages
variables, `NEXT_PUBLIC_*`, source files, screenshots, logs, or issue text.
