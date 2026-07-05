import { authenticate } from "../shopify.server";
import { getPoolByProduct, joinPool } from "../pools.server";
import { data } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

// GET request: Fetch pool details for a given product
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return data({ error: "productId is required" }, { status: 400 });
    }

    const cleanProductId = productId.startsWith("gid://shopify/Product/")
      ? productId.split("/").pop()!
      : productId;

    // Search for pool matching either format
    let pool = await getPoolByProduct(cleanProductId);
    if (!pool && cleanProductId !== productId) {
      pool = await getPoolByProduct(productId);
    }

    if (!pool) {
      return data({ hasPool: false });
    }

    return data({
      hasPool: true,
      pool: {
        id: pool.id,
        productId: pool.productId,
        productTitle: pool.productTitle,
        currentQuantity: pool.currentQuantity,
        targetQuantity: pool.targetQuantity,
        discountPercent: pool.discountPercent,
        status: pool.status,
        deadline: pool.deadline,
        memberCount: pool.members.length,
      },
    });
  } catch (error: any) {
    console.error("Error in app proxy loader:", error);
    return data({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST request: Join the pool
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (request.method !== "POST") {
      return data({ error: "Method not allowed" }, { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      const formData = await request.formData();
      body = {
        productId: formData.get("productId") as string,
        customerId: formData.get("customerId") as string,
        customerEmail: formData.get("customerEmail") as string,
        quantity: parseFloat(formData.get("quantity") as string),
      };
    }

    const { productId, customerId, customerEmail, quantity } = body;

    if (!productId || !customerId || !customerEmail || !quantity || isNaN(quantity)) {
      return data({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanProductId = productId.startsWith("gid://shopify/Product/")
      ? productId.split("/").pop()!
      : productId;

    let pool = await getPoolByProduct(cleanProductId);
    if (!pool && cleanProductId !== productId) {
      pool = await getPoolByProduct(productId);
    }

    if (!pool) {
      return data({ error: "No active group buy pool found for this product" }, { status: 404 });
    }

    // Check if customer already joined this pool
    const existingMember = pool.members.find(
      (m) => m.customerId === customerId || m.customerEmail === customerEmail
    );
    if (existingMember) {
      return data({ error: "You have already joined this pool" }, { status: 400 });
    }

    // Join the pool
    const updatedPool = await joinPool({
      poolId: pool.id,
      customerId,
      customerEmail,
      quantity,
    });

    return data({
      success: true,
      pool: {
        id: updatedPool.id,
        currentQuantity: updatedPool.currentQuantity,
        targetQuantity: updatedPool.targetQuantity,
        status: updatedPool.status,
        memberCount: updatedPool.members.length,
      },
    });
  } catch (error: any) {
    console.error("Error in app proxy action:", error);
    return data({ error: error.message || "Failed to join pool" }, { status: 500 });
  }
}
