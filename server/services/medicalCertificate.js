function validateMedicalCertificate(body, user) {
  if (!['doctor', 'admin'].includes(user?.role)) throw new Error('Only doctors and administrators can edit medical certificates.');
  const certificate = {};
  for (const field of ['issued_date', 'examination_date', 'purpose', 'findings', 'recommendations', 'physician', 'license_number']) {
    if (typeof body?.[field] !== 'string' || body[field].length > 10000) throw new Error('Invalid certificate fields.');
    certificate[field] = body[field].trim();
  }
  for (const field of ['issued_date', 'examination_date']) {
    const value = certificate[field];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
      throw new Error('Enter valid issue and examination dates.');
  }
  if (!certificate.findings || !certificate.physician) throw new Error('Clinical findings and physician name are required.');
  if (body.recipient_name != null && body.recipient_name !== "") {
    if (typeof body.recipient_name !== 'string' || !body.recipient_name.trim() || body.recipient_name.length > 200) throw new Error('Enter the certificate recipient name.');
    certificate.recipient_name = body.recipient_name.trim();
  }
  return certificate;
}

module.exports = { validateMedicalCertificate };
