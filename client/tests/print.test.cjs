const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function consultationHtml(record, printFunction = "printCase") {
  const source = fs.readFileSync(path.join(__dirname, "../src/utils/print.js"), "utf8")
    .replace(/import clinicLogo[^;]+;/, 'const clinicLogo = "logo.png";')
    .replace(/export const /g, "const ");
  let html = "";
  const popup = { document: { open() {}, write(value) { html = value; }, close() {}, querySelector() { return null; } }, setTimeout() {} };
  new Function("window", "record", `${source}; ${printFunction}(record);`)({ open: () => popup }, record);
  return html;
}

test("full A4 consultation retains all escaped multiline lab results", () => {
  const findings = Array.from({ length: 150 }, (_, i) => `Test ${i}: <reported> & reviewed`).join("\n");
  const html = consultationHtml({ lab_results: findings });
  assert.ok(html.includes("Laboratory results"));
  assert.ok(html.includes("Test 149: &lt;reported&gt; &amp; reviewed"));
  assert.ok(!html.includes("<reported>"));
  assert.ok(html.includes('<main class="sheet consultation-sheet consultation-record-sheet">'));
  assert.equal((html.match(/<main /g) || []).length, 1);
  assert.equal((html.match(/<div class="half-print-area">/g) || []).length, 0);
  assert.equal((html.match(/Physician signature/g) || []).length, 1);
  assert.equal((html.match(/<div class="half-print-page">/g) || []).length, 0);
});

test("legacy test results print when no consultation results have been saved", () => {
  const html = consultationHtml({ laboratory_requests: [{ items: [{ test_name: "CBC", result_date: "2026-09-11", result: "Reported findings" }] }] });
  assert.ok(html.includes("CBC (2026-09-11):\nReported findings"));
});

test("cleared results stay blank and zero measurements remain visible", () => {
  const html = consultationHtml({ lab_results: "", temperature_c: 0, laboratory_requests: [{ items: [{ test_name: "CBC", result: "Old findings" }] }] });
  assert.ok(!html.includes("Old findings"));
  assert.ok(html.includes("0 °C"));
  assert.ok(!html.includes("— kg"));
});


test("medical certificate prints escaped findings, patient identity and physician signature", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/utils/print.js"), "utf8")
    .replace(/import clinicLogo[^;]+;/, 'const clinicLogo = "logo.png";').replace(/export const /g, "const ");
  let html = "";
  const popup = { document: { open() {}, write(value) { html = value; }, close() {}, querySelector() { return null; } }, setTimeout() {} };
  new Function("window", "record", `${source}; printMedicalCertificate(record);`)({ open: () => popup }, {
    charge_number:"CHG-1", patient_name:"Test Patient", patient_number:"P-1", physician:"Test Doctor", license_number:"123",
    issued_date:"2026-09-11", examination_date:"2026-09-10", findings:"<script>alert(1)</script>\nLast finding", recommendations:"Rest & review"
  });
  assert.ok(html.includes("Medical Certificate"));
  assert.ok(html.includes("Test Patient"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;\nLast finding"));
  assert.ok(html.includes("Rest &amp; review"));
  assert.ok(html.includes("License no. 123"));
  assert.ok(html.includes('<main class="sheet consultation-sheet">'));
});

test("SOA reprints saved charges, adjustments and payments with safe text", () => {
 const source=fs.readFileSync(path.join(__dirname,"../src/utils/print.js"),"utf8").replace(/import clinicLogo[^;]+;/,'const clinicLogo="logo.png";').replace(/export const /g,"const ");
 let html="";
 const popup={document:{open(){},write(value){html=value},close(){},querySelector(){return null}},setTimeout(){}};
 new Function("window","record",`${source}; printStatementOfAccount(record);`)({open:()=>popup},{invoice_number:"INV-OLD",invoice_date:"2020-01-01",patient_name:"Test <Patient>",total_amount:90,paid_amount:50,payment_status:"Partially Paid",items:[{description:"Original service",category:"Service",quantity:1,unit_price:100,item_discount:0,final_amount:100}],adjustments:[{adjustment_type:"Deduction",reason:"Original discount",amount:10}],payments:[{receipt_number:"OR-OLD",payment_method:"Cash",amount:50}]});
 assert.ok(html.includes("Test &lt;Patient&gt;"));
 for(const value of ["INV-OLD","Original service","Original discount","OR-OLD","Partially Paid","40.00"])assert.ok(html.includes(value),value);
});

for (const printFunction of ["printPrescription", "printLaboratoryRequest"]) {
  test(`${printFunction} uses the rotated half-A4 form with one signature`, () => {
    const html = consultationHtml({ items: [] }, printFunction);
    assert.equal((html.match(/<div class="half-print-page">/g) || []).length, 1);
    assert.equal((html.match(/<div class="half-print-area">/g) || []).length, 1);
    assert.ok(/<main class="[^"]*half-record-sheet/.test(html));
    assert.equal((html.match(/Physician signature/g) || []).length, 1);
  });
}
