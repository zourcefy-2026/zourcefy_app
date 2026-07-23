import { data, useLoaderData, useNavigate, Form, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Tabs,
  FormLayout,
  TextField,
  Box,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { getAllPools, approvePool, rejectPool, updatePool, deletePool } from "../pools.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  const pools = await getAllPools();
  return data({ pools });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent") as string;
  const poolId = formData.get("poolId") as string;

  if (!poolId) {
    return data({ error: "Pool ID is required" });
  }

  try {
    if (intent === "approve") {
      const tiersJson = formData.get("tiersJson") as string;
      let tiers: Array<{ targetQuantity: number; discountPercent: number }> = [];
      if (tiersJson) {
        tiers = JSON.parse(tiersJson);
      }
      if (!tiers || tiers.length === 0) {
        return data({ error: "Please configure at least 1 discount tier before approving" });
      }
      await approvePool(poolId, tiers);
      return data({ success: true, message: "Pool approved and activated!" });
    }

    if (intent === "reject") {
      await rejectPool(poolId);
      return data({ success: true, message: "Pool request rejected." });
    }

    if (intent === "update") {
      const productTitle = formData.get("productTitle") as string;
      const status = formData.get("status") as string;
      const tiersJson = formData.get("tiersJson") as string;
      let tiers: Array<{ targetQuantity: number; discountPercent: number }> | undefined = undefined;
      if (tiersJson) {
        tiers = JSON.parse(tiersJson);
      }
      await updatePool(poolId, { productTitle, status }, tiers);
      return data({ success: true, message: "Pool updated successfully!" });
    }

    if (intent === "delete") {
      await deletePool(poolId);
      return data({ success: true, message: "Pool deleted successfully." });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Action failed";
    return data({ error: errorMsg });
  }

  return null;
}

export default function PoolsDashboard() {
  const { pools } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedTab, setSelectedTab] = useState(0);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [approvingPoolId, setApprovingPoolId] = useState<string | null>(null);

  // Automatically reset inline form states after action completes
  useEffect(() => {
    if (navigation.state === "idle") {
      setApprovingPoolId(null);
      setEditingPoolId(null);
    }
  }, [navigation.state]);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    []
  );

  // Separate pools into tabs
  const pendingPools = pools.filter((p) => p.status === "PENDING");
  const activePools = pools.filter((p) => p.status === "ACTIVE");
  const archivePools = pools.filter((p) => p.status === "COMPLETED" || p.status === "REJECTED");

  const tabs = [
    {
      id: "pending",
      content: `Pending Approval (${pendingPools.length})`,
      panelID: "pending-panel",
    },
    {
      id: "active",
      content: `Active Pools (${activePools.length})`,
      panelID: "active-panel",
    },
    {
      id: "archive",
      content: `Completed & Rejected (${archivePools.length})`,
      panelID: "archive-panel",
    },
  ];

  const displayedPools =
    selectedTab === 0 ? pendingPools : selectedTab === 1 ? activePools : archivePools;

  return (
    <Page
      title="Group Buy Procurement Pools"
      primaryAction={{
        content: "Create New Pool",
        onAction: () => navigate("/app/pools/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box paddingBlockStart="400">
              <BlockStack gap="400">
                {displayedPools.length === 0 ? (
                  <Card>
                    <Text as="p" tone="subdued">
                      {selectedTab === 0
                        ? "No pending pool requests from customers."
                        : selectedTab === 1
                        ? "No active group buy pools currently online."
                        : "No completed or rejected pools found."}
                    </Text>
                  </Card>
                ) : (
                  displayedPools.map((pool) => (
                    <PoolCard
                      key={pool.id}
                      pool={pool}
                      isApproving={approvingPoolId === pool.id}
                      isEditing={editingPoolId === pool.id}
                      onToggleApprove={() =>
                        setApprovingPoolId(approvingPoolId === pool.id ? null : pool.id)
                      }
                      onToggleEdit={() =>
                        setEditingPoolId(editingPoolId === pool.id ? null : pool.id)
                      }
                      isSubmitting={isSubmitting}
                    />
                  ))
                )}
              </BlockStack>
            </Box>
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function PoolCard({
  pool,
  isApproving,
  isEditing,
  onToggleApprove,
  onToggleEdit,
  isSubmitting,
}: {
  pool: any;
  isApproving: boolean;
  isEditing: boolean;
  onToggleApprove: () => void;
  onToggleEdit: () => void;
  isSubmitting: boolean;
}) {
  const [approveTiers, setApproveTiers] = useState<
    Array<{ targetQuantity: string; discountPercent: string }>
  >(
    pool.tiers && pool.tiers.length > 0
      ? pool.tiers.map((t: any) => ({
          targetQuantity: String(t.targetQuantity),
          discountPercent: String(t.discountPercent),
        }))
      : [
          { targetQuantity: String(pool.targetQuantity || 50), discountPercent: "10" },
          { targetQuantity: String((pool.targetQuantity || 50) * 2), discountPercent: "20" },
        ]
  );

  const [editTitle, setEditTitle] = useState(pool.productTitle);
  const [editStatus, setEditStatus] = useState(pool.status);
  const [editTiers, setEditTiers] = useState<
    Array<{ targetQuantity: string; discountPercent: string }>
  >(
    pool.tiers && pool.tiers.length > 0
      ? pool.tiers.map((t: any) => ({
          targetQuantity: String(t.targetQuantity),
          discountPercent: String(t.discountPercent),
        }))
      : [{ targetQuantity: String(pool.targetQuantity), discountPercent: String(pool.discountPercent) }]
  );

  const addApproveTier = () => {
    setApproveTiers([...approveTiers, { targetQuantity: "100", discountPercent: "15" }]);
  };

  const addEditTier = () => {
    setEditTiers([...editTiers, { targetQuantity: "100", discountPercent: "15" }]);
  };

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              {pool.productTitle}
            </Text>
            {pool.creatorEmail && (
              <Text as="span" variant="bodySm" tone="subdued">
                Requested by: {pool.creatorEmail} ({pool.createdBy})
              </Text>
            )}
          </BlockStack>
          <Badge
            tone={
              pool.status === "ACTIVE"
                ? "success"
                : pool.status === "PENDING"
                ? "attention"
                : pool.status === "COMPLETED"
                ? "info"
                : "critical"
            }
          >
            {pool.status}
          </Badge>
        </InlineStack>

        <DataTable
          columnContentTypes={["text", "numeric"]}
          headings={["Parameter", "Details"]}
          rows={[
            ["Current Volume", `${pool.currentQuantity} Units`],
            ["Target Volume", `${pool.targetQuantity} Units`],
            ["Active Discount", `${pool.discountPercent}% OFF`],
            ["Members Joined", `${pool.members.length}`],
          ]}
        />

        {/* Render Tiers Badges */}
        {pool.tiers && pool.tiers.length > 0 && (
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Configured Discount Tiers:
            </Text>
            <InlineStack gap="200" wrap>
              {pool.tiers.map((t: any, idx: number) => (
                <Badge key={idx} tone={pool.currentQuantity >= t.targetQuantity ? "success" : "info"}>
                  {`Tier ${idx + 1}: ${t.targetQuantity} Units → ${t.discountPercent}% OFF`}
                </Badge>
              ))}
            </InlineStack>
          </BlockStack>
        )}

        {/* Member Details */}
        {pool.members.length > 0 && (
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Joined Participants
            </Text>
            <DataTable
              columnContentTypes={["text", "text", "numeric"]}
              headings={["Customer Email", "Joined Date", "Volume"]}
              rows={pool.members.map((member: any) => [
                member.customerEmail,
                new Date(member.joinedAt).toLocaleDateString(),
                `${member.quantity} Units`,
              ])}
            />
          </BlockStack>
        )}

        <Divider />

        {/* ACTION BUTTONS */}
        <InlineStack gap="300" align="end">
          {pool.status === "PENDING" && (
            <>
              <Button onClick={onToggleApprove} variant="primary">
                {isApproving ? "Cancel Approval" : "Set Discounts & Approve"}
              </Button>
              <Form method="post" style={{ display: "inline" }}>
                <input type="hidden" name="intent" value="reject" />
                <input type="hidden" name="poolId" value={pool.id} />
                <Button submit tone="critical" variant="secondary" loading={isSubmitting}>
                  Reject
                </Button>
              </Form>
            </>
          )}

          <Button onClick={onToggleEdit} variant="secondary">
            {isEditing ? "Cancel Edit" : "Edit Pool"}
          </Button>

          <Form method="post" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="poolId" value={pool.id} />
            <Button submit tone="critical" variant="primary" loading={isSubmitting}>
              Delete
            </Button>
          </Form>
        </InlineStack>

        {/* INLINE APPROVAL FORM */}
        {isApproving && pool.status === "PENDING" && (
          <Box padding="400" borderRadius="200">
            <Form method="post">
              <input type="hidden" name="intent" value="approve" />
              <input type="hidden" name="poolId" value={pool.id} />
              <input
                type="hidden"
                name="tiersJson"
                value={JSON.stringify(
                  approveTiers.map((t, idx) => ({
                    targetQuantity: parseFloat(t.targetQuantity) || 0,
                    discountPercent: parseFloat(t.discountPercent) || 0,
                    tierOrder: idx + 1,
                  }))
                )}
              />

              <BlockStack gap="400">
                <Text as="h3" variant="headingSm" fontWeight="bold">
                  Configure Discount Tiers for Approval:
                </Text>

                {approveTiers.map((tier, idx) => (
                  <InlineStack key={idx} gap="300" align="space-between" blockAlign="center">
                    <Text as="span">Tier {idx + 1}:</Text>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Target Volume"
                        type="number"
                        value={tier.targetQuantity}
                        onChange={(val) => {
                          const updated = [...approveTiers];
                          updated[idx].targetQuantity = val;
                          setApproveTiers(updated);
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Discount %"
                        type="number"
                        value={tier.discountPercent}
                        onChange={(val) => {
                          const updated = [...approveTiers];
                          updated[idx].discountPercent = val;
                          setApproveTiers(updated);
                        }}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                ))}

                <InlineStack gap="300">
                  <Button onClick={addApproveTier} variant="tertiary">
                    + Add Tier
                  </Button>
                  <Button submit variant="primary" loading={isSubmitting}>
                    Approve & Activate Pool
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Box>
        )}

        {/* INLINE EDIT FORM */}
        {isEditing && (
          <Box padding="400" borderRadius="200">
            <Form method="post">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="poolId" value={pool.id} />
              <input
                type="hidden"
                name="tiersJson"
                value={JSON.stringify(
                  editTiers.map((t, idx) => ({
                    targetQuantity: parseFloat(t.targetQuantity) || 0,
                    discountPercent: parseFloat(t.discountPercent) || 0,
                    tierOrder: idx + 1,
                  }))
                )}
              />

              <FormLayout>
                <TextField
                  label="Product Title"
                  value={editTitle}
                  onChange={setEditTitle}
                  autoComplete="off"
                />
                <TextField
                  label="Status (ACTIVE, PENDING, COMPLETED, REJECTED)"
                  value={editStatus}
                  onChange={setEditStatus}
                  autoComplete="off"
                />

                <Text as="h4" variant="headingSm">
                  Discount Tiers:
                </Text>
                {editTiers.map((tier, idx) => (
                  <InlineStack key={idx} gap="300" align="space-between" blockAlign="center">
                    <Text as="span">Tier {idx + 1}:</Text>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Target Volume"
                        type="number"
                        value={tier.targetQuantity}
                        onChange={(val) => {
                          const updated = [...editTiers];
                          updated[idx].targetQuantity = val;
                          setEditTiers(updated);
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Discount %"
                        type="number"
                        value={tier.discountPercent}
                        onChange={(val) => {
                          const updated = [...editTiers];
                          updated[idx].discountPercent = val;
                          setEditTiers(updated);
                        }}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                ))}

                <InlineStack gap="300">
                  <Button onClick={addEditTier} variant="tertiary">
                    + Add Tier
                  </Button>
                  <Button submit variant="primary" loading={isSubmitting}>
                    Save Changes
                  </Button>
                </InlineStack>
              </FormLayout>
            </Form>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}
