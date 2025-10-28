// db.js
const Database = require('better-sqlite3');
const db = new Database('data.sqlite');

function init(){
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      qty INTEGER,
      ticketNumbers TEXT,
      status TEXT,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `);
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get('ticketsSold');
  if(!row) db.prepare('INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)').run('ticketsSold','0');
}

function getMeta(k){
  const r = db.prepare('SELECT v FROM meta WHERE k=?').get(k);
  return r ? r.v : null;
}
function setMeta(k,v){
  db.prepare('INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)').run(k,String(v));
}

function addPurchase(p){
  const stmt = db.prepare('INSERT INTO purchases (id,name,email,qty,ticketNumbers,status,createdAt) VALUES (?,?,?,?,?,?,?)');
  stmt.run(p.id, p.name, p.email, p.qty, JSON.stringify(p.ticketNumbers), p.status, p.createdAt);
}
function updatePurchaseStatus(id, status){
  db.prepare('UPDATE purchases SET status=? WHERE id=?').run(status, id);
}
function listPurchases(){
  return db.prepare('SELECT * FROM purchases ORDER BY createdAt ASC').all().map(r=>({
    ...r,
    ticketNumbers: JSON.parse(r.ticketNumbers)
  }));
}
function getTicketsSold(){
  const r = db.prepare('SELECT SUM(qty) as s FROM purchases').get();
  return r && r.s ? Number(r.s) : 0;
}

module.exports = { init, getMeta, setMeta, addPurchase, listPurchases, updatePurchaseStatus, getTicketsSold };
