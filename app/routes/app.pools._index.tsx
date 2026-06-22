import { data, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import { getAllPools } from "../pools.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  const pools = await getAllPools();
  return data({ pools });
}

export default function PoolsDashboard() {
  const { pools } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page
      title="Group Buy Pools"
      primaryAction={{
        content: "Create Pool",
        onAction: () => navigate("/app/pools/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {pools.length === 0 ? (
              <Card>
                <Text as="p">No pools created yet.</Text>
              </Card>
            ) : (
              pools.map((pool) => (
                <Card key={pool.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">
                        {pool.productTitle}
                      </Text>
                      <Badge
                        tone={
                          pool.status === "COMPLETED" ? "success" : "attention"
                        }
                      >
                        {pool.status}
                      </Badge>
                    </InlineStack>
                    <DataTable
                      columnContentTypes={["text", "numeric"]}
                      headings={["Detail", "Value"]}
                      rows={[
                        ["Current Volume", `${pool.currentQuantity} Tons`],
                        ["Target Volume", `${pool.targetQuantity} Tons`],
                        ["Discount", `${pool.discountPercent}%`],
                        ["Members", `${pool.members.length}`],
                      ]}
                    />
                    <Text as="h3" variant="headingSm">
                      Pool Members
                    </Text>
                    <DataTable
                      columnContentTypes={["text", "text", "numeric"]}
                      headings={["Customer Email", "Joined", "Quantity"]}
                      rows={pool.members.map((member) => [
                        member.customerEmail,
                        new Date(member.joinedAt).toLocaleDateString(),
                        `${member.quantity} Tons`,
                      ])}
                    />
                  </BlockStack>
                </Card>
              ))
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
