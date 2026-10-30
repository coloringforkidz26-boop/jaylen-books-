# Jaylen Johnson Books: order tracking setup

1. Put every file in this folder into a new GitHub repository (keep the `netlify` folder).
2. In Netlify: open your site > Site configuration > Build & deploy > Link repository, and pick the repo.
   Build command: leave empty. Publish directory: `.`
3. In Netlify: Site configuration > Environment variables, add:
   - `STRIPE_SECRET_KEY`: your Stripe secret key (Developers > API keys)
   - `STRIPE_WEBHOOK_SECRET`: from step 4
   - `ADMIN_KEY`: the same password you use for the gear menu
4. In Stripe: Developers > Webhooks > Add endpoint
   - URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, then redeploy.
5. In Stripe, edit each payment link > After payment > Don't show confirmation page > redirect to
   `https://YOUR-SITE.netlify.app/?session_id={CHECKOUT_SESSION_ID}`
6. Buy one book in Stripe test mode (or a real order you refund) and check:
   the thank-you popup shows a JJB number, Track order finds it, and it shows in the gear menu under Orders.

To change books later: use the gear menu, click "Download updated website file",
then upload the new index.html to the GitHub repo (Add file > Upload files). Netlify updates by itself.
