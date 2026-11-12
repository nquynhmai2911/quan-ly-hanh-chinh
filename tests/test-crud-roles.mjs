// tests/test-crud-roles.mjs
// Test full CRUD (Create, Read, Update, Delete) across internal staff roles

const BASE_URL = 'http://localhost:3001';

async function login(email, password = 'Demo@123') {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = res.headers.get('set-cookie');
  const json = await res.json();
  if (!json.success) throw new Error('Login failed for ' + email + ': ' + json.error?.message);
  return cookie;
}

async function testRoleCrud(roleName, email, password = 'Demo@123') {
  console.log(`=== TESTING ROLE: ${roleName} (${email}) ===`);
  const cookie = await login(email, password);

  // Lấy danh mục routing-options (books, people, units) & document types
  const optsRes = await fetch(`${BASE_URL}/api/documents/routing-options`, {
    headers: { Cookie: cookie }
  });
  const optsJson = await optsRes.json();
  if (!optsJson.success) throw new Error('Failed to get routing options: ' + optsJson.error?.message);

  const typesRes = await fetch(`${BASE_URL}/api/catalogs/document-types`, {
    headers: { Cookie: cookie }
  });
  const typesJson = await typesRes.json();
  if (!typesJson.success) throw new Error('Failed to get document types: ' + typesJson.error?.message);

  const bookId = optsJson.data.books?.[0]?.id;
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie }
  });
  const meJson = await meRes.json();
  console.log('  me positions:', JSON.stringify(meJson.data?.positions || meJson.data?.user?.positions));
  const unitId = (meJson.data?.positions || meJson.data?.user?.positions)?.[0]?.unitId || optsJson.data.units?.[0]?.id;
  const typeId = typesJson.data?.[0]?.id || 'CV';

  // 1. Create Incoming Doc
  const incRes = await fetch(`${BASE_URL}/api/documents/incoming`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: `Test VB Den tu ${roleName}`,
      documentTypeId: typeId,
      documentBookId: bookId,
      issuedDate: new Date().toISOString(),
      receivedDate: new Date().toISOString(),
      originalCode: `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      senderName: `Don vi test ${roleName}`,
      urgency: 'NORMAL',
      security: 'NORMAL',
      summaryNotes: 'Trích yếu test'
    })
  });
  const incJson = await incRes.json();
  if (!incJson.success) throw new Error(`Failed to create incoming: ${incJson.error?.message}`);
  const incId = incJson.data?.id || incJson.data?.document?.id;
  console.log(`  [+] Created incoming doc: ${incId}`);

  // 2. Read Incoming Doc
  const getInc = await fetch(`${BASE_URL}/api/documents/${incId}`, {
    headers: { Cookie: cookie }
  });
  const getIncJson = await getInc.json();
  if (!getIncJson.success) throw new Error('Failed to read incoming document: ' + getIncJson.error?.message);
  console.log(`  [+] Read incoming doc: ${getIncJson.data?.title || getIncJson.data?.document?.title}`);

  // 3. Edit Incoming Doc (PATCH)
  const patchInc = await fetch(`${BASE_URL}/api/documents/${incId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: `Đã sửa bởi ${roleName}`,
      urgency: 'URGENT',
      summaryNotes: 'Ghi chú cập nhật'
    })
  });
  const patchIncJson = await patchInc.json();
  if (!patchIncJson.success) throw new Error(`Failed to update incoming: ${patchIncJson.error?.message}`);
  console.log(`  [+] Updated incoming doc title: ${patchIncJson.data.title}`);

  // 4. Delete Incoming Doc
  const delInc = await fetch(`${BASE_URL}/api/documents/${incId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  });
  const delIncJson = await delInc.json();
  if (!delIncJson.success) throw new Error(`Failed to delete incoming: ${delIncJson.error?.message}`);
  console.log(`  [+] Deleted incoming doc successfully`);

  // 5. Create Outgoing Doc
  const outRes = await fetch(`${BASE_URL}/api/documents/outgoing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: `Test VB Di tu ${roleName}`,
      documentTypeId: typeId,
      draftUnitId: unitId,
      urgency: 'NORMAL',
      security: 'NORMAL',
      signerName: 'Nguyễn Văn An',
      signerPosition: 'Lãnh đạo cơ quan',
      recipientsSummary: 'Các đơn vị trực thuộc',
      summaryNotes: 'Dự thảo ban hành nội bộ'
    })
  });
  const outJson = await outRes.json();
  if (!outJson.success) throw new Error(`Failed to create outgoing: ${outJson.error?.message}`);
  const outId = outJson.data?.id || outJson.data?.document?.id;
  console.log(`  [+] Created outgoing doc: ${outId}`);

  // 6. Read Outgoing Doc
  const getOut = await fetch(`${BASE_URL}/api/documents/${outId}`, {
    headers: { Cookie: cookie }
  });
  const getOutJson = await getOut.json();
  if (!getOutJson.success) throw new Error('Failed to read outgoing document: ' + getOutJson.error?.message);
  console.log(`  [+] Read outgoing doc: ${getOutJson.data?.title || getOutJson.data?.document?.title}`);

  // 7. Edit Outgoing Doc (PATCH)
  const patchOut = await fetch(`${BASE_URL}/api/documents/${outId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: `Dự thảo đã chỉnh sửa bởi ${roleName}`,
      urgency: 'FIRE'
    })
  });
  const patchOutJson = await patchOut.json();
  if (!patchOutJson.success) throw new Error(`Failed to update outgoing: ${patchOutJson.error?.message}`);
  console.log(`  [+] Updated outgoing doc title: ${patchOutJson.data.title}`);

  // 8. Delete Outgoing Doc
  const delOut = await fetch(`${BASE_URL}/api/documents/${outId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  });
  const delOutJson = await delOut.json();
  if (!delOutJson.success) throw new Error(`Failed to delete outgoing: ${delOutJson.error?.message}`);
  console.log(`  [+] Deleted outgoing doc successfully`);

  console.log(`--> ALL CRUD PASSED FOR ROLE: ${roleName}!\n`);
}

async function run() {
  await testRoleCrud('Chuyên viên', 'chuyenvien.tchc@eoffice.local');
  await testRoleCrud('Văn thư', 'vanthu@eoffice.local');
  await testRoleCrud('Trưởng phòng', 'truongphong.tchc@eoffice.local');
  await testRoleCrud('Lãnh đạo', 'giamdoc@eoffice.local');
  await testRoleCrud('Quản trị viên', 'admin@eoffice.local', 'Admin@123');
  console.log('🎉 SUCCESS: All 5 roles tested with 100% CRUD operations passed!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
