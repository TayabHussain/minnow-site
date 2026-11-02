# Minnow sign-up site (with Resend)

Files:
- `index.html`: the landing page and survey. It posts the form to `/api/signup`.
- `api/signup.js`: a Vercel serverless function that emails each submission to you through Resend.

## Set up (about 10 minutes)

1. **Resend account.** Sign up at resend.com with **tayabhussain@live.nl**. Without a verified domain, Resend only delivers to the email address of your own account, which is exactly what you need here.
2. **API key.** In Resend go to API Keys, create a key with "Sending access", and copy it. Keep it private: never paste it into the HTML or into a chat.
3. **Deploy on Vercel.** Put this folder in a GitHub repo, import it at vercel.com (free plan is fine), or run `npx vercel` inside the folder.
4. **Environment variable.** In Vercel: Project → Settings → Environment Variables → add `RESEND_API_KEY` with your key, then redeploy.
5. **Test.** Open your site, fill in the form, and check your inbox (and spam folder the first time).

## Optional settings (environment variables)
- `TO_EMAIL`: where sign-ups are sent. Defaults to tayabhussain@live.nl.
- `FROM_EMAIL`: sender address. Defaults to `Minnow <onboarding@resend.dev>`. After you verify your own domain in Resend, use e.g. `Minnow <hello@yourdomain.com>`.

## Later
- To send a confirmation email to each person who signs up, you must verify a domain in Resend first.
- Email is a fine start, but for 50+ sign-ups a spreadsheet or database is easier to analyse.
