const express = require('express');
const path = require('node:path');
const { createBackupService } = require('../services/backups');
const { permissionGuard } = require('../services/permissions');
const maintenance = require('../services/maintenance');
module.exports = (db, directory = path.join(__dirname,'..','storage','backups')) => {
  const router = express.Router();
  const service = createBackupService(db,directory);
  const admin = (req,res,next) => req.user?.role === 'admin' ? next() : res.status(403).json({message:'Only Admin can import, download, delete, or restore full database backups.'});
  const handle = fn => async (req,res,next) => { try { await fn(req,res,next); } catch(error) { res.status(error.status || 500).json({message:error.status ? error.message : 'The backup operation failed. Check available disk space and server folder permissions.'}); } };
  router.use(permissionGuard);
  router.get('/backups',handle((req,res)=>res.json(service.list())));
  router.post('/backups',handle(async(req,res)=>res.status(201).json({...await service.create(),message:'Backup created successfully.'})));
  router.post('/backups/import',admin,express.raw({type:'application/octet-stream',limit:'100mb'}),handle(async(req,res)=>res.status(201).json({...await service.import(req.body),message:'Backup imported and validated. Select Restore when you are ready.'})));
  router.get('/backups/:name/preview',admin,handle((req,res)=>res.json(service.inspect(req.params.name))));
  router.get('/backups/:name/download',admin,handle((req,res)=>{
    res.set('Cache-Control','no-store');
    res.download(service.download(req.params.name),req.params.name,error=>{if(error && !res.headersSent)res.status(500).json({message:'Unable to download the backup.'});});
  }));
  router.delete('/backups/:name',admin,handle(async(req,res)=>{await service.remove(req.params.name);res.status(204).end();}));
  router.post('/backups/:name/restore',admin,handle(async(req,res)=>{
    if (req.body?.confirmation !== req.params.name) return res.status(400).json({message:'Enter the exact backup filename to confirm restoration.'});
    maintenance.beginRestore();
    try { res.json(await service.restore(req.params.name,req.user.id)); }
    finally { maintenance.endRestore(); }
  }));
  router.use((error,req,res,next)=>{
    if (error.type === 'entity.too.large') return res.status(413).json({message:'The upload limit is 100 MB.'});
    next(error);
  });
  return router;
};
