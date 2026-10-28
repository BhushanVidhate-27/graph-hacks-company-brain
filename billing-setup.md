# Stripe billing setup

Helio sells two self-serve plans through Stripe Checkout and manages them through the Stripe Customer Portal. The backend calls Stripe's REST API directly with `httpx`; there is no Stripe SDK to install.

Plans and prices live in [`app/plans.py`](app/plans.py). Change a price there, not in the frontend — the marketing page reads the same catalog from `GET /api/plans`.

---

## 1. Create the products

In the [Stripe Dashboard](https://dashboard.stripe.com):

1. **Products → Add product** → *Helio Starter* → recurring price **$15/month** → save.
2. **Products → Add product** → *Helio Professional* → recurring price **$49/month** → save.
3. Copy each price ID (`price_...`, not `prod_...`).

Optional annual prices are supported by the catalog (`price_yearly`), but the current checkout flow creates monthly subscriptions.

## 2. Environment variables

Add these to `.env` (or your host's secret store):

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Developers → API keys → Secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | yes | Developers → Webhooks → your endpoint → Signing secret (`whsec_...`) |
| `STRIPE_PRICE_STARTER` | yes | Price ID for the $15/month plan |
| `STRIPE_PRICE_PROFESSIONAL` | yes | Price ID for the $49/month plan |
| `STRIPE_MODE` | yes | `test` or `live` in production; `local` only for development |
| `HELIO_APP_URL` | recommended | Public origin, e.g. `https://helio-brain.onrender.com`, used for success/cancel/portal redirects |
| `HELIO_ALLOW_LOCAL_BILLING` | no | Must stay `0` in production. `1` plus `STRIPE_MODE=local` grants a plan without Stripe — a development shortcut only |

`STRIPE_PRICE_PRO` is still read as a fallback for deployments configured before the catalog was split. New deployments should use `STRIPE_PRICE_PROFESSIONAL`.

Check the deployment's view of this configuration at any time:

```bash
curl -s https://your-host/api/billing/setup | jq
```

It reports `configured`, `mode`, `local_billing` and the names of any missing variables — never their values.

## 3. Register the webhook

In **Developers → Webhooks → Add endpoint**:

- URL: `https://<your-host>/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The handler verifies `Stripe-Signature` against the **raw request body** (parsing and re-serialising JSON would break the HMAC), rejects timestamps older than 300 seconds, and records each event ID so a Stripe retry cannot apply twice.

## 4. Enable the Customer Portal

**Settings → Billing → Customer portal**: allow customers to update payment methods, switch between the Starter and Professional prices, and cancel. The account console's **Manage billing** button creates a portal session for the account's Stripe customer.

## 5. Local development

You do not need Stripe to exercise the SaaS layer. Two options:

### Option A — local billing mode

```bash
STRIPE_MODE=local
HELIO_ALLOW_LOCAL_BILLING=1
```

`POST /api/billing/checkout` then upgrades the account immediately for 30 days. This is intentionally gated behind two variables, and the UI labels it **Local billing mode**. Leaving it enabled on a public deployment gives away paid plans.

### Option B — Stripe test mode + CLI

```bash
stripe login
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

Use the `whsec_...` printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET`, set `STRIPE_MODE=test`, and pay with test card `4242 4242 4242 4242`.

## 6. What the webhook changes

| Event | Effect |
|---|---|
| `checkout.session.completed` | Sets the account's plan and Stripe customer/subscription IDs |
| `customer.subscription.updated` | Updates plan, status, period end and cancel-at-period-end |
| `customer.subscription.deleted` | Marks the subscription canceled; quotas fall back to Free |
| `invoice.paid` | Keeps the subscription active |
| `invoice.payment_failed` | Marks it `past_due`; quotas fall back to Free until payment succeeds |

A subscription that is not `active` or `trialing` is enforced as the Free plan. The account page still shows the raw Stripe status so the cause is visible.

## 7. Quotas and metering

- Signed-in questions are counted per calendar month in SQLite and checked before the SSE stream starts. Over-limit requests get `429` with `error: "quota_exceeded"`, `used`, `limit` and an `upgrade_url`.
- Only successful answers are charged.
- Anonymous visitors get `ANON_DAILY_LIMIT` questions per IP per day (default 100). Set `HELIO_REQUIRE_AUTH=1` to remove anonymous access entirely.
- API keys are available on Professional and above; creating one requires a browser session, not another API key.

## 8. Production checklist

- [ ] `STRIPE_MODE=live` and live secret/price IDs
- [ ] `HELIO_ALLOW_LOCAL_BILLING=0`
- [ ] `HELIO_APP_URL` set to the public HTTPS origin
- [ ] `HELIO_DB_PATH` on a persistent volume
- [ ] Webhook endpoint registered with the seven events above
- [ ] `/api/billing/setup` reports `configured: true` and `missing: []`
- [ ] One API replica (SQLite is single-writer)
