import db from "./db.server";

export interface GraphQLClient {
  graphql: (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>;
}

/**
 * Creates a Shopify DiscountCodeBasic for a completed pool and saves it in the DB.
 * Returns the discount code string (e.g. "POOL-ABC12345") or null if creation fails.
 *
 * Uses a shared code approach — one code per pool, unlimited usage, applies once per customer.
 * The code applies percentage off the specific pool product only.
 */
export async function generatePoolDiscountCode(
  admin: GraphQLClient,
  poolId: string,
  productId: string,
  discountPercent: number
): Promise<string | null> {
  console.log(`[Zourcefy Discount] Starting code generation for pool=${poolId}, product=${productId}, discount=${discountPercent}%`);

  // Idempotency: return existing code if already generated
  const existing = await db.pool.findUnique({
    where: { id: poolId },
    select: { discountCode: true },
  });
  if (existing?.discountCode) {
    console.log(`[Zourcefy Discount] Returning pre-existing discount code: ${existing.discountCode}`);
    return existing.discountCode;
  }

  // Generate a short deterministic code from the pool ID
  const shortId = poolId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  let code = `POOL-${shortId}`;

  // Ensure productId is in GID format for Shopify GraphQL
  const productGid = productId.startsWith("gid://shopify/Product/")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const mutationQuery = `#graphql
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
    }`;

  const buildVariables = (codeToUse: string) => ({
    basicCodeDiscount: {
      title: `Zourcefy Group Buy — ${codeToUse}`,
      code: codeToUse,
      startsAt: new Date().toISOString(),
      customerGets: {
        value: { percentage: discountPercent / 100 },
        items: {
          products: {
            productsToAdd: [productGid],
          },
        },
      },
      customerSelection: { all: true },
      appliesOncePerCustomer: true,
    },
  });

  try {
    let response = await admin.graphql(mutationQuery, { variables: buildVariables(code) });
    let result = await response.json();
    let discountData = result?.data?.discountCodeBasicCreate;

    // Handle code collision (retry with random suffix)
    if (discountData?.userErrors?.some((e: { message?: string }) => e.message?.toLowerCase().includes("taken") || e.message?.toLowerCase().includes("exists"))) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      code = `POOL-${shortId}-${suffix}`;
      console.log(`[Zourcefy Discount] Code collision detected. Retrying with ${code}`);
      response = await admin.graphql(mutationQuery, { variables: buildVariables(code) });
      result = await response.json();
      discountData = result?.data?.discountCodeBasicCreate;
    }

    if (discountData?.userErrors?.length > 0) {
      console.error("[Zourcefy Discount] Shopify userErrors:", JSON.stringify(discountData.userErrors, null, 2));
      return null;
    }

    const createdCode: string | undefined =
      discountData?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code;
    const discountId: string | undefined = discountData?.codeDiscountNode?.id;

    if (!createdCode) {
      console.error("[Zourcefy Discount] Shopify returned no discount code in response:", JSON.stringify(result, null, 2));
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

    console.log(`[Zourcefy Discount] Successfully created & saved discount code for pool ${poolId}: ${createdCode}`);
    return createdCode;
  } catch (err) {
    console.error("[Zourcefy Discount] Exception during discount creation:", err);
    return null;
  }
}
