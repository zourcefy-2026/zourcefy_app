const { spawn } = require('child_process');
const assert = require('assert');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting test server (connecting to MongoDB Atlas)...');
    
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT, MOCK_DB: 'false' }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server]: ${output.trim()}`);
      if (output.includes(`Server is running`)) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error]: ${data.toString()}`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  try {
    console.log('\n--- Starting Integration Tests on MongoDB Atlas ---\n');

    const testId = Date.now();
    const productId1 = `steel-x-${testId}`;
    const productId2 = `copper-y-${testId}`;
    const order1 = `ord-101-${testId}`;
    const order2 = `ord-102-${testId}`;
    const orderAuto = `ord-201-${testId}`;

    // Test 1: Check server status
    console.log('Test 1: GET / (Status Check)');
    const statusRes = await fetch(`${BASE_URL}/`);
    const statusData = await statusRes.json();
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusData.success, true);
    assert.strictEqual(statusData.status, 'Running');
    console.log('✔ Test 1 Passed.\n');

    // Test 2: Manually create a pool
    console.log(`Test 2: POST /api/pools (Create Pool: ${productId1})`);
    const createRes = await fetch(`${BASE_URL}/api/pools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: productId1,
        targetQuantity: 50
      })
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createData.success, true);
    assert.strictEqual(createData.data.productId, productId1);
    assert.strictEqual(createData.data.targetQuantity, 50);
    assert.strictEqual(createData.data.currentQuantity, 0);
    assert.strictEqual(createData.data.status, 'active');
    console.log('✔ Test 2 Passed.\n');

    // Test 3: Join the pool (Part 1 - below threshold)
    console.log('Test 3: POST /api/pools/join-pool (Join - below threshold)');
    const join1Res = await fetch(`${BASE_URL}/api/pools/join-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: productId1,
        customerId: 'cust-101',
        orderId: order1,
        quantity: 20
      })
    });
    const join1Data = await join1Res.json();
    assert.strictEqual(join1Res.status, 200);
    assert.strictEqual(join1Data.success, true);
    assert.strictEqual(join1Data.data.pool.currentQuantity, 20);
    assert.strictEqual(join1Data.data.pool.status, 'active');
    assert.strictEqual(join1Data.data.batchCreated, false);
    console.log('✔ Test 3 Passed.\n');

    // Test 4: Duplicate join prevention
    console.log('Test 4: POST /api/pools/join-pool (Duplicate Order ID Check)');
    const dupRes = await fetch(`${BASE_URL}/api/pools/join-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: productId1,
        customerId: 'cust-101',
        orderId: order1, // same orderId
        quantity: 10
      })
    });
    const dupData = await dupRes.json();
    assert.strictEqual(dupRes.status, 400);
    assert.strictEqual(dupData.success, false);
    assert.ok(dupData.message.includes('already joined'));
    console.log('✔ Test 4 Passed.\n');

    // Test 5: Join the pool (Part 2 - reaching threshold)
    console.log('Test 5: POST /join-pool (Join - reach/exceed threshold)');
    const join2Res = await fetch(`${BASE_URL}/join-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: productId1,
        customerId: 'cust-102',
        orderId: order2,
        quantity: 35 // 20 + 35 = 55 (exceeds target 50)
      })
    });
    const join2Data = await join2Res.json();
    assert.strictEqual(join2Res.status, 200);
    assert.strictEqual(join2Data.success, true);
    assert.strictEqual(join2Data.data.pool.currentQuantity, 55);
    assert.strictEqual(join2Data.data.pool.status, 'completed');
    assert.strictEqual(join2Data.data.batchCreated, true);
    assert.ok(join2Data.data.procurementBatch);
    assert.strictEqual(join2Data.data.procurementBatch.productId, productId1);
    assert.strictEqual(join2Data.data.procurementBatch.totalQuantity, 55);
    console.log('✔ Test 5 Passed.\n');

    // Test 6: Auto-creation on join (when no active pool exists)
    console.log(`Test 6: POST /api/pools/join-pool (Auto-creation of new pool: ${productId2})`);
    const joinAutoRes = await fetch(`${BASE_URL}/api/pools/join-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: productId2,
        customerId: 'cust-201',
        orderId: orderAuto,
        quantity: 15
      })
    });
    const joinAutoData = await joinAutoRes.json();
    assert.strictEqual(joinAutoRes.status, 200);
    assert.strictEqual(joinAutoData.success, true);
    assert.strictEqual(joinAutoData.data.pool.productId, productId2);
    assert.strictEqual(joinAutoData.data.pool.targetQuantity, 100); // default target
    assert.strictEqual(joinAutoData.data.pool.currentQuantity, 15);
    assert.strictEqual(joinAutoData.data.pool.status, 'active');
    console.log('✔ Test 6 Passed.\n');

    // Test 7: Get pool details
    console.log('Test 7: GET /api/pools/:id (Get Pool Details)');
    const poolId = join2Data.data.pool._id;
    const detailsRes = await fetch(`${BASE_URL}/api/pools/${poolId}`);
    const detailsData = await detailsRes.json();
    assert.strictEqual(detailsRes.status, 200);
    assert.strictEqual(detailsData.success, true);
    assert.strictEqual(detailsData.data.pool._id, poolId);
    assert.strictEqual(detailsData.data.members.length, 2);
    console.log('✔ Test 7 Passed.\n');

    // Test 8: Get active pools
    console.log('Test 8: GET /api/pools/active (Get Active Pools)');
    const activeRes = await fetch(`${BASE_URL}/api/pools/active`);
    const activeData = await activeRes.json();
    assert.strictEqual(activeRes.status, 200);
    assert.strictEqual(activeData.success, true);
    const activeIds = activeData.data.map(p => p.productId);
    assert.ok(activeIds.includes(productId2));
    assert.ok(!activeIds.includes(productId1));
    console.log('✔ Test 8 Passed.\n');

    // Test 9: Get procurement batches
    console.log('Test 9: GET /api/procurements (Get Procurement Batches)');
    const procRes = await fetch(`${BASE_URL}/api/procurements?productId=${productId1}`);
    const procData = await procRes.json();
    assert.strictEqual(procRes.status, 200);
    assert.strictEqual(procData.success, true);
    assert.strictEqual(procData.count, 1);
    assert.strictEqual(procData.data[0].productId, productId1);
    assert.strictEqual(procData.data[0].status, 'pending');
    console.log('✔ Test 9 Passed.\n');

    // Test 10: Update procurement batch status
    console.log('Test 10: PATCH /api/procurements/:id (Update Status)');
    const batchId = procData.data[0]._id;
    const patchRes = await fetch(`${BASE_URL}/api/procurements/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ordered'
      })
    });
    const patchData = await patchRes.json();
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchData.success, true);
    assert.strictEqual(patchData.data.status, 'ordered');
    console.log('✔ Test 10 Passed.\n');

    console.log('====================================');
    console.log('ALL ATLAS TESTS COMPLETED SUCCESSFULLY! 🎉');
    console.log('====================================');
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log('Stopping test server...');
      serverProcess.kill();
    }
  }
}

startServer()
  .then(runTests)
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
