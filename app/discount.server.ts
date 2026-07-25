import db from "./db.server";

/**
 * Creates a Shopify DiscountCodeBasic for a completed pool and saves it in the DB.
 * Returns the discount code string (e.g. "POOL-ABC12345") or null if creation fails.
 *
 * Uses a shared code approach — one code per pool, unlimited usage, applies once per customer.
 * The code applies percentage off the specific pool product only.
 */
export async function generatePoolDiscountCode(
  admin: any,
  poolId: string,
  productId: string,
  discountPercent: number
): Promise<string | null> {
  // Idempotency: return existing code if already generated
  const existing = await db.pool.findUnique({
    where: { id: poolId },
    select: { discountCode: true },
  });
  if (existing?.discountCode) {
    return existing.discountCode;
  }

  // Generate a short deterministic code from the pool ID
  const shortId = poolId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  const code = `POOL-${shortId}`;

  // Ensure productId is in GID format for Shopify GraphQL
  const productGid = productId.startsWith("gid://shopify/Product/")
    ? productId
    : `gid://shopify/Product/${productId}`;

  try {
    const response = await admin.graphql(
      `#graphql
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                codes(first: 1) {
                  nodes { code }
                }
              }
            }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          basicCodeDiscount: {
            title: `Zourcefy Group Buy — ${code}`,
            code,
            startsAt: new Date().toISOString(),
            customerGets: {
              value: { percentage: discountPercent / 100 },
              items: {
                products: {
                  productsToAdd: [productGid],
                },
              },
            },
            // All customers can use the code (no customer segment restriction)
            customerSelection: { all: true },
            // Each customer can only benefit from the discount once
            appliesOncePerCustomer: true,
          },
        },
      }
    );

    const result = await response.json();
    const discountData = result?.data?.discountCodeBasicCreate;

    if (discountData?.userErrors?.length > 0) {
      console.error("[Zourcefy] Shopify discount creation errors:", discountData.userErrors);
      return null;
    }

    const createdCode: string | undefined =
      discountData?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code;
    const discountId: string | undefined = discountData?.codeDiscountNode?.id;

    if (!createdCode) {
      console.error("[Zourcefy] Shopify returned no discount code in response.");
      return null;
    }

    // Persist the code on the pool record
    await db.pool.update({
      where: { id: poolId },
      data: {
        discountCode: createdCode,
        discountCodeId: discountId ?? null,
      },
    });

    console.log(`[Zourcefy] Discount code created for pool ${poolId}: ${createdCode}`);
    return createdCode;
  } catch (err) {
    console.error("[Zourcefy] Error creating Shopify discount code:", err);
    return null;
  }
}
