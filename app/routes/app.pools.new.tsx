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
  const targetQuantity = parseFloat(formData.get("targetQuantity") as string);
  const discountPercent = parseFloat(formData.get("discountPercent") as string);

  if (!productId || !productTitle || !targetQuantity || !discountPercent) {
    return data({ error: "All fields are required" });
  }

  await createPool({
    productId,
    productTitle,
    targetQuantity,
    discountPercent,
  });

  return redirect("/app/pools");
}

export default function NewPool() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [productId, setProductId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");

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

  return (
    <Page
      title="Create New Pool"
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
                <FormLayout>
                  <Button onClick={selectProduct} variant="secondary">
                    Select Product from Catalog
                  </Button>
                  <TextField
                    label="Product ID"
                    name="productId"
                    value={productId}
                    onChange={setProductId}
                    placeholder="Click button above to select product, or paste ID"
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
                  <TextField
                    label="Target Quantity (Tons)"
                    name="targetQuantity"
                    value={targetQuantity}
                    onChange={setTargetQuantity}
                    type="number"
                    placeholder="e.g. 10"
                    autoComplete="off"
                  />
                  <TextField
                    label="Discount Percent"
                    name="discountPercent"
                    value={discountPercent}
                    onChange={setDiscountPercent}
                    type="number"
                    placeholder="e.g. 12"
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSubmitting}>
                    Create Pool
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

