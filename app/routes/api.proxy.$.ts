import { authenticate } from "../shopify.server";
import { getPoolByProduct, joinPool, createPool } from "../pools.server";
import { data, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

// GET request: Fetch pool details or serve the integrated pool creation page
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    const url = new URL(request.url);

    // Serve the integrated pool creation tab/page
    if (url.pathname.endsWith("/create")) {
      const productId = url.searchParams.get("productId") || "";
      const productTitle = url.searchParams.get("productTitle") || "";
      const productHandle = url.searchParams.get("productHandle") || "";

      const html = `
        <div style="max-width: 600px; margin: 40px auto; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #fbbf24;">Request Group Buy Pool</h2>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px;">Submit a group procurement request for <strong>${productTitle}</strong>. The store owner will configure bulk discount tiers upon approval.</p>

          <form id="create-pool-form" method="POST" action="/apps/zourcefy-pool" style="display: flex; flex-direction: column; gap: 20px;">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="productId" value="${productId}">
            <input type="hidden" name="productTitle" value="${productTitle}">
            <input type="hidden" name="productHandle" value="${productHandle}">
            <input type="hidden" name="customerId" id="customer-id" value="">

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; color: #94a3b8; font-weight: 500;">Your Email Address</label>
              <input type="email" name="customerEmail" placeholder="you@company.com" required style="padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #f8fafc; font-size: 15px; outline: none; box-shadow: none;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; color: #94a3b8; font-weight: 500;">Target Volume (Units/Tons)</label>
                <input type="number" name="targetQuantity" min="1" placeholder="e.g. 50" required style="padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #f8fafc; font-size: 15px; outline: none;" />
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; color: #94a3b8; font-weight: 500;">Your Initial Commitment</label>
                <input type="number" name="quantity" min="0.1" step="0.1" value="5" required style="padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #f8fafc; font-size: 15px; outline: none;" />
              </div>
            </div>

            <button type="submit" style="padding: 14px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border: none; border-radius: 8px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3); transition: transform 0.2s; margin-top: 10px;">
              Submit Pool Request
            </button>
            <a href="/products/${productHandle}" style="text-align: center; color: #94a3b8; font-size: 14px; text-decoration: none; margin-top: 8px;">Cancel and return</a>
          </form>
        </div>

        <script>
          const customerId = "{{ customer.id }}";
          const customerEmail = "{{ customer.email }}";
          const emailInput = document.querySelector('input[name="customerEmail"]');
          const custIdInput = document.getElementById('customer-id');

          if (customerId) {
            custIdInput.value = customerId;
            if (emailInput) {
              emailInput.value = customerEmail;
              emailInput.readOnly = true;
            }
          } else {
            const savedEmail = localStorage.getItem('zourcefy_guest_email') || '';
            if (emailInput && savedEmail) emailInput.value = savedEmail;
            custIdInput.value = 'guest_' + Math.random().toString(36).substring(2, 15);
          }

          document.getElementById('create-pool-form').addEventListener('submit', function() {
            if (emailInput && emailInput.value) {
              localStorage.setItem('zourcefy_guest_email', emailInput.value);
            }
          });
        </script>
      `;

      return new Response(html, {
        headers: {
          "Content-Type": "application/liquid",
        },
      });
    }

    const productId = url.searchParams.get("productId");
    const requesterEmail = url.searchParams.get("customerEmail") || undefined;
    const requesterCustomerId = url.searchParams.get("customerId") || undefined;

    if (!productId) {
      return data({ error: "productId is required" }, { status: 400 });
    }

    const cleanProductId = productId.startsWith("gid://shopify/Product/")
      ? productId.split("/").pop()!
      : productId;

    let poolData = await getPoolByProduct(cleanProductId, requesterEmail, requesterCustomerId);
    if (!poolData.activePool && !poolData.pendingPool && cleanProductId !== productId) {
      poolData = await getPoolByProduct(productId, requesterEmail, requesterCustomerId);
    }

    const { activePool, pendingPool, isCreatorPending } = poolData;

    if (!activePool && !isCreatorPending) {
      return data({ hasPool: false, hasActivePool: false, isCreatorPending: false });
    }

    return data({
      hasPool: true,
      hasActivePool: !!activePool,
      isCreatorPending,
      pool: activePool
        ? {
            id: activePool.id,
            productId: activePool.productId,
            productTitle: activePool.productTitle,
            currentQuantity: activePool.currentQuantity,
            targetQuantity: activePool.targetQuantity,
            discountPercent: activePool.discountPercent,
            status: activePool.status,
            deadline: activePool.deadline,
            memberCount: activePool.members.length,
            tiers: activePool.tiers,
          }
        : null,
      pendingPool: pendingPool
        ? {
            id: pendingPool.id,
            targetQuantity: pendingPool.targetQuantity,
            currentQuantity: pendingPool.currentQuantity,
            createdAt: pendingPool.createdAt,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("Error in app proxy loader:", error);
    return data({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST request: Create or join the pool
export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    if (request.method !== "POST") {
      return data({ error: "Method not allowed" }, { status: 405 });
    }

    const contentType = request.headers.get("content-type") || "";
    let body;
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = {
        action: formData.get("action") as string,
        productId: formData.get("productId") as string,
        productTitle: formData.get("productTitle") as string,
        productHandle: formData.get("productHandle") as string,
        targetQuantity: formData.get("targetQuantity")
          ? parseFloat(formData.get("targetQuantity") as string)
          : undefined,
        customerId: formData.get("customerId") as string,
        customerEmail: formData.get("customerEmail") as string,
        quantity: formData.get("quantity")
          ? parseFloat(formData.get("quantity") as string)
          : undefined,
      };
    }

    const actionType = body.action || "join";
    const { productId, customerEmail, quantity } = body;

    const effectiveCustomerId =
      body.customerId && body.customerId.trim() !== ""
        ? body.customerId
        : "guest_" + Math.random().toString(36).substring(2, 15);

    if (!productId || !customerEmail || !quantity || isNaN(quantity)) {
      return data({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanProductId = productId.startsWith("gid://shopify/Product/")
      ? productId.split("/").pop()!
      : productId;

    // 1. Handle Pool Creation Flow (Customer Requested)
    if (actionType === "create") {
      const { productTitle, targetQuantity, productHandle } = body;

      if (!productTitle || !targetQuantity || isNaN(targetQuantity)) {
        return data(
          { error: "Missing required target quantity for group buy pool" },
          { status: 400 }
        );
      }

      if (targetQuantity <= 0) {
        return data({ error: "Target volume must be greater than zero" }, { status: 400 });
      }

      if (quantity <= 0) {
        return data({ error: "Your initial volume commitment must be greater than zero" }, { status: 400 });
      }

      if (quantity > targetQuantity) {
        return data({ error: "Your initial commitment cannot exceed the target volume" }, { status: 400 });
      }

      // Check if an active or pending pool already exists for this product
      const existing = await getPoolByProduct(cleanProductId, customerEmail, effectiveCustomerId);
      if (existing.activePool) {
        return data(
          { error: "An active group buy pool already exists for this product" },
          { status: 400 }
        );
      }
      if (existing.pendingPool) {
        return data(
          { error: "You already have a pool request pending approval for this product" },
          { status: 400 }
        );
      }

      // Create pool in PENDING status without discount (Admin will assign discount tiers upon approval)
      const newPool = await createPool({
        productId: cleanProductId,
        productTitle,
        targetQuantity,
        discountPercent: 0,
        status: "PENDING",
        createdBy: "CUSTOMER",
        creatorEmail: customerEmail,
        creatorCustomerId: effectiveCustomerId,
      });

      // Join creator to pool
      await joinPool({
        poolId: newPool.id,
        customerId: effectiveCustomerId,
        customerEmail,
        quantity,
      });

      // Redirect back if standard browser HTML form submission
      const acceptHeader = request.headers.get("Accept") || "";
      const isHtmlRequest =
        acceptHeader.includes("text/html") || !request.headers.get("X-Requested-With");
      if (isHtmlRequest && productHandle) {
        return redirect(`/products/${productHandle}`);
      }

      return data({
        success: true,
        isPending: true,
        message: "Your Group Buy Pool request has been submitted for store approval.",
        pool: {
          id: newPool.id,
          currentQuantity: quantity,
          targetQuantity,
          status: "PENDING",
          memberCount: 1,
        },
      });
    }

    // 2. Handle Pool Joining Flow
    const { activePool } = await getPoolByProduct(cleanProductId);

    if (!activePool) {
      return data({ error: "No active group buy pool found for this product" }, { status: 404 });
    }

    // Check if customer already joined this pool
    const existingMember = activePool.members.find(
      (m) => m.customerId === effectiveCustomerId || m.customerEmail === customerEmail
    );
    if (existingMember) {
      return data({ error: "You have already joined this pool" }, { status: 400 });
    }

    if (quantity <= 0) {
      return data({ error: "Committed volume must be greater than zero" }, { status: 400 });
    }

    // Join the pool
    const updatedPool = await joinPool({
      poolId: activePool.id,
      customerId: effectiveCustomerId,
      customerEmail,
      quantity,
    });

    return data({
      success: true,
      pool: {
        id: updatedPool.id,
        currentQuantity: updatedPool.currentQuantity,
        targetQuantity: updatedPool.targetQuantity,
        discountPercent: updatedPool.discountPercent,
        status: updatedPool.status,
        memberCount: updatedPool.members.length,
        tiers: updatedPool.tiers,
      },
    });
  } catch (error: unknown) {
    console.error("Error in app proxy action:", error);
    const message = error instanceof Error ? error.message : "Failed to process request";
    return data({ error: message }, { status: 500 });
  }
}
