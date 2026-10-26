# Stripe Billing Integration Setup

## 1. Environment Variables

Copy the following variables into your `.env` file. Obtain values from the [Stripe Dashboard](https://dashboard.stripe.com).

| Variable | Description | How to Obtain |
|---|---|---|
| `NEXT_PUBLIC_HELIO_PRICE_ID` | The Stripe Price ID for the Helio offering. Use the price ID for your free tier product. | In Stripe Dashboard: Products → Select product → Prices → Copy the Price ID |
| `STRIPE_SECRET_KEY` | Your Stripe secret key for API access. | Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for verifying webhook events. | Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret |
| `STRIPE_PRICE_FREE` | Stripe Price ID for the Free plan. | Dashboard → Products → Add product → Add price → Copy the Price ID for the free tier |
| `STRIPE_PRICE_PRO` | Stripe Price ID for the Pro plan. | Dashboard → Products → Add product → Add price → Copy the Price ID for the pro tier |
| `STRIPE_MODE` | Operating mode: `local` | `test` | `live` |
| | - `local`: Uses stub behavior, no real Stripe API calls | |
| | - `test`: Uses Stripe test mode (recommended for development) | |
| | - `live`: Uses Stripe live mode (production) | |
| | Default: `local` | |

**Important**: You must add all the above env vars before real payments will work. The backend safely handles missing config (see below).

## 2. Setting STRIPE_MODE

- Start with `STRIPE_MODE=test` during development
- Set `STRIPE_MODE=live` when you're ready to accept real payments
- Keep `STRIPE_MODE=local` for local development without any Stripe API calls

## 3. Obtaining Stripe Price IDs

1. Create a product in the Stripe Dashboard: **Products → Add product**
2. Add prices for each tier: **Products → Select product → Prices → Add price**
   - Create a "Free" price (e.g., $0/month trial)
   - Create a "Pro" price (e.g., $9.99/month)
3. Copy the Price ID for each from the price detail page
4. Set `STRIPE_PRICE_FREE` and `STRIPE_PRICE_PRO` to the respective IDs

## 4. Configuring Webhooks

1. In the Stripe Dashboard: **Developers → Webhooks → Add endpoint**
2. Set the endpoint URL to `http://localhost:8000/api/stripe/webhook` (or your deployed URL)
3. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. Copy the generated `STRIPE_WEBHOOK_SECRET` value
5. Add it to your `.env` file

## 5. Running the Backend

```bash
# Install dependencies
pip install fastapi uvicorn

# Start the server
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=test
STRIPE_PRICE_FREE=price_free_id
STRIPE_PRICE_PRO=price_pro_id
NEXT_PUBLIC_HELIO_PRICE_ID=price_helio_id
uvicorn app.main:app --reload
```

## 6. Verifying the Integration

### When Stripe env vars are empty:
- `GET /api/billing/me` returns `{"active": false, "plan": null, "error": "Stripe not configured"}`
- `POST /api/billing/checkout` returns 402 with message: "Stripe not configured. Set required env vars: ..."
- `POST /api/stripe/webhook` returns a valid JSON response without crashing

### When Stripe env vars are properly set (test mode):
- `GET /api/billing/me` returns `{"active": true, "plan": "pro"}`
- `POST /api/billing/checkout` returns a checkout URL and expiry
- `POST /api/stripe/webhook` processes events (stub: always returns success)

## 7. Important Security Notes

- **Never commit real Stripe keys to version control**. The `.env.example` file shows empty values for this reason.
- The backend uses `os.getenv()` with empty string defaults, so it never crashes when vars are missing.
- Error responses never leak secret keys - they only reference env var names that are missing.
- Real Stripe signature verification must be added to the webhook endpoint before deploying to production (see the stub code in `app/billing.py`).