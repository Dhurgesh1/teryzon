# Teryzon AI setup

The website widget is in `assets/js/chatbot.js` and `assets/css/chatbot.css`. It is loaded by every browsable HTML page. The frontend sends only the bounded conversation history to the Supabase Edge Function; it never contains an OpenRouter key.

## Deploy the Supabase Edge Function

The function is at `supabase/functions/teryzon-chat/index.ts`. GitHub Pages remains suitable for the frontend because the AI request runs inside Supabase.

Set the secrets in Supabase, never in frontend files:

```text
OPENROUTER_API_KEY=your-secret-key
OPENROUTER_MODEL=openai/gpt-4o-mini
ALLOWED_ORIGIN=https://www.teryzon.com
```

Never put the real values in this repository or in browser code.

Deploy from the repository root with the Supabase CLI:

```text
supabase login
supabase link --project-ref zeryppqymzbqesllxnvk
supabase secrets set OPENROUTER_API_KEY=your-secret-key OPENROUTER_MODEL=openai/gpt-4o-mini ALLOWED_ORIGIN=https://www.teryzon.com
supabase functions deploy teryzon-chat --no-verify-jwt
```

The `--no-verify-jwt` flag is required because the public chatbot does not require a Teryzon account. The function still validates the origin, limits input, and rate-limits requests.

The frontend already points to `https://zeryppqymzbqesllxnvk.supabase.co/functions/v1/teryzon-chat`.

## Included protections

- Server-side secret storage, input limits, bounded history, and basic per-IP rate limiting.
- Model selection through `OPENROUTER_MODEL`.
- Scoped responsive UI with safe-area support and reduced-motion handling.
- Local conversation persistence limited to the current chat messages. No credentials or tokens are stored.
- Escaped Markdown rendering with restricted generated links and no arbitrary HTML execution.
