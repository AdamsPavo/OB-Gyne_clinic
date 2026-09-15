const express = require('express');

module.exports = db => {
  const router = express.Router();
  router.get('/laboratory-procedures', (req, res) => {
    res.json(db.prepare('SELECT id,name,category FROM laboratory_procedures WHERE is_active=1 ORDER BY category,name').all());
  });
  const save = editing => (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
    if (!name || !category || name.length > 200 || category.length > 100)
      return res.status(400).json({ message: 'Enter a procedure name (up to 200 characters) and category (up to 100 characters).' });
    const active = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
    try {
      const result = editing
        ? db.prepare('UPDATE laboratory_procedures SET name=?,category=?,is_active=? WHERE id=?').run(name,category,active,req.params.id)
        : db.prepare('INSERT INTO laboratory_procedures(name,category,is_active) VALUES(?,?,?)').run(name,category,active);
      if (editing && !result.changes) return res.status(404).json({ message: 'Laboratory procedure not found.' });
      res.status(editing ? 200 : 201).json({ message: editing ? 'Laboratory procedure updated.' : 'Laboratory procedure added.' });
    } catch (error) {
      const duplicate = error.code === 'SQLITE_CONSTRAINT_UNIQUE';
      res.status(duplicate ? 409 : 500).json({ message: duplicate ? 'That laboratory procedure already exists.' : 'Unable to save laboratory procedure.' });
    }
  };
  router.post('/tools/laboratory-procedures', save(false));
  router.put('/tools/laboratory-procedures/:id', save(true));
  return router;
};
