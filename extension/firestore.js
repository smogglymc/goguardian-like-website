// Minimal Firestore REST client — no SDK needed, works fine in a MV3
// service worker. Encodes/decodes Firestore's typed field format.

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "object") {
    const fields = {};
    for (const k in v) fields[k] = toFirestoreValue(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFirestoreValue(fv) {
  if (!fv) return null;
  if ("stringValue" in fv) return fv.stringValue;
  if ("booleanValue" in fv) return fv.booleanValue;
  if ("doubleValue" in fv) return fv.doubleValue;
  if ("integerValue" in fv) return Number(fv.integerValue);
  if ("timestampValue" in fv) return fv.timestampValue;
  if ("nullValue" in fv) return null;
  if ("mapValue" in fv) {
    const out = {};
    const fields = fv.mapValue.fields || {};
    for (const k in fields) out[k] = fromFirestoreValue(fields[k]);
    return out;
  }
  return null;
}

function docToObject(doc) {
  if (!doc || !doc.fields) return null;
  const out = { _path: doc.name };
  for (const k in doc.fields) out[k] = fromFirestoreValue(doc.fields[k]);
  return out;
}

async function fsCreate(collectionPath, data) {
  const fields = {};
  for (const k in data) fields[k] = toFirestoreValue(data[k]);
  const res = await fetch(`${FIRESTORE_BASE}/${collectionPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore create failed: ${res.status}`);
  return docToObject(await res.json());
}

async function fsGet(docPath) {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get failed: ${res.status}`);
  return docToObject(await res.json());
}

async function fsPatch(docPath, data, updateMaskFields) {
  const fields = {};
  for (const k in data) fields[k] = toFirestoreValue(data[k]);
  const mask = (updateMaskFields || Object.keys(data))
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?${mask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Firestore patch failed: ${res.status}`);
  return docToObject(await res.json());
}

async function fsQueryJoinCode(joinCode) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "classes" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "joinCode" },
          op: "EQUAL",
          value: { stringValue: joinCode }
        }
      },
      limit: 1
    }
  };
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status}`);
  const rows = await res.json();
  const row = rows.find((r) => r.document);
  return row ? docToObject(row.document) : null;
}
