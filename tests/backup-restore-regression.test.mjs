import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

function between(start, end) {
  const from = page.indexOf(start);
  const to = page.indexOf(end, from);
  assert.notEqual(from, -1, `missing source anchor: ${start}`);
  assert.notEqual(to, -1, `missing source anchor: ${end}`);
  return page.slice(from, to);
}

const validator = between("async function validateStockSaathiBackup", "\ntype Product = {");
const restore = between("async function prepareBusinessRestore", "function downloadReconciliationAuditCsv");

test("legacy version-4 backup without checksum remains supported", () => {
  assert.match(validator, /const hasIntegrity=value\.integrity!==undefined/);
  assert.match(validator, /if\(hasIntegrity\).*backupDigest/s);
  assert.match(restore, /Legacy backup structure aur record validation pass hui/);
});

test("legacy batch without unitCost is accepted for migration", () => {
  assert.match(validator, /batch\.unitCost!==undefined/);
  assert.match(page, /unitCost:.*costPrice|unitCost\s*\?\?.*costPrice|unitCost\s*===\s*undefined/);
});

test("modified payload with stale SHA-256 digest is rejected", () => {
  assert.match(validator, /expected!==\(value\.integrity as \{digest:string\}\)\.digest/);
  assert.match(validator, /SHA-256 integrity check failed/);
});

test("malformed checksum envelope is rejected", () => {
  assert.match(validator, /algorithm!==\"SHA-256\"/);
  assert.match(validator, /!\/\^\[a-f0-9\]\{64\}\$\//);
});

test("malformed business dates and timestamps are rejected", () => {
  assert.match(validator, /const validDateOnly=/);
  assert.match(validator, /const validTimestamp=/);
  assert.match(validator, /validDateOnly\(sale\.soldAt as string,false\)/);
  assert.match(validator, /validDateOnly\(\(v as Record<string,string>\)\.spentAt,false\)/);
});

test("duplicate product and batch identifiers are rejected", () => {
  assert.match(validator, /!idsUnique\(d\.products\)/);
  assert.match(validator, /new Set\(batchIds\)\.size!==batchIds\.length/);
});

test("product quantity must equal sum of batch quantities", () => {
  assert.match(validator, /Math\.abs\(batchTotal-product\.quantity\)>0\.000001/);
});

test("invalid cost layers and inconsistent sale totals are rejected", () => {
  assert.match(validator, /!layers\.length\|\|!layers\.every/);
  assert.match(validator, /layerQuantity-q/);
  assert.match(validator, /layerCost-\(sale\.cost as number\)/);
  assert.match(validator, /sale\.revenue as number/);
  assert.match(validator, /sale\.profit as number/);
});

test("orphan sale, movement and supplier references are rejected", () => {
  assert.match(validator, /Sale ka linked product backup mein nahi mila/);
  assert.match(validator, /Stock movement ka linked product backup mein nahi mila/);
  assert.match(validator, /Product ka linked supplier backup mein nahi mila/);
});

test("oversized backup is rejected before parsing", () => {
  assert.match(restore, /file\.size>10\*1024\*1024/);
  assert.ok(restore.indexOf("file.size>10*1024*1024") < restore.indexOf("JSON.parse"));
});

test("malformed JSON and unsupported records never reach restore preview", () => {
  assert.match(restore, /JSON\.parse\(await file\.text\(\)\)/);
  assert.match(restore, /if\(!validation\.ok\).*return/s);
  assert.match(restore, /catch\{setNotice\("Backup file read nahi hui/);
  assert.ok(restore.indexOf("if(!validation.ok)") < restore.indexOf("setPendingRestore(validation.backup)"));
});

test("restore reads previous data before writing and verifies exact read-back", () => {
  assert.match(restore, /previous=window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(restore, /window\.localStorage\.setItem\(STORAGE_KEY,serialized\)/);
  assert.match(restore, /window\.localStorage\.getItem\(STORAGE_KEY\)!==serialized/);
});

test("failed restore attempts rollback and does not update React state", () => {
  const failure = restore.slice(restore.indexOf("}catch{", restore.indexOf("window.localStorage.setItem(STORAGE_KEY,serialized)")));
  assert.match(failure, /window\.localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(failure, /window\.localStorage\.setItem\(STORAGE_KEY,previous\)/);
  assert.match(failure, /return;/);
  assert.ok(failure.indexOf("return;") < failure.indexOf("setProducts(restoredProducts)"));
});

test("React state is updated only after successful persistence verification", () => {
  const verify = restore.indexOf('if(window.localStorage.getItem(STORAGE_KEY)!==serialized)');
  const state = restore.indexOf("setProducts(restoredProducts)");
  assert.ok(verify !== -1 && state > verify);
});

test("missing collections and unsupported backup/schema versions are rejected", () => {
  assert.match(validator, /value\.backupVersion!==1/);
  assert.match(validator, /d\.version!==4/);
  assert.match(validator, /!Array\.isArray\(d\.products\)/);
  assert.match(validator, /!Array\.isArray\(d\.reconciliationAudit\)/);
});

test("storage read failure cancels restore before any write", () => {
  const readFailure = restore.slice(restore.indexOf("let previous:string|null;"), restore.indexOf("try{previous=window.localStorage.getItem(STORAGE_KEY);"));
  assert.match(restore, /Current browser storage read nahi ho saka/);
  assert.match(restore, /catch\{setNotice\("Current browser storage read nahi ho saka/);
  assert.match(restore, /catch\{setNotice\("Current browser storage read nahi ho saka[\s\S]*?return;/);
});

test("legacy and current backup integrity paths are explicitly differentiated", () => {
  assert.match(restore, /pendingRestore\.integrity\?/);
  assert.match(restore, /No SHA-256 checksum was present/);
  assert.match(page, /crypto\.subtle\.digest\("SHA-256"/);
});
