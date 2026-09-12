import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { applyTemplate, intervalPlaceholders } from './applyTemplate';

const DEFAULT_HEADING = 'Subscription payments';
const DEFAULT_MESSAGE_SINGLE =
  'Payments taken automatically every {{days}} days';
const DEFAULT_MESSAGE_FALLBACK =
  'Payments are taken automatically for your subscription items.';

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

  const withNumber = text.match(/(\d+)\s*[- ]*(day|week|month|year)s?/i);
  if (withNumber) {
    const count = parseInt(withNumber[1], 10);
    return count * (INTERVAL_DAYS[withNumber[2].toUpperCase()] ?? 1);
  }

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

function buildMessage(intervals, settings) {
  if (intervals.length === 0) return null;

  if (intervals.length === 1) {
    return applyTemplate(
      settings.message_single,
      DEFAULT_MESSAGE_SINGLE,
      intervalPlaceholders(intervals[0]),
    );
  }

  const parts = intervals.map((days) => `every ${days} days`);
  const last = parts.pop();
  return `Payments taken automatically ${parts.join(', ')} and ${last}`;
}

export default async () => render(<GlobalPaymentNotice />, document.body);

function GlobalPaymentNotice() {
  const lines = shopify.lines.value ?? [];
  const settings = shopify.settings.value ?? {};
  const [result, setResult] = useState(null);

  const linesKey = lines.map((l) => l.id).join(',');

  useEffect(() => {
    // Include lines detected via sellingPlan OR subtitle (Recharge uses subtitle, not sellingPlan)
    const subscriptionLines = lines.filter(
      (l) =>
        l.merchandise?.sellingPlan?.id ||
        getDaysFromAttributes(l.attributes ?? []) ||
        getDaysFromText(l.merchandise?.subtitle),
    );

    if (subscriptionLines.length === 0) {
      setResult({ hasSubscriptions: false, intervals: [] });
      return;
    }

    Promise.all(
      subscriptionLines.map((line) => {
        const planId = line.merchandise?.sellingPlan?.id;
        const variantId = line.merchandise?.id;

        // Recharge path: no native sellingPlan, detect via subtitle or attributes
        if (!planId) {
          const days =
            getDaysFromText(line.merchandise?.subtitle) ??
            getDaysFromAttributes(line.attributes ?? []);
          return Promise.resolve(days);
        }

        if (!variantId) {
          return Promise.resolve(getDaysFromAttributes(line.attributes ?? []));
        }

        return shopify
          .query(QUERY, { variables: { variantId } })
          .then(({ data }) => {
            const allocations = data?.node?.sellingPlanAllocations?.nodes ?? [];
            const match = allocations.find((a) => a.sellingPlan?.id === planId) ?? allocations[0];
            const bp = match?.sellingPlan?.billingPolicy;

            if (bp?.interval) return bp.intervalCount * INTERVAL_DAYS[bp.interval];
            return (
              getDaysFromText(match?.sellingPlan?.name) ??
              getDaysFromAttributes(line.attributes ?? []) ??
              getDaysFromText(line.merchandise?.subtitle)
            );
          })
          .catch(() =>
            getDaysFromAttributes(line.attributes ?? []) ??
            getDaysFromText(line.merchandise?.subtitle),
          );
      }),
    ).then((results) => {
      const intervals = [...new Set(results.filter(Boolean))].sort((a, b) => a - b);
      setResult({ hasSubscriptions: true, intervals });
    });
  }, [linesKey]);

  if (!result) return null;
  if (!result.hasSubscriptions) return null;

  const message =
    result.intervals.length > 0
      ? buildMessage(result.intervals, settings)
      : applyTemplate(settings.message_fallback, DEFAULT_MESSAGE_FALLBACK);
  const heading = applyTemplate(settings.heading, DEFAULT_HEADING);

  return (
    <s-banner heading={heading} tone="info">
      {message}
    </s-banner>
  );
}
