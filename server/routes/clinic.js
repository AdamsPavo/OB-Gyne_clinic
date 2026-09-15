const express = require("express");
const db = require("../database/database");

const { validateMedicalCertificate } = require("../services/medicalCertificate");
const router = express.Router();
const { permissionGuard, hasPermission } = require("../services/permissions");
router.use(permissionGuard);
router.use(require("./backups")(db));
const { savePrenatalVisit } = require("../services/pregnancies");
router.use(require("./pregnancies")(db));
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const billingIdentity = record => {
  if (record.patient_number !== "OPD-WALK-IN") return {...record, case_number:record.case_number || (!record.consultation_case_id ? "OPD Walk-in" : record.case_number)};
  const invoiceId = record.invoice_id || record.id;
  const invoice = db.prepare("SELECT recipient_name FROM invoices WHERE id=?").get(invoiceId);
  const certificates = db.prepare("SELECT certificate FROM patient_charges WHERE invoice_id=? AND certificate IS NOT NULL ORDER BY id").all(invoiceId);
  let recipient = invoice?.recipient_name;
  for (const row of certificates) { if (!recipient) { try { recipient = JSON.parse(row.certificate)?.recipient_name; } catch { /* Old invalid document. */ } } }
  return {...record, patient_name:recipient || "Name not recorded", case_number:"OPD Walk-in"};
};
const normalizePatientName = (value) => typeof value === "string"
  ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
const cents = (value) => Math.max(0, Math.round((Number(value) || 0) * 100));
const amount = (value) => Number((Number(value || 0) / 100).toFixed(2));

const recalculateInvoice = (invoiceId) => {
  const totals = db.prepare(`SELECT
    COALESCE(SUM(subtotal_cents),0) subtotal,
    COALESCE(SUM(discount_cents),0) discount,
    COALESCE(SUM(final_amount_cents),0) grand_total
    FROM invoice_items WHERE invoice_id=? AND is_void=0`).get(invoiceId);
  const adjustments = db.prepare(`SELECT COALESCE(SUM(CASE
    WHEN adjustment_type='Addition' THEN amount_cents ELSE -amount_cents END),0) total
    FROM billing_adjustments WHERE invoice_id=?`).get(invoiceId).total;
  const invoice = db.prepare("SELECT paid_amount FROM invoices WHERE id=?").get(invoiceId);
  const grandTotalCents = Math.max(0, totals.grand_total + adjustments);
  const paidCents = cents(invoice?.paid_amount);
  const remainingCents = Math.max(0, grandTotalCents - paidCents);
  const status = paidCents <= 0 ? "Unpaid"
    : paidCents < grandTotalCents ? "Partially Paid"
    : paidCents === grandTotalCents ? "Paid" : "Overpaid";
  db.prepare(`UPDATE invoices SET subtotal=?,discount=?,total_discount=?,
    total_amount=?,grand_total=?,remaining_balance=?,payment_status=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    amount(totals.subtotal),amount(totals.discount),amount(totals.discount),
    amount(grandTotalCents),amount(grandTotalCents),amount(remainingCents),status,invoiceId);
  return db.prepare("SELECT * FROM invoices WHERE id=?").get(invoiceId);
};

const upsertInvoiceItem = (item) => {
  const quantity = Math.max(1, parseInt(item.quantity,10)||1);
  const unit = cents(item.unit_price);
  const subtotal = quantity * unit;
  const discount = Math.min(subtotal, cents(item.discount));
  const existing = item.source_id == null ? null : db.prepare(`SELECT id FROM invoice_items
    WHERE invoice_id=? AND source_type=? AND source_id=? AND is_void=0`)
    .get(item.invoice_id,item.source_type,item.source_id);
  if(existing){
    db.prepare(`UPDATE invoice_items SET category=?,description=?,quantity=?,
      unit_price_cents=?,subtotal_cents=?,discount_cents=?,final_amount_cents=?,
      remarks=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(item.category,
      item.description,quantity,unit,subtotal,discount,subtotal-discount,
      text(item.remarks),existing.id);
    return existing.id;
  }
  return db.prepare(`INSERT INTO invoice_items
    (invoice_id,patient_id,consultation_case_id,source_type,source_id,category,
     description,quantity,unit_price_cents,subtotal_cents,discount_cents,
     final_amount_cents,remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    item.invoice_id,item.patient_id,item.consultation_case_id||null,item.source_type,
    item.source_id||null,item.category,item.description,quantity,unit,subtotal,
    discount,subtotal-discount,text(item.remarks)).lastInsertRowid;
};

const nextNumber = (prefix, table, column) => {
  const latest = db
    .prepare(
      `SELECT ${column} AS value
       FROM ${table}
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get();

  const value =
    latest?.value?.match(/(\d+)$/)?.[1] || "0";

  return `${prefix}-${String(
    Number(value) + 1,
  ).padStart(6, "0")}`;
};

router.get("/tools/overview", (req, res) => {
  try {
    res.json({
      settings: db.prepare("SELECT * FROM settings WHERE id = 1").get() || null,
      serviceTypes: db.prepare("SELECT * FROM service_types ORDER BY is_active DESC, name").all(),
      chargeTypes: db.prepare("SELECT * FROM charge_types ORDER BY is_active DESC, name").all(),
      medicines: db.prepare("SELECT * FROM medicine_inventory ORDER BY medicine_name").all(),
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load system tools." });
  }
});

router.get("/service-types", (req, res) => {
  try {
    const services = db.prepare(`
      SELECT id, name, description, default_fee
      FROM service_types
      WHERE is_active = 1
      ORDER BY name
    `).all();
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Unable to load service types." });
  }
});

const serviceSelect = `id, name, name AS service_name, default_fee, default_fee AS price, is_active, created_at, updated_at`;
const serviceManager = permissionGuard;
const servicePayload = (body) => ({
  name: text(body.service_name ?? body.name),
  price: Number(body.price ?? body.default_fee),
  active: body.is_active === false || body.is_active === 0 ? 0 : 1,
});

router.get("/services", (req, res) => {
  const where = !hasPermission(req.user, "tools") ? "WHERE is_active=1" : "";
  res.json(db.prepare(`SELECT ${serviceSelect} FROM service_types ${where} ORDER BY is_active DESC, name`).all());
});
router.get("/services/active", (req, res) => res.json(db.prepare(`SELECT ${serviceSelect} FROM service_types WHERE is_active=1 ORDER BY name`).all()));
router.get("/services/:id", (req, res) => {
  const row = db.prepare(`SELECT ${serviceSelect} FROM service_types WHERE id=?`).get(req.params.id);
  if (!row || (!hasPermission(req.user, "tools") && !row.is_active)) return res.status(404).json({ message: "Service not found." });
  res.json(row);
});
router.post("/services", serviceManager, (req, res) => {
  const value = servicePayload(req.body);
  if (!value.name) return res.status(400).json({ message: "Service name is required." });
  if (!Number.isFinite(value.price) || value.price < 0) return res.status(400).json({ message: "Price must be zero or greater." });
  try { const result=db.prepare("INSERT INTO service_types (name,default_fee,is_active) VALUES (?,?,?)").run(value.name,value.price,value.active); res.status(201).json({id:result.lastInsertRowid,message:"Service added."}); }
  catch(error){res.status(String(error.message).includes("UNIQUE")?409:500).json({message:String(error.message).includes("UNIQUE")?"That service already exists.":"Unable to add service."});}
});
router.put("/services/:id", serviceManager, (req, res) => {
  const value=servicePayload(req.body); if(!value.name)return res.status(400).json({message:"Service name is required."});
  if(!Number.isFinite(value.price)||value.price<0)return res.status(400).json({message:"Price must be zero or greater."});
  try{const result=db.prepare("UPDATE service_types SET name=?,default_fee=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(value.name,value.price,value.active,req.params.id);if(!result.changes)return res.status(404).json({message:"Service not found."});res.json({message:"Service updated."});}catch{res.status(409).json({message:"That service already exists."});}
});
router.put("/services/:id/status", serviceManager, (req,res)=>{const result=db.prepare("UPDATE service_types SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.body.is_active?1:0,req.params.id);if(!result.changes)return res.status(404).json({message:"Service not found."});res.json({message:req.body.is_active?"Service activated.":"Service deactivated."});});
router.delete("/services/:id", serviceManager, (req,res)=>{const linked=db.prepare(`SELECT 1 FROM appointments WHERE service_id=? UNION ALL SELECT 1 FROM consultation_cases WHERE service_id=? LIMIT 1`).get(req.params.id,req.params.id);if(linked)return res.status(409).json({message:"This service has appointment or consultation history. Mark it inactive instead."});const result=db.prepare("DELETE FROM service_types WHERE id=?").run(req.params.id);if(!result.changes)return res.status(404).json({message:"Service not found."});res.status(204).end();});

router.get("/charge-types", (req, res) => {
  res.json(db.prepare(`SELECT id,name,category,description,default_amount
    FROM charge_types WHERE is_active=1 ORDER BY category,name`).all());
});

router.post("/tools/charge-types", (req, res) => {
  const name = text(req.body.name);
  if (!name) return res.status(400).json({ message: "Charge name is required." });
  try {
    const result = db.prepare(`INSERT INTO charge_types
      (name,category,description,default_amount,is_active) VALUES (?,?,?,?,?)`)
      .run(name,text(req.body.category)||"Miscellaneous",text(req.body.description),
        Math.max(0,Number(req.body.default_amount)||0),req.body.is_active===false?0:1);
    res.status(201).json({ id:result.lastInsertRowid,message:"Charge type added." });
  } catch (error) {
    res.status(409).json({ message:"That charge type already exists." });
  }
});

router.put("/tools/charge-types/:id", (req, res) => {
  const result=db.prepare(`UPDATE charge_types SET name=?,category=?,description=?,
    default_amount=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(text(req.body.name),text(req.body.category)||"Miscellaneous",
      text(req.body.description),Math.max(0,Number(req.body.default_amount)||0),
      req.body.is_active?1:0,req.params.id);
  if(!result.changes)return res.status(404).json({message:"Charge type not found."});
  res.json({message:"Charge type updated."});
});

router.delete("/tools/charge-types/:id", (req, res) => {
  const used=db.prepare("SELECT id FROM patient_charges WHERE charge_type_id=? LIMIT 1").get(req.params.id);
  if(used)return res.status(409).json({message:"This charge has billing history. Mark it inactive instead."});
  const result=db.prepare("DELETE FROM charge_types WHERE id=?").run(req.params.id);
  if(!result.changes)return res.status(404).json({message:"Charge type not found."});
  res.status(204).end();
});

router.get("/patient-charges", (req, res) => {
  const params=[],where=[];
  if(req.query.patient_id){where.push("pc.patient_id=?");params.push(req.query.patient_id);}
  const rows=db.prepare(`SELECT pc.*,COALESCE(ii.item_name,ct.name) charge_name,ct.category,
    p.patient_number,trim(p.first_name||' '||COALESCE(NULLIF(p.middle_name,'')||' ','')||p.last_name) patient_name,
    c.case_number,i.invoice_number,i.payment_status,i.paid_amount
    FROM patient_charges pc JOIN charge_types ct ON ct.id=pc.charge_type_id
    LEFT JOIN inventory_items ii ON ii.id=pc.inventory_item_id
    JOIN patients p ON p.id=pc.patient_id
    LEFT JOIN consultation_cases c ON c.id=pc.consultation_case_id
    JOIN invoices i ON i.id=pc.invoice_id
    ${where.length?`WHERE ${where.join(" AND ")}`:""}
    ORDER BY pc.charge_date DESC,pc.id DESC`).all(...params);
  res.json(rows.map(billingIdentity));
});

router.post("/patient-charges", (req, res) => {
  if(!req.body.patient_id)
    return res.status(400).json({message:"Patient is required."});
  try {
    const create=db.transaction(()=>{
      const lines = req.body.items || [req.body];
      if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error("Select between 1 and 100 charges.");
      let sharedInvoice = null;
      const recipient = text(req.body.walk_in_name) || lines.map(line=>text(line.certificate?.recipient_name)).find(Boolean);
      if (db.prepare("SELECT patient_number FROM patients WHERE id=?").get(req.body.patient_id)?.patient_number === "OPD-WALK-IN" && !recipient)
        throw new Error("Enter the walk-in patient's full name.");
      const results = lines.map(line => {
      const body = {...req.body, ...line, patient_id:req.body.patient_id, consultation_case_id:req.body.consultation_case_id};
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Enter a positive whole quantity.");
      const item = body.inventory_item_id ? db.prepare("SELECT * FROM inventory_items WHERE id=? AND is_archived=0").get(body.inventory_item_id) : null;
      if (body.inventory_item_id && !item) throw new Error("Active inventory item not found.");
      if (item) body.charge_type_id = db.prepare("SELECT id FROM charge_types WHERE name='Inventory Item'").get()?.id;
      const patient=db.prepare("SELECT id,patient_number FROM patients WHERE id=? AND is_archived=0").get(body.patient_id);
      const charge=db.prepare("SELECT * FROM charge_types WHERE id=? AND is_active=1").get(body.charge_type_id);
      if(!patient)throw new Error("Active patient not found.");
      if(!charge)throw new Error("Active charge type not found.");
      if(patient.patient_number === "OPD-WALK-IN" && body.consultation_case_id) throw new Error("OPD Walk-in charges cannot link to a consultation.");
      if(body.consultation_case_id){
        const linked=db.prepare("SELECT id FROM consultation_cases WHERE id=? AND patient_id=?")
          .get(body.consultation_case_id,body.patient_id);
        if(!linked)throw new Error("The selected case does not belong to this patient.");
      }
      if (item && item.selling_price == null) throw new Error(`Set a selling price for ${item.item_name} in Inventory first.`);
      const unitAmount=Number(item ? item.selling_price : (body.unit_amount ?? charge.default_amount));
      if (!Number.isFinite(unitAmount) || unitAmount < 0) throw new Error("Enter a valid charge amount.");
      const total=unitAmount*quantity;
      let invoice=sharedInvoice || (body.consultation_case_id?db.prepare(
        "SELECT * FROM invoices WHERE consultation_case_id=?").get(body.consultation_case_id):null);
      if(!invoice){
        const invoiceNumber=nextNumber("MSC", "invoices", "invoice_number");
        const result=db.prepare(`INSERT INTO invoices
          (invoice_number,patient_id,consultation_case_id,invoice_date,subtotal,total_amount,payment_status,notes)
          VALUES (?,?,?,?,?,?,?,?)`).run(invoiceNumber,body.patient_id,
          body.consultation_case_id||null,text(body.charge_date)||new Date().toISOString().slice(0,10),
          total,total,"Pending","Patient miscellaneous charges");
        invoice=db.prepare("SELECT * FROM invoices WHERE id=?").get(result.lastInsertRowid);
      }
      sharedInvoice=invoice;
      if (patient.patient_number === "OPD-WALK-IN") db.prepare("UPDATE invoices SET recipient_name=? WHERE id=?").run(recipient,invoice.id);
      if (item) releaseInventory({...body, performed_by:req.user?.full_name || req.user?.username, reason:"Other charge", transaction_date:body.charge_date}, "Dispensed");
      const number=nextNumber("CHG", "patient_charges", "charge_number");
      const result=db.prepare(`INSERT INTO patient_charges
        (charge_number,patient_id,charge_type_id,consultation_case_id,invoice_id,
         description,quantity,unit_amount,total_amount,charge_date,created_by,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(number,body.patient_id,
          charge.id,body.consultation_case_id||null,invoice.id,
          item ? item.item_name : (text(body.description)||charge.description),quantity,unitAmount,total,
          text(body.charge_date)||new Date().toISOString().slice(0,10),
          text(body.created_by),text(body.notes));
      if (line.certificate != null) {
        if (item || !/medical cert/i.test(`${charge.name} ${charge.category}`)) throw new Error("This charge is not a medical certificate.");
        const certificate = validateMedicalCertificate(line.certificate, req.user);
        if (patient.patient_number === "OPD-WALK-IN" && !certificate.recipient_name) throw new Error("Enter the certificate recipient name.");
        db.prepare("UPDATE patient_charges SET certificate=? WHERE id=?").run(JSON.stringify(certificate),result.lastInsertRowid);
      }
      if (item) db.prepare("UPDATE patient_charges SET inventory_item_id=? WHERE id=?").run(item.id,result.lastInsertRowid);
      upsertInvoiceItem({
        invoice_id:invoice.id,patient_id:body.patient_id,
        consultation_case_id:body.consultation_case_id||null,
        source_type:"manual_charge",source_id:result.lastInsertRowid,
        category:charge.category,description:item ? item.item_name : (text(body.description)||charge.name),
        quantity,unit_price:unitAmount,discount:body.discount||0,
        remarks:body.notes,
      });
      recalculateInvoice(invoice.id);
      return {id:result.lastInsertRowid,charge_number:number,invoice_number:invoice.invoice_number,total};
      });
      return {...results[0], charges:results, total:results.reduce((sum,line)=>sum+line.total,0)};
    });
    res.status(201).json({...create(),message:"Patient charge added to billing."});
  }catch(error){res.status(400).json({message:error.message});}
});

router.put("/patient-charges/:id/certificate", (req, res) => {
  if (!hasPermission(req.user, "charges", "edit")) return res.status(403).json({message:"Only doctors and administrators can edit medical certificates."});
  const charge = db.prepare(`SELECT pc.id, pc.patient_id, ct.name, ct.category FROM patient_charges pc
    JOIN charge_types ct ON ct.id=pc.charge_type_id WHERE pc.id=?`).get(req.params.id);
  if (!charge) return res.status(404).json({message:"Charge not found."});
  if (!/medical cert/i.test(`${charge.name} ${charge.category}`)) return res.status(400).json({message:"This charge is not a medical certificate."});
  try {
    const certificate = validateMedicalCertificate(req.body, req.user);
    if (db.prepare("SELECT patient_number FROM patients WHERE id=?").get(charge.patient_id)?.patient_number === "OPD-WALK-IN" && !certificate.recipient_name) throw new Error("Enter the certificate recipient name.");
    db.prepare("UPDATE patient_charges SET certificate=? WHERE id=?").run(JSON.stringify(certificate),charge.id);
    res.json({certificate, message:"Medical certificate saved."});
  } catch (error) { res.status(400).json({message:error.message}); }

});


router.put("/tools/clinic-settings", (req, res) => {
  const values = [text(req.body.clinic_name), text(req.body.clinic_address), text(req.body.doctor_name)];
  if (values.some((value) => !value)) {
    return res.status(400).json({ message: "Clinic name, address, and doctor name are required." });
  }
  db.prepare(`INSERT INTO settings (id, clinic_name, clinic_address, doctor_name, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET
    clinic_name=excluded.clinic_name, clinic_address=excluded.clinic_address,
    doctor_name=excluded.doctor_name, updated_at=CURRENT_TIMESTAMP`).run(...values);
  res.json({ message: "Clinic information saved." });
});

router.post("/tools/services", (req, res) => {
  const name = text(req.body.name);
  if (!name) return res.status(400).json({ message: "Service name is required." });
  try {
    const result = db.prepare(`INSERT INTO service_types
      (name, description, default_fee, is_active) VALUES (?, ?, ?, ?)`)
      .run(name, text(req.body.description), Math.max(0, Number(req.body.default_fee) || 0), req.body.is_active === false ? 0 : 1);
    res.status(201).json({ id: result.lastInsertRowid, message: "Service added." });
  } catch (error) {
    res.status(String(error.message).includes("UNIQUE") ? 409 : 500)
      .json({ message: String(error.message).includes("UNIQUE") ? "That service already exists." : "Unable to add service." });
  }
});

router.put("/tools/services/:id", (req, res) => {
  const name = text(req.body.name);
  if (!name) return res.status(400).json({ message: "Service name is required." });
  try {
    const result = db.prepare(`UPDATE service_types SET name=?, description=?,
      default_fee=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name, text(req.body.description), Math.max(0, Number(req.body.default_fee) || 0), req.body.is_active ? 1 : 0, req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Service not found." });
    res.json({ message: "Service updated." });
  } catch (error) {
    res.status(409).json({ message: "That service already exists." });
  }
});

router.delete("/tools/services/:id", (req, res) => {
  const result = db.prepare("DELETE FROM service_types WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Service not found." });
  res.status(204).end();
});

const medicineValues = (body) => [
  text(body.medicine_name), text(body.generic_name), text(body.unit) || "piece",
  Math.max(0, parseInt(body.quantity, 10) || 0), Math.max(0, parseInt(body.reorder_level, 10) || 0),
  Math.max(0, Number(body.unit_price) || 0), text(body.expiry_date), text(body.notes),
];

router.post("/tools/medicines", (req, res) => {
  const values = medicineValues(req.body);
  if (!values[0]) return res.status(400).json({ message: "Medicine name is required." });
  const result = db.prepare(`INSERT INTO medicine_inventory
    (medicine_name,generic_name,unit,quantity,reorder_level,unit_price,expiry_date,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(...values);
  res.status(201).json({ id: result.lastInsertRowid, message: "Medicine added." });
});

router.put("/tools/medicines/:id", (req, res) => {
  const values = medicineValues(req.body);
  if (!values[0]) return res.status(400).json({ message: "Medicine name is required." });
  const result = db.prepare(`UPDATE medicine_inventory SET medicine_name=?,generic_name=?,
    unit=?,quantity=?,reorder_level=?,unit_price=?,expiry_date=?,notes=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...values, req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Medicine not found." });
  res.json({ message: "Medicine updated." });
});

router.delete("/tools/medicines/:id", (req, res) => {
  const result = db.prepare("DELETE FROM medicine_inventory WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Medicine not found." });
  res.status(204).end();
});

/* =========================================================
   BATCH-AWARE INVENTORY
========================================================= */

const inventoryNumber = () =>
  `INV-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

const inventoryItemSelect = `
  SELECT i.*,
    (SELECT b.expiration_date FROM inventory_batches b
      WHERE b.inventory_item_id=i.id AND b.quantity>0
      ORDER BY CASE WHEN b.expiration_date IS NULL THEN 1 ELSE 0 END,
      b.expiration_date LIMIT 1) AS expiration_date,
    (SELECT b.batch_number FROM inventory_batches b
      WHERE b.inventory_item_id=i.id AND b.quantity>0
      ORDER BY CASE WHEN b.expiration_date IS NULL THEN 1 ELSE 0 END,
      b.expiration_date LIMIT 1) AS batch_number
  FROM inventory_items i`;

const withInventoryStatus = (item) => {
  const days = item.expiration_date
    ? Math.ceil((new Date(`${item.expiration_date}T00:00:00`) - new Date()) / 86400000)
    : null;
  let status = "In Stock";
  if (item.current_stock <= 0) status = "Out of Stock";
  else if (days !== null && days < 0) status = "Expired";
  else if (days !== null && days <= 90) status = "Near Expiration";
  else if (item.current_stock <= item.minimum_stock_level) status = "Low Stock";
  return { ...item, status, expiration_days: days };
};

router.get("/inventory/overview", (req, res) => {
  try {
    const items = db.prepare(`${inventoryItemSelect}
      WHERE i.is_archived = ? ORDER BY i.item_name`)
      .all(req.query.archived === "1" ? 1 : 0).map(withInventoryStatus);
    const month = new Date().toISOString().slice(0, 7);
    const movement = db.prepare(`SELECT transaction_type, COALESCE(SUM(quantity),0) total
      FROM inventory_transactions WHERE substr(transaction_date,1,7)=?
      GROUP BY transaction_type`).all(month);
    const summary = {
      totalItems: items.length,
      lowStock: items.filter((i) => i.status === "Low Stock").length,
      outOfStock: items.filter((i) => i.status === "Out of Stock").length,
      nearExpiration: items.filter((i) => i.status === "Near Expiration").length,
      expired: items.filter((i) => i.status === "Expired").length,
      totalValue: items.reduce((sum, i) => sum + i.current_stock * i.unit_cost, 0),
      stockIn: movement.filter((m) => m.transaction_type === "Stock In").reduce((s, m) => s + m.total, 0),
      stockOut: movement.filter((m) => m.transaction_type !== "Stock In" && m.transaction_type !== "Adjustment In").reduce((s, m) => s + m.total, 0),
    };
    res.json({ items, summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load inventory." });
  }
});

router.post("/inventory/items", (req, res) => {
  const required = ["item_name", "category", "unit_of_measurement"];
  if (required.some((key) => !text(req.body[key]))) {
    return res.status(400).json({ message: "Item name, category, and unit are required." });
  }
  try {
    const result = db.prepare(`INSERT INTO inventory_items
      (item_code,item_name,category,brand,description,unit_of_measurement,supplier,
       minimum_stock_level,unit_cost,storage_location,selling_price)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      text(req.body.item_code) || nextNumber("ITM","inventory_items","item_code"), text(req.body.item_name), text(req.body.category),
      text(req.body.brand), text(req.body.description), text(req.body.unit_of_measurement),
      text(req.body.supplier), Math.max(0, parseInt(req.body.minimum_stock_level,10)||0),
      Math.max(0, Number(req.body.unit_cost)||0), text(req.body.storage_location), req.body.selling_price === "" || req.body.selling_price == null ? null : Math.max(0,Number(req.body.selling_price)||0));
    res.status(201).json({ id: result.lastInsertRowid, message: "Inventory item added." });
  } catch (error) {
    res.status(String(error.message).includes("UNIQUE") ? 409 : 500)
      .json({ message: String(error.message).includes("UNIQUE") ? "Item code already exists." : "Unable to add inventory item." });
  }
});

router.put("/inventory/items/:id", (req, res) => {
  const result = db.prepare(`UPDATE inventory_items SET item_code=?,item_name=?,
    category=?,brand=?,description=?,unit_of_measurement=?,supplier=?,
    minimum_stock_level=?,unit_cost=?,storage_location=?,selling_price=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?`).run(
    text(req.body.item_code), text(req.body.item_name), text(req.body.category),
    text(req.body.brand), text(req.body.description), text(req.body.unit_of_measurement),
    text(req.body.supplier), Math.max(0,parseInt(req.body.minimum_stock_level,10)||0),
    Math.max(0,Number(req.body.unit_cost)||0), text(req.body.storage_location), req.body.selling_price === "" || req.body.selling_price == null ? null : Math.max(0,Number(req.body.selling_price)||0), req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Inventory item not found." });
  res.json({ message: "Inventory item updated." });
});

router.patch("/inventory/items/:id/archive", (req, res) => {
  const result = db.prepare(`UPDATE inventory_items SET is_archived=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.body.archived ? 1 : 0, req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Inventory item not found." });
  res.json({ message: req.body.archived ? "Item archived." : "Item restored." });
});

router.post("/inventory/stock-in", (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!req.body.inventory_item_id || !quantity || quantity < 1) {
    return res.status(400).json({ message: "Item and a positive quantity are required." });
  }
  try {
    const save = db.transaction(() => {
      const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND is_archived=0").get(req.body.inventory_item_id);
      if (!item) throw new Error("Active inventory item not found.");
      const cost = Math.max(0, Number(req.body.unit_cost) || item.unit_cost || 0);
      const batch = db.prepare(`INSERT INTO inventory_batches
        (inventory_item_id,batch_number,expiration_date,quantity,unit_cost,supplier,received_date)
        VALUES (?,?,?,?,?,?,?)`).run(item.id, text(req.body.batch_number), text(req.body.expiration_date),
          quantity, cost, text(req.body.supplier), text(req.body.transaction_date) || new Date().toISOString().slice(0,10));
      const next = item.current_stock + quantity;
      db.prepare(`UPDATE inventory_items SET current_stock=?,unit_cost=?,
        supplier=COALESCE(?,supplier),updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(next, cost, text(req.body.supplier), item.id);
      db.prepare(`INSERT INTO inventory_transactions
        (transaction_number,inventory_item_id,inventory_batch_id,transaction_type,
        quantity,previous_stock,new_stock,batch_number,expiration_date,supplier,
        unit_cost,performed_by,reference_number,transaction_date,remarks)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(inventoryNumber(), item.id,
          batch.lastInsertRowid, "Stock In", quantity, item.current_stock, next,
          text(req.body.batch_number), text(req.body.expiration_date), text(req.body.supplier),
          cost, text(req.body.performed_by), text(req.body.reference_number),
          text(req.body.transaction_date) || new Date().toISOString(), text(req.body.remarks));
      return next;
    });
    res.status(201).json({ new_stock: save(), message: "Stock received and recorded." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const releaseInventory = db.transaction((body, transactionType = "Stock Out") => {
  const quantity = parseInt(body.quantity, 10);
  const item = db.prepare("SELECT * FROM inventory_items WHERE id=? AND is_archived=0").get(body.inventory_item_id);
  if (!item) throw new Error("Active inventory item not found.");
  if (!quantity || quantity < 1) throw new Error("Enter a positive quantity.");
  if (quantity > item.current_stock) throw new Error(`Only ${item.current_stock} ${item.unit_of_measurement} available.`);
  const batches = db.prepare(`SELECT * FROM inventory_batches
    WHERE inventory_item_id=? AND quantity>0
    ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END, expiration_date, id`).all(item.id);
  let remaining = quantity;
  let runningStock = item.current_stock;
  for (const batch of batches) {
    if (remaining <= 0) break;
    if (batch.expiration_date && batch.expiration_date < new Date().toISOString().slice(0,10)
      && transactionType === "Dispensed") continue;
    const used = Math.min(remaining, batch.quantity);
    db.prepare("UPDATE inventory_batches SET quantity=quantity-? WHERE id=?").run(used, batch.id);
    const next = runningStock - used;
    db.prepare(`INSERT INTO inventory_transactions
      (transaction_number,inventory_item_id,inventory_batch_id,transaction_type,
       quantity,previous_stock,new_stock,batch_number,expiration_date,unit_cost,
       patient_id,consultation_case_id,prescription_id,reason,department,requested_by,
       performed_by,transaction_date,remarks)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      inventoryNumber(), item.id, batch.id, transactionType, used, runningStock, next,
      batch.batch_number, batch.expiration_date, batch.unit_cost, body.patient_id || null,
      body.consultation_case_id || null, body.prescription_id || null, text(body.reason),
      text(body.department), text(body.requested_by), text(body.performed_by),
      text(body.transaction_date) || new Date().toISOString(), text(body.remarks));
    runningStock = next; remaining -= used;
  }
  if (remaining > 0) throw new Error(transactionType === "Dispensed"
    ? "Not enough unexpired stock is available." : "Batch quantities do not match current stock.");
  db.prepare("UPDATE inventory_items SET current_stock=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(runningStock, item.id);
  return runningStock;
});

router.post("/inventory/stock-out", (req, res) => {
  try {
    const type = ["Damaged", "Expired", "Adjustment"].includes(req.body.reason)
      ? req.body.reason : "Stock Out";
    res.status(201).json({ new_stock: releaseInventory(req.body, type), message: "Stock release recorded." });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get("/inventory/transactions", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page,10)||1);
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit,10)||20));
  const conditions = ["1=1"], params = [];
  if (req.query.search) { conditions.push("(i.item_name LIKE ? OR i.item_code LIKE ? OR p.first_name||' '||p.last_name LIKE ?)"); params.push(`%${req.query.search}%`,`%${req.query.search}%`,`%${req.query.search}%`); }
  if (req.query.category) { conditions.push("i.category=?"); params.push(req.query.category); }
  if (req.query.type) { conditions.push("t.transaction_type=?"); params.push(req.query.type); }
  if (req.query.from) { conditions.push("t.transaction_date>=?"); params.push(req.query.from); }
  if (req.query.to) { conditions.push("t.transaction_date<?"); params.push(`${req.query.to}T23:59:59`); }
  const where = conditions.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) total FROM inventory_transactions t
    JOIN inventory_items i ON i.id=t.inventory_item_id LEFT JOIN patients p ON p.id=t.patient_id
    WHERE ${where}`).get(...params).total;
  const rows = db.prepare(`SELECT t.*,i.item_code,i.item_name,i.category,
    TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')) patient_name
    FROM inventory_transactions t JOIN inventory_items i ON i.id=t.inventory_item_id
    LEFT JOIN patients p ON p.id=t.patient_id WHERE ${where}
    ORDER BY t.transaction_date DESC,t.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page-1)*limit);
  res.json({ rows, total, page, pages: Math.ceil(total/limit) });
});

router.get("/inventory/reports/monthly", (req, res) => {
  const period = /^\d{4}-\d{2}$/.test(req.query.period || "") ? req.query.period : new Date().toISOString().slice(0,7);
  const start = `${period}-01`;
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0,10);
  const rows = db.prepare(`SELECT i.id,i.item_code,i.item_name,i.category,i.unit_cost,
    i.minimum_stock_level,i.current_stock ending_stock,
    i.current_stock-COALESCE(SUM(CASE WHEN t.transaction_date>=? AND t.transaction_date<?
      THEN CASE WHEN t.transaction_type IN ('Stock In','Adjustment In') THEN t.quantity ELSE -t.quantity END ELSE 0 END),0) beginning_stock,
    COALESCE(SUM(CASE WHEN t.transaction_type='Stock In' AND t.transaction_date>=? AND t.transaction_date<? THEN t.quantity ELSE 0 END),0) stock_in,
    COALESCE(SUM(CASE WHEN t.transaction_type NOT IN ('Stock In','Adjustment In') AND t.transaction_date>=? AND t.transaction_date<? THEN t.quantity ELSE 0 END),0) stock_out,
    COALESCE(SUM(CASE WHEN t.transaction_type='Dispensed' AND t.transaction_date>=? AND t.transaction_date<? THEN t.quantity ELSE 0 END),0) dispensed,
    COALESCE(SUM(CASE WHEN t.transaction_type='Damaged' AND t.transaction_date>=? AND t.transaction_date<? THEN t.quantity ELSE 0 END),0) damaged,
    COALESCE(SUM(CASE WHEN t.transaction_type='Expired' AND t.transaction_date>=? AND t.transaction_date<? THEN t.quantity ELSE 0 END),0) expired
    FROM inventory_items i LEFT JOIN inventory_transactions t ON t.inventory_item_id=i.id
    GROUP BY i.id ORDER BY i.item_name`).all(start,end,start,end,start,end,start,end,start,end,start,end)
    .map(withInventoryStatus).map((r) => ({ ...r, ending_value: r.ending_stock*r.unit_cost }));
  res.json({ period, rows, totals: {
    items: rows.length, stockIn: rows.reduce((s,r)=>s+r.stock_in,0),
    stockOut: rows.reduce((s,r)=>s+r.stock_out,0), dispensed: rows.reduce((s,r)=>s+r.dispensed,0),
    damaged: rows.reduce((s,r)=>s+r.damaged,0), expired: rows.reduce((s,r)=>s+r.expired,0),
    value: rows.reduce((s,r)=>s+r.ending_value,0),
  }});
});

router.post("/prescriptions/:id/dispense", (req, res) => {
  try {
    const prescription = db.prepare("SELECT * FROM prescriptions WHERE id=?").get(req.params.id);
    if (!prescription) return res.status(404).json({ message: "Prescription not found." });
    const item = db.prepare("SELECT * FROM prescription_items WHERE id=? AND prescription_id=?")
      .get(req.body.prescription_item_id, prescription.id);
    if (!item) return res.status(400).json({ message: "Prescription item not found." });
    const quantity = parseInt(req.body.quantity,10);
    const save = db.transaction(() => {
      const newStock = releaseInventory({
        ...req.body, quantity, patient_id: prescription.patient_id,
        consultation_case_id: prescription.consultation_case_id,
        prescription_id: prescription.id, reason: "Dispensed to Patient",
      }, "Dispensed");
      const dispensing = db.prepare(`INSERT INTO prescription_dispensing
        (prescription_id,prescription_item_id,inventory_item_id,quantity_dispensed,dispensed_by)
        VALUES (?,?,?,?,?)`).run(prescription.id,item.id,req.body.inventory_item_id,quantity,text(req.body.performed_by));
      const inventoryItem = db.prepare("SELECT item_name,unit_cost FROM inventory_items WHERE id=?")
        .get(req.body.inventory_item_id);
      const invoice = db.prepare("SELECT id FROM invoices WHERE consultation_case_id=?")
        .get(prescription.consultation_case_id);
      if (invoice) {
        upsertInvoiceItem({
          invoice_id: invoice.id,
          patient_id: prescription.patient_id,
          consultation_case_id: prescription.consultation_case_id,
          source_type: "medicine",
          source_id: dispensing.lastInsertRowid,
          category: "Medicine",
          description: inventoryItem.item_name,
          quantity,
          unit_price: inventoryItem.unit_cost,
          discount: 0,
          remarks: `Prescription ${prescription.prescription_number}`,
        });
        recalculateInvoice(invoice.id);
      }
      return newStock;
    });
    res.status(201).json({ new_stock: save(), message: "Medicine dispensed and inventory updated." });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

/* =========================================================
   DASHBOARD
========================================================= */

router.get("/dashboard", (req, res) => {
  try {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const totalPatients = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM patients
        WHERE is_archived = 0
      `)
      .get().count;

    const consultationsToday = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM consultation_cases
        WHERE consultation_date LIKE ?
      `)
      .get(`${today}%`).count;

    const pendingLabs = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM laboratory_requests
        WHERE status IN ('Requested', 'Pending')
      `)
      .get().count;

    const incomeToday = db
      .prepare(`
        SELECT COALESCE(
          SUM(paid_amount),
          0
        ) AS income
        FROM invoices
        WHERE invoice_date LIKE ?
      `)
      .get(`${today}%`).income;

    const inventory = db.prepare(`
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN current_stock <= minimum_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) AS low_stock,
        SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock,
        COALESCE(SUM(current_stock * unit_cost), 0) AS total_value
      FROM inventory_items
      WHERE is_archived = 0
    `).get();
    const nearExpiration = db.prepare(`
      SELECT COUNT(DISTINCT inventory_item_id) AS count
      FROM inventory_batches
      WHERE quantity > 0 AND expiration_date BETWEEN ? AND date(?, '+90 days')
    `).get(today, today).count;

    const recentPatients = db
      .prepare(`
        SELECT
          id,
          patient_number,
          first_name,
          last_name,
          contact_number
        FROM patients
        WHERE is_archived = 0
        ORDER BY created_at DESC
        LIMIT 5
      `)
      .all();

    const followUps = db
      .prepare(`
        SELECT
          c.case_number,
          c.follow_up_date,
          p.first_name,
          p.last_name
        FROM consultation_cases c
        JOIN patients p
          ON p.id = c.patient_id
        WHERE c.follow_up_date >= ?
        ORDER BY c.follow_up_date
        LIMIT 5
      `)
      .all(today);

    res.json({
      totalPatients,
      consultationsToday,
      pendingLabs,
      incomeToday,
      inventory: {
        ...inventory,
        near_expiration: nearExpiration,
      },
      recentPatients,
      followUps,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================================================
   PATIENTS
========================================================= */

router.get("/patients", (req, res) => {
  try {
    const search = `%${(
      req.query.search || ""
    ).trim()}%`;

    const archived =
      req.query.archived === "true" ? 1 : 0;

    const rows = db
      .prepare(`
        SELECT
          p.*,
          (
            SELECT MAX(
              consultation_date
            )
            FROM consultation_cases c
            WHERE c.patient_id = p.id
          ) AS last_visit
        FROM patients p
        WHERE p.is_archived = ?
          AND (p.patient_number != 'OPD-WALK-IN' OR ? = 1)
          AND (
            p.first_name || ' ' ||
            p.last_name LIKE ?
            OR p.patient_number LIKE ?
            OR p.contact_number LIKE ?
          )
        ORDER BY
          p.last_name,
          p.first_name
      `)
      .all(
        archived,
        req.query.include_walk_in === "true" ? 1 : 0,
        search,
        search,
        search,
      );

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.get("/patients/:id", (req, res) => {
  try {
    const row = db
      .prepare(`
        SELECT *
        FROM patients
        WHERE id = ?
      `)
      .get(req.params.id);

    if (!row) {
      return res.status(404).json({
        message: "Patient not found.",
      });
    }

    res.json(row);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.post("/patients", (req, res) => {
  try {
    const {
      first_name,
      last_name,
      ...details
    } = req.body;

    if (!normalizePatientName(first_name) || !normalizePatientName(last_name)) {
      return res.status(400).json({
        message:
          "First and last name are required.",
      });
    }

    if (details.birth_date) {
      const duplicate = db.prepare(`SELECT id, patient_number, first_name, middle_name, last_name
        FROM patients WHERE birth_date = ?`).all(details.birth_date).find((patient) =>
        normalizePatientName(patient.first_name) === normalizePatientName(first_name) &&
        normalizePatientName(patient.middle_name) === normalizePatientName(details.middle_name) &&
        normalizePatientName(patient.last_name) === normalizePatientName(last_name));
      if (duplicate) {
        return res.status(409).json({
          message: `A patient with this full name and birthdate already exists (${duplicate.patient_number}). Please use the existing patient record or correct the details.`,
          patient_id: duplicate.id,
        });
      }
    }

    const patient_number = nextNumber(
      "P",
      "patients",
      "patient_number",
    );

    const detailFields = Object.keys(
      details,
    ).filter(
      (key) =>
        !["id", "patient_number"].includes(
          key,
        ),
    );

    const fields = [
      "patient_number",
      "first_name",
      "last_name",
      ...detailFields,
    ];

    const values = [
      patient_number,
      first_name.trim(),
      last_name.trim(),
      ...detailFields.map(
        (key) => details[key] || null,
      ),
    ];

    const result = db
      .prepare(`
        INSERT INTO patients (
          ${fields.join(", ")}
        )
        VALUES (
          ${fields
            .map(() => "?")
            .join(", ")}
        )
      `)
      .run(...values);

    res.status(201).json({
      id: result.lastInsertRowid,
      patient_number,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});


router.put("/patients/:id", (req, res) => {
  try {
    const patientId = Number(req.params.id);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({
        message: "Invalid patient ID.",
      });
    }

    const existingPatient = db
      .prepare(`
        SELECT *
        FROM patients
        WHERE id = ?
      `)
      .get(patientId);

    if (!existingPatient) {
      return res.status(404).json({
        message: "Patient not found.",
      });
    }

    const allowedFields = [
      "first_name",
      "middle_name",
      "last_name",
      "birth_date",
      "civil_status",
      "occupation",
      "contact_number",
      "address",
      "blood_type",
      "allergies",
      "existing_illnesses",
      "previous_surgeries",
      "family_history",
      "ob_history",
      "pregnancy_history",
      "emergency_contact_name",
      "emergency_contact_number",
      "notes",
    ];

    const fields = allowedFields.filter(
      (field) => req.body[field] !== undefined,
    );

    if (!fields.length) {
      return res.status(400).json({
        message: "No valid patient fields supplied.",
      });
    }

    const firstName =
      req.body.first_name !== undefined
        ? String(req.body.first_name || "").trim()
        : String(existingPatient.first_name || "").trim();

    const lastName =
      req.body.last_name !== undefined
        ? String(req.body.last_name || "").trim()
        : String(existingPatient.last_name || "").trim();

    if (!firstName || !lastName) {
      return res.status(400).json({
        message: "First and last name are required.",
      });
    }

    const values = fields.map((field) => {
      if (field === "first_name") {
        return firstName;
      }

      if (field === "last_name") {
        return lastName;
      }

      const value = req.body[field];

      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return null;
      }

      return typeof value === "string"
        ? value.trim()
        : value;
    });

    const result = db
      .prepare(`
        UPDATE patients
        SET ${fields
          .map((field) => `${field} = ?`)
          .join(", ")}
        WHERE id = ?
      `)
      .run(...values, patientId);

    if (!result.changes) {
      return res.status(404).json({
        message: "Patient not found.",
      });
    }

    const updatedPatient = db
      .prepare(`
        SELECT *
        FROM patients
        WHERE id = ?
      `)
      .get(patientId);

    res.json({
      message: "Patient updated successfully.",
      patient: updatedPatient,
    });
  } catch (err) {
    console.error("Update patient error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.delete("/patients/:id", (req, res) => {
  try {
    const patientId = Number(req.params.id);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return res.status(400).json({
        message: "Invalid patient ID.",
      });
    }

    const patient = db
      .prepare("SELECT id FROM patients WHERE id = ?")
      .get(patientId);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found.",
      });
    }

    if (db.prepare("SELECT id FROM invoices WHERE patient_id=? LIMIT 1").get(patientId))
      return res.status(409).json({message:"This patient has permanent billing history. Archive the patient instead of deleting."});
    const removePatient = db.transaction(() => {
      const ids = (table, column) =>
        db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`)
          .all(patientId)
          .map((row) => row.id);

      const caseIds = ids("consultation_cases", "patient_id");
      const invoiceIds = ids("invoices", "patient_id");
      const prescriptionIds = ids("prescriptions", "patient_id");
      const laboratoryIds = ids("laboratory_requests", "patient_id");

      const removeByIds = (table, column, values) => {
        if (!values.length) return;
        const placeholders = values.map(() => "?").join(",");
        db.prepare(
          `DELETE FROM ${table} WHERE ${column} IN (${placeholders})`,
        ).run(...values);
      };

      removeByIds("prescription_dispensing", "prescription_id", prescriptionIds);
      removeByIds("prescription_items", "prescription_id", prescriptionIds);
      removeByIds("laboratory_request_items", "laboratory_request_id", laboratoryIds);
      removeByIds("billing_adjustments", "invoice_id", invoiceIds);
      removeByIds("invoice_items", "invoice_id", invoiceIds);
      removeByIds("payments", "invoice_id", invoiceIds);

      db.prepare("DELETE FROM patient_charges WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM inventory_transactions WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM prescriptions WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM laboratory_requests WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM prenatal_records WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM invoices WHERE patient_id = ?").run(patientId);

      removeByIds("case_diagnoses", "consultation_case_id", caseIds);
      db.prepare("DELETE FROM consultation_cases WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM consultations WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM appointments WHERE patient_id = ?").run(patientId);
      db.prepare("DELETE FROM patients WHERE id = ?").run(patientId);
    });

    removePatient();

    res.json({
      message:
        "Patient and all linked clinical, inventory, and billing transactions were permanently deleted.",
    });
  } catch (err) {
    console.error("Delete patient error:", err);

    res.status(500).json({
      message:
        "Unable to permanently delete the patient and all linked records.",
      error: err.message,
    });
  }
});

router.patch(
  "/patients/:id/archive",
  (req, res) => {
    try {
      const result = db
        .prepare(`
          UPDATE patients
          SET is_archived = 1
          WHERE id = ?
        `)
        .run(req.params.id);

      if (!result.changes) {
        return res.status(404).json({
          message: "Patient not found.",
        });
      }

      res.json({
        message: "Patient archived.",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

router.get(
  "/patients/:id/cases",
  (req, res) => {
    try {
      const rows = db
        .prepare(`
          SELECT
            c.*,
            COALESCE(
              c.service_type,
              a.service
            ) AS display_service_type
          FROM consultation_cases c
          LEFT JOIN appointments a
            ON a.id = c.appointment_id
          WHERE c.patient_id = ?
          ORDER BY
            c.consultation_date DESC
        `)
        .all(req.params.id);

      res.json(rows);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

/* =========================================================
   CONSULTATION CASES
========================================================= */

router.post("/cases", (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      appointment_id,
      service_id,
      service_type,
      service_fee,
      consultation_date,
      diagnoses = [],
      chief_complaint,
      history_present_illness,
      blood_pressure,
      temperature_c,
      weight_kg,
      height_cm,
      treatment,
      doctor_notes,
      follow_up_date,
      case_status = "Open",
    } = req.body;

    if (!patient_id || !consultation_date) {
      return res.status(400).json({
        message:
          "Patient and consultation date are required.",
      });
    }

    const patient = db
      .prepare(`
        SELECT id
        FROM patients
        WHERE id = ?
          AND is_archived = 0
      `)
      .get(patient_id);

    if (!patient) {
      return res.status(400).json({
        message:
          "Select an active patient.",
      });
    }

    let appointment = null;

    if (appointment_id) {
      appointment = db
        .prepare(`
          SELECT
            id,
            patient_id,
            service,
            service_id
          FROM appointments
          WHERE id = ?
        `)
        .get(appointment_id);

      if (!appointment) {
        return res.status(400).json({
          message:
            "The selected appointment does not exist.",
        });
      }

      if (
        Number(appointment.patient_id) !==
        Number(patient_id)
      ) {
        return res.status(400).json({
          message:
            "The selected appointment does not belong to this patient.",
        });
      }
    }

    const resolvedServiceId = Number(service_id || appointment?.service_id);
    const configuredService = db.prepare("SELECT * FROM service_types WHERE id=? AND is_active=1").get(resolvedServiceId);
    if (!configuredService) return res.status(400).json({ message: "Select an active service." });
    const resolvedServiceType = configuredService.name;

    const create = db.transaction(() => {
      const case_number = nextNumber(
        "CASE",
        "consultation_cases",
        "case_number",
      );

      const result = db
        .prepare(`
          INSERT INTO consultation_cases (
            case_number,
            patient_id,
            doctor_id,
            appointment_id,
            service_id,
            service_type,
            service_name,
            service_price,
            consultation_date,
            chief_complaint,
            history_present_illness,
            blood_pressure,
            temperature_c,
            weight_kg,
            height_cm,
            treatment,
            doctor_notes,
            follow_up_date,
            case_status
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `)
        .run(
          case_number,
          patient_id,
          doctor_id || null,
          appointment_id || null,
          configuredService.id,
          resolvedServiceType,
          configuredService.name,
          configuredService.default_fee,
          consultation_date,
          chief_complaint || null,
          history_present_illness || null,
          blood_pressure || null,
          temperature_c || null,
          weight_kg || null,
          height_cm || null,
          treatment || null,
          doctor_notes || null,
          follow_up_date || null,
          case_status || "Open",
        );

      const addDiagnosis = db.prepare(`
        INSERT OR IGNORE INTO diagnoses (
          diagnosis_name
        )
        VALUES (?)
      `);

      const findDiagnosis = db.prepare(`
        SELECT id
        FROM diagnoses
        WHERE diagnosis_name = ?
      `);

      const linkDiagnosis = db.prepare(`
        INSERT INTO case_diagnoses (
          consultation_case_id,
          diagnosis_id,
          is_primary
        )
        VALUES (?, ?, ?)
      `);

      diagnoses
        .map((name) =>
          String(name || "").trim(),
        )
        .filter(Boolean)
        .forEach((name, index) => {
          addDiagnosis.run(name);

          const diagnosis =
            findDiagnosis.get(name);

          linkDiagnosis.run(
            result.lastInsertRowid,
            diagnosis.id,
            index === 0 ? 1 : 0,
          );
        });

      const invoiceResult = db.prepare(`
        INSERT INTO invoices (
          invoice_number,
          patient_id,
          consultation_case_id,
          appointment_id,
          invoice_date,
          payment_status,
          billing_status,
          created_by
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          'Unpaid',
          'Draft',
          ?
        )
      `).run(
        `INV-${case_number.replace(
          "CASE-",
          "",
        )}`,
        patient_id,
        result.lastInsertRowid,
        appointment_id || null,
        consultation_date,
        doctor_id ? String(doctor_id) : null,
      );

      upsertInvoiceItem({
          invoice_id: invoiceResult.lastInsertRowid,
          patient_id,
          consultation_case_id: result.lastInsertRowid,
          source_type: "consultation_service",
          source_id: configuredService.id,
          category: "Service",
          description: configuredService.name,
          quantity: 1,
          unit_price: configuredService.default_fee,
          discount: 0,
      });
      recalculateInvoice(invoiceResult.lastInsertRowid);
      if (appointment_id) db.prepare("UPDATE appointments SET status='Completed',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(appointment_id);

      if (/prenatal/i.test(resolvedServiceType) && !hasPermission(req.user, "prenatal", "create")) throw new Error("Prenatal creation permission is required.");
      const prenatalVisit = /prenatal/i.test(resolvedServiceType) ? savePrenatalVisit(db, {
        ...req.body, consultation_case_id: Number(result.lastInsertRowid), visit_date: consultation_date,
        service_type: resolvedServiceType, doctor_id: req.user.id,
        assessment: diagnoses.join(", "), notes: req.body.prenatal_notes || doctor_notes || null,
        next_visit_date: req.body.next_prenatal_visit || follow_up_date || null,
      }) : null;

      return {
        id: result.lastInsertRowid,
        case_number,
        appointment_id:
          appointment_id || null,
        service_type:
          resolvedServiceType,
        service_id: configuredService.id,
        service_name: configuredService.name,
        service_price: configuredService.default_fee,
        invoice_id: invoiceResult.lastInsertRowid,
        pregnancy_id: prenatalVisit?.pregnancy_id,
        prenatal_record_id: prenatalVisit?.id,
      };
    });

    res.status(201).json(create());
  } catch (err) {
    console.error(err);

    res.status(err.status || 500).json({
      message: err.message,
    });
  }
});

router.get("/cases/:id", (req, res) => {
  try {
    const record = db
      .prepare(`
        SELECT
          c.*,

          a.service AS appointment_service,

          COALESCE(
            c.service_type,
            a.service
          ) AS display_service_type,

          p.patient_number,
          p.first_name,
          p.middle_name,
          p.last_name,
          p.birth_date,
          p.address,
          p.contact_number,

          COALESCE(
            u.fullname,
            (
              SELECT doctor_name
              FROM settings
              WHERE id = 1
            ),
            'Attending Physician'
          ) AS doctor_name,

          COALESCE(
            (
              SELECT clinic_name
              FROM settings
              WHERE id = 1
            ),
            'OB-GYN Clinic'
          ) AS clinic_name,

          COALESCE(
            (
              SELECT clinic_address
              FROM settings
              WHERE id = 1
            ),
            ''
          ) AS clinic_address

        FROM consultation_cases c

        JOIN patients p
          ON p.id = c.patient_id

        LEFT JOIN users u
          ON u.id = c.doctor_id

        LEFT JOIN appointments a
          ON a.id = c.appointment_id

        WHERE c.id = ?
      `)
      .get(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Case not found.",
      });
    }

    /*
     * Make service_type available under the
     * exact field name expected by the frontend.
     */
    record.service_type =
      record.service_type ||
      record.appointment_service ||
      null;

    record.diagnoses = db
      .prepare(`
        SELECT
          d.*,
          cd.is_primary
        FROM diagnoses d

        JOIN case_diagnoses cd
          ON cd.diagnosis_id = d.id

        WHERE cd.consultation_case_id = ?

        ORDER BY
          cd.is_primary DESC,
          d.diagnosis_name
      `)
      .all(record.id);

    const prescriptionItems =
      db.prepare(`
        SELECT *
        FROM prescription_items
        WHERE prescription_id = ?
        ORDER BY id
      `);

    record.prescriptions = db
      .prepare(`
        SELECT
          pr.*,
          c.case_number
        FROM prescriptions pr

        JOIN consultation_cases c
          ON c.id =
            pr.consultation_case_id

        WHERE pr.consultation_case_id = ?

        ORDER BY pr.id DESC
      `)
      .all(record.id)
      .map((item) => ({
        ...item,
        items: prescriptionItems.all(
          item.id,
        ),
      }));

    const labItems = db.prepare(`
      SELECT *
      FROM laboratory_request_items
      WHERE laboratory_request_id = ?
      ORDER BY id
    `);

    record.laboratory_requests = db
      .prepare(`
        SELECT
          lr.*,
          c.case_number
        FROM laboratory_requests lr

        JOIN consultation_cases c
          ON c.id =
            lr.consultation_case_id

        WHERE lr.consultation_case_id = ?

        ORDER BY lr.id DESC
      `)
      .all(record.id)
      .map((item) => ({
        ...item,
        items: labItems.all(item.id),
      }));

    record.prenatal_record = db.prepare("SELECT * FROM prenatal_records WHERE consultation_case_id = ? ORDER BY id DESC LIMIT 1").get(record.id) || null;

    record.invoice = db
      .prepare(`
        SELECT *
        FROM invoices
        WHERE consultation_case_id = ?
      `)
      .get(record.id);

    res.json(record);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.put("/cases/:id/lab-results/:itemId", (req, res) => {
  if (!hasPermission(req.user, "laboratory", "edit")) {
    return res.status(403).json({ message: "Only Admin and Doctor accounts can record lab results." });
  }
  const caseId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const result = text(req.body.result);
  const resultDate = text(req.body.result_date);
  if (!Number.isInteger(caseId) || caseId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ message: "Invalid consultation or laboratory test." });
  }
  if (!result || !resultDate || !/^\d{4}-\d{2}-\d{2}$/.test(resultDate) ||
      !Number.isFinite(Date.parse(resultDate)) || new Date(resultDate).toISOString().slice(0, 10) !== resultDate) {
    return res.status(400).json({ message: "Enter the laboratory result and a valid result date." });
  }
  try {
    const item = db.prepare(`SELECT i.* FROM laboratory_request_items i
      JOIN laboratory_requests r ON r.id = i.laboratory_request_id
      WHERE i.id = ? AND r.consultation_case_id = ?`).get(itemId, caseId);
    if (!item) return res.status(404).json({ message: "Laboratory test not found for this consultation." });
    db.prepare(`UPDATE laboratory_request_items
      SET result = ?, result_date = ?, status = 'Completed' WHERE id = ?`).run(result, resultDate, itemId);
    res.json(db.prepare("SELECT * FROM laboratory_request_items WHERE id = ?").get(itemId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/cases/:id", (req, res) => {
  try {
    if (req.body.lab_results !== undefined && typeof req.body.lab_results !== "string") {
      return res.status(400).json({ message: "Lab results must be text." });
    }
    if (!hasPermission(req.user, "consultations", "edit") && !(Object.keys(req.body).length === 1 && Object.hasOwn(req.body, "lab_results") && hasPermission(req.user, "laboratory", "edit"))) {
      return res.status(403).json({ message: "Only Admin and Doctor accounts can edit consultations." });
    }
    if (req.body.diagnoses !== undefined && (!Array.isArray(req.body.diagnoses) || req.body.diagnoses.some((name) => typeof name !== "string"))) {
      return res.status(400).json({ message: "Diagnoses must be a list of names." });
    }
    const allowed = [
      "appointment_id",
      "service_type",
      "consultation_date",
      "chief_complaint",
      "history_present_illness",
      "blood_pressure",
      "temperature_c",
      "weight_kg",
      "height_cm",
      "treatment",
      "doctor_notes",
      "lab_results",
      "follow_up_date",
      "case_status",
    ];

    const fields = Object.keys(
      req.body,
    ).filter((field) =>
      allowed.includes(field),
    );

    if (!fields.length) {
      return res.status(400).json({
        message:
          "No valid case fields supplied.",
      });
    }

    const existingCase = db
      .prepare(`
        SELECT *
        FROM consultation_cases
        WHERE id = ?
      `)
      .get(req.params.id);

    if (!existingCase) {
      return res.status(404).json({
        message: "Case not found.",
      });
    }

    const appointmentId =
      req.body.appointment_id !== undefined
        ? req.body.appointment_id
        : existingCase.appointment_id;

    if (appointmentId) {
      const appointment = db
        .prepare(`
          SELECT
            id,
            patient_id,
            service
          FROM appointments
          WHERE id = ?
        `)
        .get(appointmentId);

      if (!appointment) {
        return res.status(400).json({
          message:
            "The selected appointment does not exist.",
        });
      }

      if (
        Number(appointment.patient_id) !==
        Number(existingCase.patient_id)
      ) {
        return res.status(400).json({
          message:
            "The selected appointment does not belong to this patient.",
        });
      }
    }

    const values = fields.map((field) => {
      const value = req.body[field];
      if (field === "lab_results") return value.trim();

      if (
        value === undefined ||
        value === ""
      ) {
        return null;
      }

      return value;
    });

    const result = db.transaction(() => {
      const updated = db.prepare(`
        UPDATE consultation_cases
        SET ${fields
          .map(
            (field) =>
              `${field} = ?`,
          )
          .join(", ")}
        WHERE id = ?
      `)
      .run(...values, req.params.id);
      if (req.body.diagnoses !== undefined) {
        db.prepare("DELETE FROM case_diagnoses WHERE consultation_case_id = ?").run(existingCase.id);
        const names = [...new Set(req.body.diagnoses.map((name) => name.trim()).filter(Boolean))];
        names.forEach((name, index) => {
          db.prepare("INSERT OR IGNORE INTO diagnoses (diagnosis_name) VALUES (?)").run(name);
          const diagnosis = db.prepare("SELECT id FROM diagnoses WHERE diagnosis_name = ?").get(name);
          db.prepare("INSERT INTO case_diagnoses (consultation_case_id, diagnosis_id, is_primary) VALUES (?, ?, ?)")
            .run(existingCase.id, diagnosis.id, index === 0 ? 1 : 0);
        });
      }
      return updated;
    })();

    if (!result.changes) {
      return res.status(404).json({
        message: "Case not found.",
      });
    }

    if (fields.includes("service_type")) {
      const invoice = db.prepare("SELECT id FROM invoices WHERE consultation_case_id=?").get(req.params.id);
      const service = db.prepare("SELECT * FROM service_types WHERE name=? COLLATE NOCASE")
        .get(req.body.service_type);
      if (invoice && service) {
        upsertInvoiceItem({
          invoice_id: invoice.id,
          patient_id: existingCase.patient_id,
          consultation_case_id: existingCase.id,
          source_type: "consultation_service",
          source_id: service.id,
          category: "Service",
          description: service.name,
          quantity: 1,
          unit_price: req.body.service_fee ?? service.default_fee,
          discount: req.body.service_discount || 0,
        });
        recalculateInvoice(invoice.id);
      }
    }

    res.json({
      message: "Case updated.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================================================
   BILLING AND PAYMENTS
========================================================= */

router.get("/invoices/:id/details", (req, res) => {
  let invoice=db.prepare(`SELECT i.*,p.patient_number,p.first_name,p.middle_name,
    p.last_name,p.address,p.contact_number,p.birth_date,c.case_number,
    c.consultation_date,COALESCE(c.service_type,a.service) service_type,
    u.fullname doctor_name,a.id appointment_id,
    s.clinic_name,s.clinic_address
    FROM invoices i JOIN patients p ON p.id=i.patient_id
    LEFT JOIN consultation_cases c ON c.id=i.consultation_case_id
    LEFT JOIN users u ON u.id=c.doctor_id LEFT JOIN appointments a ON a.id=c.appointment_id
    LEFT JOIN settings s ON s.id=1 WHERE i.id=?`).get(req.params.id);
  if(!invoice)return res.status(404).json({message:"Invoice not found."});

  invoice.items=db.prepare(`SELECT *,unit_price_cents/100.0 unit_price,
    subtotal_cents/100.0 item_subtotal,discount_cents/100.0 item_discount,
    final_amount_cents/100.0 final_amount FROM invoice_items
    WHERE invoice_id=? AND is_void=0 ORDER BY id`).all(invoice.id);
  invoice.payments=db.prepare("SELECT * FROM payments WHERE invoice_id=? ORDER BY payment_date,id").all(invoice.id);
  invoice.adjustments=db.prepare(`SELECT ba.*,ba.amount_cents/100.0 amount,
    ii.description item_description FROM billing_adjustments ba
    LEFT JOIN invoice_items ii ON ii.id=ba.invoice_item_id
    WHERE ba.invoice_id=? ORDER BY ba.created_at`).all(invoice.id);
  invoice.patient_name=[invoice.first_name,invoice.middle_name,invoice.last_name].filter(Boolean).join(" ");
  invoice.voided_items=db.prepare(`SELECT *,unit_price_cents/100.0 unit_price,discount_cents/100.0 item_discount,
    final_amount_cents/100.0 final_amount FROM invoice_items WHERE invoice_id=? AND is_void=1 ORDER BY id`).all(invoice.id);
  invoice.audit=db.prepare("SELECT * FROM billing_audit WHERE invoice_id=? ORDER BY id DESC").all(invoice.id);
  res.json(billingIdentity(invoice));
});

router.post("/invoices/:id/items", (req,res)=>{
  try{
    const invoice=db.prepare("SELECT * FROM invoices WHERE id=?").get(req.params.id);
    if(!invoice)return res.status(404).json({message:"Invoice not found."});
    if(invoice.billing_status==="Finalized")return res.status(409).json({message:"Finalized invoices require an adjustment."});
    if(!text(req.body.description)||!text(req.body.category))
      return res.status(400).json({message:"Description and category are required."});
    const id=upsertInvoiceItem({invoice_id:invoice.id,patient_id:invoice.patient_id,
      consultation_case_id:invoice.consultation_case_id,source_type:"manual_charge",
      source_id:null,category:req.body.category,description:req.body.description,
      quantity:req.body.quantity,unit_price:req.body.unit_price,discount:req.body.discount,
      remarks:req.body.remarks});
    res.status(201).json({id,invoice:recalculateInvoice(invoice.id),message:"Charge added."});
  }catch(error){res.status(400).json({message:error.message});}
});

router.patch("/invoices/:invoiceId/items/:itemId/void", (req,res)=>{
  const invoice=db.prepare("SELECT * FROM invoices WHERE id=?").get(req.params.invoiceId);
  if(!invoice)return res.status(404).json({message:"Invoice not found."});
  if(invoice.billing_status==="Finalized")return res.status(409).json({message:"Use a billing adjustment for finalized invoices."});
  const result=db.prepare("UPDATE invoice_items SET is_void=1,remarks=COALESCE(remarks,'')||? WHERE id=? AND invoice_id=?")
    .run(` | Voided: ${text(req.body.reason)||"Correction"}`,req.params.itemId,invoice.id);
  if(!result.changes)return res.status(404).json({message:"Invoice item not found."});
  res.json({invoice:recalculateInvoice(invoice.id),message:"Draft charge removed."});
});

router.post("/invoices/:id/adjustments", (req,res)=>{
  const invoice=db.prepare("SELECT * FROM invoices WHERE id=?").get(req.params.id);
  const adjustmentType=req.body.adjustment_type;
  const value=cents(req.body.amount);
  if(!invoice)return res.status(404).json({message:"Invoice not found."});
  if(!["Addition","Deduction"].includes(adjustmentType)||!value||!text(req.body.reason))
    return res.status(400).json({message:"Adjustment type, positive amount, and reason are required."});
  db.prepare(`INSERT INTO billing_adjustments
    (invoice_id,invoice_item_id,adjustment_type,amount_cents,reason,created_by)
    VALUES (?,?,?,?,?,?)`).run(invoice.id,req.body.invoice_item_id||null,
      adjustmentType,value,text(req.body.reason),text(req.body.created_by));
  res.status(201).json({invoice:recalculateInvoice(invoice.id),message:"Billing adjustment recorded."});
});

router.post("/invoices/:id/payments",(req,res)=>{
  try{
    const invoice=db.prepare("SELECT * FROM invoices WHERE id=?").get(req.params.id);
    const value=Number(req.body.amount);
    if(!invoice)return res.status(404).json({message:"Invoice not found."});
    if(!Number.isFinite(value)||value<=0)return res.status(400).json({message:"Enter a positive payment amount."});
    const receipt=`OR-${Date.now()}`;
    const record=db.transaction(()=>{
      db.prepare(`INSERT INTO payments
        (invoice_id,patient_id,payment_date,amount,payment_method,reference_number,
         receipt_number,received_by,remarks) VALUES (?,?,?,?,?,?,?,?,?)`).run(
        invoice.id,invoice.patient_id,text(req.body.payment_date)||new Date().toISOString(),
        value,text(req.body.payment_method)||"Cash",text(req.body.reference_number),
        receipt,text(req.body.received_by),text(req.body.remarks));
      db.prepare("UPDATE invoices SET paid_amount=paid_amount+? WHERE id=?").run(value,invoice.id);
      return recalculateInvoice(invoice.id);
    });
    res.status(201).json({receipt_number:receipt,invoice:record(),message:"Payment recorded."});
  }catch(error){res.status(400).json({message:error.message});}
});

router.post(
  "/billings/:caseId/payments",
  (req, res) => {
    try {
      const {
        amount,
        payment_method = "Cash",
      } = req.body;

      if (
        !Number(amount) ||
        Number(amount) <= 0
      ) {
        return res.status(400).json({
          message:
            "Enter a valid payment amount.",
        });
      }

      const invoice = db
        .prepare(`
          SELECT *
          FROM invoices
          WHERE consultation_case_id = ?
        `)
        .get(req.params.caseId);

      if (!invoice) {
        return res.status(404).json({
          message:
            "Billing transaction not found.",
        });
      }

      const add = db.transaction(() => {
        db.prepare(`
          INSERT INTO payments (
            invoice_id,
            payment_date,
            amount,
            payment_method
          )
          VALUES (
            ?,
            datetime('now'),
            ?,
            ?
          )
        `).run(
          invoice.id,
          amount,
          payment_method,
        );

        const paid =
          Number(invoice.paid_amount) +
          Number(amount);

        const total = Number(
          invoice.total_amount,
        );

        const status =
          total > 0 && paid >= total
            ? "Paid"
            : "Partial";

        db.prepare(`
          UPDATE invoices
          SET
            paid_amount = ?,
            payment_status = ?
          WHERE id = ?
        `).run(
          paid,
          status,
          invoice.id,
        );
      });

      add();

      res.status(201).json({
        message: "Payment recorded.",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

router.get("/billing-history", (req, res) => {
  const rows = db.prepare(`SELECT i.*, c.case_number, p.patient_number, p.first_name || ' ' || p.last_name AS patient_name FROM invoices i LEFT JOIN consultation_cases c ON c.id=i.consultation_case_id JOIN patients p ON p.id=i.patient_id ORDER BY i.id DESC`).all();
  res.json(rows.map(billingIdentity));
});

router.get("/billings", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT
          i.*,
          c.case_number,
          c.consultation_date,
          c.service_type,
          p.patient_number,
          p.first_name || ' ' ||
          p.last_name AS patient_name
        FROM invoices i

        LEFT JOIN consultation_cases c
          ON c.id =
            i.consultation_case_id

        JOIN patients p
          ON p.id = i.patient_id

        ORDER BY i.id DESC
      `)
      .all();

    res.json(rows.map(billingIdentity));
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.get("/patients/:id/billing-history", (req,res)=>{
  const rows=db.prepare(`SELECT i.*,c.case_number,c.consultation_date,c.service_type
    FROM invoices i LEFT JOIN consultation_cases c ON c.id=i.consultation_case_id
    WHERE i.patient_id=? ORDER BY i.invoice_date DESC,i.id DESC`).all(req.params.id);
  const summary=rows.reduce((s,i)=>{
    const total=Number(i.grand_total||i.total_amount||0),paid=Number(i.paid_amount||0);
    s.totalBilled+=total;s.totalPaid+=paid;s.outstanding+=Math.max(0,total-paid);
    if(total>paid)s.unpaidBills+=1;return s;
  },{totalBilled:0,totalPaid:0,outstanding:0,unpaidBills:0});
  res.json({rows,summary});
});

/* =========================================================
   REPORTS
========================================================= */

router.get("/reports/summary", (req, res) => {
  try {
    const cases = db
      .prepare(`
        SELECT
          substr(
            consultation_date,
            1,
            10
          ) AS date,
          COUNT(*) AS consultations
        FROM consultation_cases
        GROUP BY substr(
          consultation_date,
          1,
          10
        )
        ORDER BY date DESC
        LIMIT 31
      `)
      .all();

    const income = db
      .prepare(`
        SELECT
          substr(
            invoice_date,
            1,
            7
          ) AS month,
          COALESCE(
            SUM(paid_amount),
            0
          ) AS income
        FROM invoices
        GROUP BY substr(
          invoice_date,
          1,
          7
        )
        ORDER BY month DESC
        LIMIT 12
      `)
      .all();

    const diagnoses = db
      .prepare(`
        SELECT
          d.diagnosis_name,
          COUNT(*) AS count
        FROM case_diagnoses cd

        JOIN diagnoses d
          ON d.id =
            cd.diagnosis_id

        GROUP BY d.id
        ORDER BY count DESC
        LIMIT 10
      `)
      .all();

    res.json({
      cases,
      income,
      diagnoses,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* =========================================================
   DATABASE BACKUPS
========================================================= */

const prenatalRecordsSelect = `
  SELECT
    pr.*,

    p.patient_number,
    p.first_name,
    p.middle_name,
    p.last_name,
    p.birth_date,
    p.contact_number,
    p.address,

    TRIM(
      p.first_name || ' ' ||
      COALESCE(p.middle_name || ' ', '') ||
      p.last_name
    ) AS patient_name

  FROM prenatal_records pr

  LEFT JOIN patients p
    ON p.id = pr.patient_id
`;

router.get("/prenatal-records", (req, res) => {
  try {
    const patientId = Number(
      req.query.patient_id,
    );

    const rows =
      Number.isInteger(patientId) &&
      patientId > 0
        ? db
            .prepare(`
              ${prenatalRecordsSelect}

              WHERE pr.patient_id = ?

              ORDER BY
                pr.visit_date DESC,
                pr.id DESC
            `)
            .all(patientId)
        : db
            .prepare(`
              ${prenatalRecordsSelect}

              ORDER BY
                pr.visit_date DESC,
                pr.id DESC
            `)
            .all();

    res.json(rows);
  } catch (err) {
    console.error(
      "Load prenatal records error:",
      err,
    );

    res.status(500).json({
      message:
        "Unable to load prenatal records.",
      error: err.message,
    });
  }
});

router.get(
  "/prenatal-records/:id",
  (req, res) => {
    try {
      const prenatalRecordId = Number(
        req.params.id,
      );

      if (
        !Number.isInteger(
          prenatalRecordId,
        ) ||
        prenatalRecordId <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid prenatal record ID.",
        });
      }

      const row = db
        .prepare(`
          ${prenatalRecordsSelect}

          WHERE pr.id = ?
        `)
        .get(prenatalRecordId);

      if (!row) {
        return res.status(404).json({
          message:
            "Prenatal record not found.",
        });
      }

      res.json(row);
    } catch (err) {
      console.error(
        "Load prenatal record error:",
        err,
      );

      res.status(500).json({
        message:
          "Unable to load prenatal record.",
        error: err.message,
      });
    }
  },
);

/* =========================================================
   GENERIC RESOURCES
========================================================= */

router.get("/appointments", (req,res)=>res.json(db.prepare("SELECT a.*, (SELECT c.id FROM consultation_cases c WHERE c.appointment_id=a.id AND c.patient_id=a.patient_id ORDER BY c.id DESC LIMIT 1) AS consultation_case_id FROM appointments a ORDER BY a.appointment_date DESC,a.id DESC").all()));
router.get("/appointments/:id", (req,res)=>{const row=db.prepare("SELECT * FROM appointments WHERE id=?").get(req.params.id);if(!row)return res.status(404).json({message:"Appointment not found."});res.json(row);});
const saveAppointment = (req,res,isUpdate=false) => {
  const service=db.prepare("SELECT * FROM service_types WHERE id=? AND is_active=1").get(req.body.service_id);
  if(!req.body.patient_id||!req.body.appointment_date||!service)return res.status(400).json({message:"Patient, date, and an active service are required."});
  if(isUpdate){const result=db.prepare(`UPDATE appointments SET patient_id=?,appointment_date=?,service_id=?,service=?,service_name=?,service_price=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.body.patient_id,req.body.appointment_date,service.id,service.name,service.name,service.default_fee,text(req.body.status)||"Scheduled",req.params.id);if(!result.changes)return res.status(404).json({message:"Appointment not found."});return res.json({message:"Appointment updated."});}
  const result=db.prepare(`INSERT INTO appointments (patient_id,appointment_date,service_id,service,service_name,service_price,status) VALUES (?,?,?,?,?,?,?)`).run(req.body.patient_id,req.body.appointment_date,service.id,service.name,service.name,service.default_fee,text(req.body.status)||"Scheduled");res.status(201).json({id:result.lastInsertRowid,message:"Appointment created."});
};
router.post("/appointments",(req,res)=>saveAppointment(req,res));
router.put("/appointments/:id",(req,res)=>saveAppointment(req,res,true));
router.delete("/appointments/:id",(req,res)=>{const linked=db.prepare("SELECT id FROM consultation_cases WHERE appointment_id=? LIMIT 1").get(req.params.id);if(linked)return res.status(409).json({message:"This appointment has a consultation and cannot be deleted."});const result=db.prepare("DELETE FROM appointments WHERE id=?").run(req.params.id);if(!result.changes)return res.status(404).json({message:"Appointment not found."});res.status(204).end();});

const resources = {
  consultations: {
    table: "consultations",
    required: [
      "patient_id",
      "consultation_date",
    ],
  },

  "prenatal-records": {
    table: "prenatal_records",
    required: [
      "patient_id",
      "visit_date",
    ],
  },

  invoices: {
    table: "invoices",
    required: [
      "invoice_number",
      "patient_id",
      "invoice_date",
    ],
  },

  payments: {
    table: "payments",
    required: [
      "invoice_id",
      "payment_date",
      "amount",
    ],
  },

  "report-exports": {
    table: "report_exports",
    required: ["report_name"],
  },

};

function assertFields(body, required) {
  return required.find(
    (field) =>
      body[field] === undefined ||
      body[field] === null ||
      body[field] === "",
  );
}

Object.entries(resources).forEach(
  ([routePath, resource]) => {
    router.get(
      `/${routePath}`,
      (req, res) => {
        try {
          const rows = db
            .prepare(`
              SELECT *
              FROM ${resource.table}
              ORDER BY id DESC
            `)
            .all();

          res.json(rows);
        } catch (err) {
          console.error(err);

          res.status(500).json({
            message: err.message,
          });
        }
      },
    );

    router.get(
      `/${routePath}/:id`,
      (req, res) => {
        try {
          const row = db
            .prepare(`
              SELECT *
              FROM ${resource.table}
              WHERE id = ?
            `)
            .get(req.params.id);

          if (!row) {
            return res
              .status(404)
              .json({
                message:
                  "Record not found.",
              });
          }

          res.json(row);
        } catch (err) {
          console.error(err);

          res.status(500).json({
            message: err.message,
          });
        }
      },
    );

    router.post(
      `/${routePath}`,
      (req, res) => {
        try {
          const missing = assertFields(
            req.body,
            resource.required,
          );

          if (missing) {
            return res
              .status(400)
              .json({
                message: `${missing} is required.`,
              });
          }

          const columns = new Set(db.prepare(`PRAGMA table_info(${resource.table})`).all().map(column => column.name));
          const fields = Object.keys(req.body);
          if (fields.some(field => !columns.has(field) || field === "id")) return res.status(400).json({ message: "Invalid record fields." });

          const values = fields.map(
            (field) => req.body[field],
          );

          const result = db
            .prepare(`
              INSERT INTO ${
                resource.table
              } (
                ${fields.join(", ")}
              )
              VALUES (
                ${fields
                  .map(() => "?")
                  .join(", ")}
              )
            `)
            .run(...values);

          res.status(201).json({
            id: result.lastInsertRowid,
            message: "Record created.",
          });
        } catch (err) {
          console.error(err);

          res.status(500).json({
            message: err.message,
          });
        }
      },
    );

    router.put(
      `/${routePath}/:id`,
      (req, res) => {
        try {
          const columns = new Set(db.prepare(`PRAGMA table_info(${resource.table})`).all().map(column => column.name));
          const fields = Object.keys(req.body);
          if (fields.some(field => !columns.has(field) || field === "id")) return res.status(400).json({ message: "Invalid record fields." });

          if (!fields.length) {
            return res
              .status(400)
              .json({
                message:
                  "No fields to update.",
              });
          }

          const result = db
            .prepare(`
              UPDATE ${resource.table}
              SET ${fields
                .map(
                  (field) =>
                    `${field} = ?`,
                )
                .join(", ")}
              WHERE id = ?
            `)
            .run(
              ...fields.map(
                (field) =>
                  req.body[field],
              ),
              req.params.id,
            );

          if (!result.changes) {
            return res
              .status(404)
              .json({
                message:
                  "Record not found.",
              });
          }

          res.json({
            message: "Record updated.",
          });
        } catch (err) {
          console.error(err);

          res.status(500).json({
            message: err.message,
          });
        }
      },
    );

    router.delete(
      `/${routePath}/:id`,
      (req, res) => {
        try {
          const result = db
            .prepare(`
              DELETE FROM ${resource.table}
              WHERE id = ?
            `)
            .run(req.params.id);

          if (!result.changes) {
            return res
              .status(404)
              .json({
                message:
                  "Record not found.",
              });
          }

          res.status(204).end();
        } catch (err) {
          console.error(err);

          res.status(500).json({
            message: err.message,
          });
        }
      },
    );
  },
);

/* =========================================================
   PRESCRIPTIONS
========================================================= */

router.get("/prescriptions", (req, res) => {
  try {
    const records =
      req.query.patient_id
        ? db
            .prepare(`
              SELECT
                p.*,
                pt.first_name || ' ' ||
                pt.last_name AS patient_name,
                c.case_number
              FROM prescriptions p

              JOIN patients pt
                ON pt.id = p.patient_id

              LEFT JOIN consultation_cases c
                ON c.id =
                  p.consultation_case_id

              WHERE p.patient_id = ?

              ORDER BY p.id DESC
            `)
            .all(
              req.query.patient_id,
            )
        : db
            .prepare(`
              SELECT
                p.*,
                pt.first_name || ' ' ||
                pt.last_name AS patient_name,
                c.case_number
              FROM prescriptions p

              JOIN patients pt
                ON pt.id = p.patient_id

              LEFT JOIN consultation_cases c
                ON c.id =
                  p.consultation_case_id

              ORDER BY p.id DESC
            `)
            .all();

    const items = db.prepare(`
      SELECT *
      FROM prescription_items
      WHERE prescription_id = ?
      ORDER BY id
    `);

    res.json(
      records.map((record) => ({
        ...record,
        items: items.all(record.id),
      })),
    );
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.post("/prescriptions", (req, res) => {
  try {
    const {
      prescription_number,
      patient_id,
      issued_date,
      diagnosis,
      consultation_case_id,
      notes,
      items = [],
    } = req.body;

    if (
      !patient_id ||
      !issued_date ||
      !consultation_case_id
    ) {
      return res.status(400).json({
        message:
          "patient_id, case, and issued_date are required.",
      });
    }

    const linkedCase = db
      .prepare(`
        SELECT id
        FROM consultation_cases
        WHERE id = ?
          AND patient_id = ?
      `)
      .get(
        consultation_case_id,
        patient_id,
      );

    if (!linkedCase) {
      return res.status(400).json({
        message:
          "The selected case does not belong to this patient.",
      });
    }

    const number =
      prescription_number ||
      nextNumber(
        "RX",
        "prescriptions",
        "prescription_number",
      );

    const create = db.transaction(() => {
      const result = db
        .prepare(`
          INSERT INTO prescriptions (
            prescription_number,
            patient_id,
            issued_date,
            diagnosis,
            consultation_case_id,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          number,
          patient_id,
          issued_date,
          diagnosis || null,
          consultation_case_id,
          notes || null,
        );

      const insertItem = db.prepare(`
        INSERT INTO prescription_items (
          prescription_id,
          medicine_name,
          dosage,
          frequency,
          duration,
          instructions
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      items.forEach((item) => {
        if (!item.medicine_name) {
          return;
        }

        insertItem.run(
          result.lastInsertRowid,
          item.medicine_name,
          item.dosage || null,
          item.frequency || null,
          item.duration || null,
          item.instructions || null,
        );
      });

      return result.lastInsertRowid;
    });

    res.status(201).json({
      id: create(),
      prescription_number: number,
      message:
        "Prescription created.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

router.delete(
  "/prescriptions/:id",
  (req, res) => {
    try {
      const result = db
        .prepare(`
          DELETE FROM prescriptions
          WHERE id = ?
        `)
        .run(req.params.id);

      if (!result.changes) {
        return res.status(404).json({
          message:
            "Prescription not found.",
        });
      }

      res.status(204).end();
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

/* =========================================================
   LABORATORY REQUESTS
========================================================= */

router.get(
  "/laboratory-requests",
  (req, res) => {
    try {
      const records =
        req.query.patient_id
          ? db
              .prepare(`
                SELECT
                  r.*,
                  pt.first_name || ' ' ||
                  pt.last_name AS patient_name,
                  c.case_number
                FROM laboratory_requests r

                JOIN patients pt
                  ON pt.id = r.patient_id

                LEFT JOIN consultation_cases c
                  ON c.id =
                    r.consultation_case_id

                WHERE r.patient_id = ?

                ORDER BY r.id DESC
              `)
              .all(
                req.query.patient_id,
              )
          : db
              .prepare(`
                SELECT
                  r.*,
                  pt.first_name || ' ' ||
                  pt.last_name AS patient_name,
                  c.case_number
                FROM laboratory_requests r

                JOIN patients pt
                  ON pt.id = r.patient_id

                LEFT JOIN consultation_cases c
                  ON c.id =
                    r.consultation_case_id

                ORDER BY r.id DESC
              `)
              .all();

      const items = db.prepare(`
        SELECT *
        FROM laboratory_request_items
        WHERE laboratory_request_id = ?
        ORDER BY id
      `);

      res.json(
        records.map((record) => ({
          ...record,
          items: items.all(record.id),
        })),
      );
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

router.post(
  "/laboratory-requests",
  (req, res) => {
    try {
      const {
        request_number,
        patient_id,
        requested_date,
        indication,
        consultation_case_id,
        notes,
        items = [],
      } = req.body;

      if (
        !patient_id ||
        !requested_date ||
        !consultation_case_id
      ) {
        return res.status(400).json({
          message:
            "patient_id, case, and requested_date are required.",
        });
      }

      const linkedCase = db
        .prepare(`
          SELECT id
          FROM consultation_cases
          WHERE id = ?
            AND patient_id = ?
        `)
        .get(
          consultation_case_id,
          patient_id,
        );

      if (!linkedCase) {
        return res.status(400).json({
          message:
            "The selected case does not belong to this patient.",
        });
      }

      const number =
        request_number ||
        nextNumber(
          "LAB",
          "laboratory_requests",
          "request_number",
        );

      const create = db.transaction(
        () => {
          const result = db
            .prepare(`
              INSERT INTO laboratory_requests (
                request_number,
                patient_id,
                requested_date,
                indication,
                consultation_case_id,
                notes
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run(
              number,
              patient_id,
              requested_date,
              indication || null,
              consultation_case_id,
              notes || null,
            );

          const insertItem =
            db.prepare(`
              INSERT INTO laboratory_request_items (
                laboratory_request_id,
                test_name
              )
              VALUES (?, ?)
            `);

          const invoice = db.prepare("SELECT id FROM invoices WHERE consultation_case_id=?")
            .get(consultation_case_id);
          items.forEach((item) => {
            if (!item.test_name) {
              return;
            }

            const requestItem = insertItem.run(
              result.lastInsertRowid,
              item.test_name,
            );
            const configuredCharge = db.prepare(`SELECT * FROM charge_types
              WHERE name=? COLLATE NOCASE AND is_active=1`).get(item.test_name);
            if (invoice && configuredCharge && item.billable !== false) {
              upsertInvoiceItem({
                invoice_id: invoice.id,
                patient_id,
                consultation_case_id,
                source_type: "laboratory",
                source_id: requestItem.lastInsertRowid,
                category: "Laboratory",
                description: item.test_name,
                quantity: 1,
                unit_price: configuredCharge.default_amount,
                discount: 0,
                remarks: `Laboratory request ${number}`,
              });
            }
          });
          if (invoice) recalculateInvoice(invoice.id);

          return result.lastInsertRowid;
        },
      );

      res.status(201).json({
        id: create(),
        request_number: number,
        message:
          "Laboratory request created.",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

router.delete(
  "/laboratory-requests/:id",
  (req, res) => {
    try {
      const result = db
        .prepare(`
          DELETE FROM laboratory_requests
          WHERE id = ?
        `)
        .run(req.params.id);

      if (!result.changes) {
        return res.status(404).json({
          message:
            "Laboratory request not found.",
        });
      }

      res.status(204).end();
    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: err.message,
      });
    }
  },
);

module.exports = router;
