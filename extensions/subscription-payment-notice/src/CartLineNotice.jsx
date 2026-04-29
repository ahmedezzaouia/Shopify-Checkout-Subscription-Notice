import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const QUERY = `
  query ($variantId: ID!) {
    node(id: $variantId) {
      ... on ProductVariant {
        sellingPlanAllocations(first: 20) {
          nodes {
            sellingPlan {
              id
              name
              billingPolicy {
                ... on SellingPlanRecurringBillingPolicy {
                  interval
                  intervalCount
                }
              }
            }
          }
        }
      }
    }
  }
`;

const INTERVAL_DAYS = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

function getDaysFromText(text) {
  if (!text) return null;

  // "X day/week/month/year(s)" e.g. "1 month", "30 days", "6-month"
  const withNumber = text.match(/(\d+)\s*[- ]*(day|week|month|year)s?/i);
  if (withNumber) {
    const count = parseInt(withNumber[1], 10);
    return count * (INTERVAL_DAYS[withNumber[2].toUpperCase()] ?? 1);
  }

  // Bare frequency words: "monthly", "weekly", "daily", "yearly", "quarterly"
  if (/\bmonthly\b/i.test(text)) return 30;
  if (/\bweekly\b/i.test(text)) return 7;
  if (/\bdaily\b/i.test(text)) return 1;
  if (/\b(annual|yearly)\b/i.test(text)) return 365;
  if (/\bquarterly\b/i.test(text)) return 90;

  return null;
}

function getDaysFromAttributes(attrs) {
  const freq = attrs.find(
    (a) => a.key === 'shipping_interval_frequency' || a.key === 'charge_interval_frequency',
  )?.value;
  const unit = attrs.find(
    (a) => a.key === 'shipping_interval_unit_type' || a.key === 'order_interval_unit',
  )?.value?.toUpperCase();

  if (!freq || !unit) return null;
  const count = parseInt(freq, 10);
  const multiplier = Object.entries(INTERVAL_DAYS).find(([k]) => unit.startsWith(k))?.[1];
  return multiplier ? count * multiplier : null;
}

export default async () => render(<CartLineNotice />, document.body);

function CartLineNotice() {
  const line = shopify.target.value;
  const [apiDays, setApiDays] = useState(undefined);

  const planId = line?.merchandise?.sellingPlan?.id;
  const variantId = line?.merchandise?.id;

  useEffect(() => {
    if (!planId || !variantId) {
      setApiDays(null);
      return;
    }

    shopify
      .query(QUERY, { variables: { variantId } })
      .then(({ data }) => {
        const allocations = data?.node?.sellingPlanAllocations?.nodes ?? [];
        const match = allocations.find((a) => a.sellingPlan?.id === planId) ?? allocations[0];
        const bp = match?.sellingPlan?.billingPolicy;

        if (bp?.interval) {
          setApiDays(bp.intervalCount * INTERVAL_DAYS[bp.interval]);
        } else {
          setApiDays(getDaysFromText(match?.sellingPlan?.name) ?? null);
        }
      })
      .catch(() => setApiDays(null));
  }, [planId, variantId]);

  // Not a subscription — render nothing
  if (!planId) return null;

  // Still loading API response
  if (apiDays === undefined) return null;

  const finalDays =
    apiDays ??
    getDaysFromAttributes(line?.attributes ?? []);

  const message = finalDays
    ? `↻ Renews every ${finalDays} days. Payments are automatic.`
    : '↻ Payments are taken automatically for your subscription.';

  return (
    <s-box padding-block-start="tight">
      <s-text type="small" color="subdued">
        {message}
      </s-text>
    </s-box>
  );
}
