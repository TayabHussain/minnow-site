# Minnow sign-up site (Vercel + Supabase + Resend)

## How it works
- `index.html`: main page. Every "join" button points to `/api/go`, which logs the click and redirects to `/survey`.
- `survey.html`: the survey. Submitting it calls `/api/signup`, which saves the answers in Supabase and emails them to you via Resend.
- `dashboard.html`: password-protected stats (open `/dashboard`).
- `?src=linkedin` (or `/go/linkedin`) on the main page is carried through to the click log and the survey.
- IP addresses are stored only as a salted one-way hash. That is enough to count each visitor once, but the raw address is never saved.

## Setup
1. **Supabase.** Create a project at supabase.com. Open SQL Editor, paste all of `supabase/schema.sql`, click Run.
2. **Supabase keys.** Project Settings → API. Copy the Project URL and the *secret* key (or the legacy `service_role` key). Never put this key in a web page.
3. **Vercel environment variables** (Project → Settings → Environment Variables), then redeploy:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret / service_role key |
| `IP_SALT` | any long random string (don't change it later, or unique counts restart) |
| `DASHBOARD_KEY` | a password you choose for the dashboard |
| `RESEND_API_KEY` | your Resend key (already set) |

4. **Test:** open `https://your-site.vercel.app/?src=test`, click a button, fill in the survey, then open `/dashboard` and enter your key.

## Good to know
- "Unique" means unique hashed IP. People on the same wifi or mobile network can share an IP, and one person can have several, so treat the numbers as a good estimate.
- Conversion = unique CTA clickers whose IP also submitted the survey, divided by all unique CTA clickers. If someone switches network between clicking and submitting, they won't be matched.
- Because IP addresses are personal data under GDPR, keep the privacy sentences on the pages and mention it in your report.
