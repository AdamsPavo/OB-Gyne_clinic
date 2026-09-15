function deletePatientCharge(db, id, reason, user, recalculateInvoice) {
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000)
    fail('Enter a cancellation reason between 1 and 1,000 characters.');
  return db.transaction(() => {
    const charge = db.prepare('SELECT * FROM patient_charges WHERE id=?').get(id);
    if (!charge) fail('Charge not found.', 404);
    if (charge.status === 'Deleted') fail('This charge has already been cancelled.', 409);
    const invoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(charge.invoice_id);
    if (!invoice) fail('Invoice not found.', 404);
    if (invoice.billing_status === 'Finalized') fail('This bill is finalized. Use a billing adjustment to correct this charge.', 409);
    const items = db.prepare('SELECT * FROM patient_charges WHERE charge_number=? AND invoice_id=? AND patient_id=? AND status<>?').all(charge.charge_number,charge.invoice_id,charge.patient_id,'Deleted');
    for (const line of items) {
    const item = db.prepare("SELECT * FROM invoice_items WHERE invoice_id=? AND source_type='manual_charge' AND source_id=?").get(invoice.id, line.id);
    if (!item) fail('This charge has no linked billing item. Use a billing adjustment to correct the bill.', 409);
    const actor = `${user.fullname || user.full_name || user.username || 'User'} (ID ${user.id})`;
    const entry = `Cancelled by ${actor} at ${new Date().toISOString()}: ${reason.trim()}`;
    db.prepare("UPDATE patient_charges SET status='Deleted',notes=CASE WHEN COALESCE(notes,'')='' THEN ? ELSE notes||char(10)||? END WHERE id=?").run(entry,entry,line.id);
    db.prepare("UPDATE invoice_items SET is_void=1,remarks=CASE WHEN COALESCE(remarks,'')='' THEN ? ELSE remarks||char(10)||? END WHERE id=?").run(entry,entry,item.id);
    }
    return recalculateInvoice(invoice.id);
  })();
}
module.exports = { deletePatientCharge };
