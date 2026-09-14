let active = 0;
let restoring = false;
function middleware(req, res, next) {
  if (restoring) return res.status(503).json({message:'Database restoration is in progress. Please try again shortly.'});
  active++;
  let ended = false;
  const finish = () => { if (!ended) { ended = true; active--; } };
  res.once('finish', finish); res.once('close', finish);
  next();
}
function beginRestore() {
  if (restoring || active > 1) { const error = new Error('Other requests are still running. Wait a moment and try restoring again.'); error.status=409; throw error; }
  restoring = true;
}
module.exports = { middleware, beginRestore, endRestore:() => { restoring=false; } };
