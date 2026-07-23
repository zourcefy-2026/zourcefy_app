import { data, redirect, useNavigate, useActionData, useNavigation, Form } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { createPool } from "../pools.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();

  const productId = formData.get("productId") as string;
  const productTitle = formData.get("productTitle") as string;
  const tiersJson = formData.get("tiersJson") as string;

  if (!productId || !productTitle) {
    return data({ error: "Product selection is required" });
  }

  let tiers: Array<{ targetQuantity: number; discountPercent: number }> = [];
  try {
    if (tiersJson) {
      tiers = JSON.parse(tiersJson);
    }
  } catch (err) {
    return data({ error: "Invalid tiers data format" });
  }

  if (!tiers || tiers.length === 0) {
    return data({ error: "At least one discount tier is required" });
  }

  const maxTarget = Math.max(...tiers.map((t) => t.targetQuantity));
  const firstDiscount = tiers[0].discountPercent;

  await createPool({
    productId,
    productTitle,
    targetQuantity: maxTarget,
    discountPercent: firstDiscount,
    status: "ACTIVE",
    createdBy: "ADMIN",
    tiers,
  });

  return redirect("/app");
}

export default function NewPool() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [productId, setProductId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [tiers, setTiers] = useState<Array<{ targetQuantity: string; discountPercent: string }>>([
    { targetQuantity: "50", discountPercent: "5" },
    { targetQuantity: "100", discountPercent: "10" },
  ]);

  const selectProduct = async () => {
    try {
      const selected = await shopify.resourcePicker({
        type: "product",
        multiple: false,
      });

      if (selected && selected.length > 0) {
        const product = selected[0];
        const cleanId = product.id.split("/").pop() || product.id;
        setProductId(cleanId);
        setProductTitle(product.title);
      }
    } catch (err) {
      console.error("Error selecting product:", err);
    }
  };

  const handleTierChange = (index: number, field: "targetQuantity" | "discountPercent", value: string) => {
    const updated = [...tiers];
    updated[index][field] = value;
    setTiers(updated);
  };

  const addTier = () => {
    const lastTarget = tiers.length > 0 ? parseFloat(tiers[tiers.length - 1].targetQuantity) || 50 : 50;
    const lastDiscount = tiers.length > 0 ? parseFloat(tiers[tiers.length - 1].discountPercent) || 5 : 5;
    setTiers([...tiers, { targetQuantity: String(lastTarget + 50), discountPercent: String(lastDiscount + 5) }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const parsedTiersJson = JSON.stringify(
    tiers.map((t, idx) => ({
      targetQuantity: parseFloat(t.targetQuantity) || 0,
      discountPercent: parseFloat(t.discountPercent) || 0,
      tierOrder: idx + 1,
    }))
  );

  return (
    <Page
      title="Create Multi-Tier Group Buy Pool"
      backAction={{ content: "Pools", onAction: () => navigate("/app/pools") }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {actionData?.error && (
                <Text as="p" tone="critical">
                  {actionData.error}
                </Text>
              )}
              <Form method="post">
                <input type="hidden" name="tiersJson" value={parsedTiersJson} />
                <FormLayout>
                  <Button onClick={selectProduct} variant="secondary">
                    Select Product from Catalog
                  </Button>
                  <TextField
                    label="Product ID"
                    name="productId"
                    value={productId}
                    onChange={setProductId}
                    placeholder="Click button above to select product"
                    autoComplete="off"
                  />
                  <TextField
                    label="Product Title"
                    name="productTitle"
                    value={productTitle}
                    onChange={setProductTitle}
                    placeholder="Product Title"
                    autoComplete="off"
                  />

                  <Box paddingBlockStart="400">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Custom Volume Discount Tiers (Unlimited)
                        </Text>
                        <Button onClick={addTier} variant="tertiary">
                          + Add Tier
                        </Button>
                      </InlineStack>

                      {tiers.map((tier, idx) => (
                        <Card key={idx}>
                          <InlineStack gap="400" align="space-between" blockAlign="center">
                            <Text as="span" variant="bodyMd" fontWeight="bold">
                              Tier {idx + 1}
                            </Text>
                            <div style={{ flex: 1 }}>
                              <TextField
                                label="Target Volume (Units)"
                                type="number"
                                value={tier.targetQuantity}
                                onChange={(val) => handleTierChange(idx, "targetQuantity", val)}
                                autoComplete="off"
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <TextField
                                label="Discount Percentage (%)"
                                type="number"
                                value={tier.discountPercent}
                                onChange={(val) => handleTierChange(idx, "discountPercent", val)}
                                autoComplete="off"
                              />
                            </div>
                            {tiers.length > 1 && (
                              <Button tone="critical" onClick={() => removeTier(idx)} variant="plain">
                                Remove
                              </Button>
                            )}
                          </InlineStack>
                        </Card>
                      ))}
                    </BlockStack>
                  </Box>

                  <Button submit variant="primary" loading={isSubmitting}>
                    Create & Activate Pool
                  </Button>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
