import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/CartLineNotice.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.cart-line-item.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/GlobalPaymentNotice.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
