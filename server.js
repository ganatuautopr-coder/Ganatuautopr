// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const sgMail = require('@sendgrid/mail');
const { init, addPurchase, listPurchases, updatePurchaseStatus, getTicketsSold } = require('./db');
const crypto = require('crypto');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const PORT = process.env.PORT || 4242;
const app = express();
init();

app.use(cors());
app.use(express.static('public'));

// Stripe webhook requires raw body
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('Webhook signature verification failed.', err && err.message);
    return res.status(400).send(`Webhook Error: ${err && err.message}`);
  }

  if(event.type === 'checkout.session.completed'){
    const session = event.data.object;
    const purchaseId = session.metadata && session.metadata.purchaseId;
    try {
      updatePurchaseStatus(purchaseId, 'paid');
      const purchases = listPurchases();
      const p = purchases.find(x => x.id === purchaseId);
      if(p && process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM){
        const msg = {
          to: p.email,
          from: process.env.EMAIL_FROM,
          subject: 'Confirmación de compra — GanatuautoPR',
          html: generateEmailHtml(p)
        };
        await sgMail.send(msg);
      }
      console.log('Pago confirmado y procesado para', purchaseId);
    } catch (err) {
      console.error('Error procesando el checkout session:', err);
    }
  }
  res.json({received: true});
});

app.use(bodyParser.json());

// PUBLIC: status (precio, remaining)
app.get('/status', (req, res) => {
  const ticketPrice = Number(process.env.TICKET_PRICE || 25.00);
  const totalTickets = Number(process.env.TOTAL_TICKETS || 500);
  const sold = getTicketsSold();
  const remaining = Math.max(0, totalTickets - sold);
  res.json({
    ticketPrice,
    totalTickets,
    sold,
    remaining,
    winnersDefault: Number(process.env.WINNERS_DEFAULT || 1),
    drawDateText: process.env.DRAW_DATE || "Diciembre 15, 2025",
    ein: process.env.EIN || ""
  });
});

// create checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { name, email, qty } = req.body;
  const ticketPrice = Math.round(Number(process.env.TICKET_PRICE || 25.00) * 100); // cents
  const totalTickets = Number(process.env.TOTAL_TICKETS || 500);
  const sold = getTicketsSold();
  const remaining = Math.max(0, totalTickets - sold);
  if(qty > remaining) return res.status(400).json({ error: `Solo quedan ${remaining} boletos disponibles.` });

  const base = sold + 1;
  const ticketNumbers = [];
  for(let i=0;i<qty;i++) ticketNumbers.push(base + i);

  const purchaseId = `p-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  addPurchase({
    id: purchaseId,
    name,
    email,
    qty,
    ticketNumbers,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/?canceled=true`,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Rifa GanatuautoPR — ${qty} boleto(s)` },
          unit_amount: ticketPrice
        },
        quantity: qty
      }],
      metadata: { purchaseId },
      customer_email: email
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe create session error', err);
    res.status(500).json({ error: 'No se pudo crear sesión de pago.' });
  }
});

// manual payment endpoint
app.post('/manual-payment', (req, res) => {
  const { name, email, qty } = req.body;
  const totalTickets = Number(process.env.TOTAL_TICKETS || 500);
  const sold = getTicketsSold();
  const remaining = Math.max(0, totalTickets - sold);
  if(qty > remaining) return res.status(400).json({ error: `Solo quedan ${remaining} boletos disponibles.` });

  const base = sold + 1;
  const ticketNumbers = [];
  for(let i=0;i<qty;i++) ticketNumbers.push(base + i);
  const id = `p-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  addPurchase({
    id, name, email, qty, ticketNumbers, status: 'pending', createdAt: new Date().toISOString()
  });

  res.json({ ticketNumbers, purchaseId: id });
});

// admin select winners
app.post('/admin/select-winners', (req, res) => {
  const { password, winners } = req.body;
  if(password !== process.env.ADMIN_PASSWORD) return res.status(403).json({ error: 'Contraseña incorrecta' });
  const purchases = listPurchases();
  const pool = [];
  for(const p of purchases){
    if(p.status !== 'paid') continue;
    for(const t of p.ticketNumbers) pool.push({ ticket: t, name: p.name, email: p.email, purchaseId: p.id });
  }
  if(pool.length === 0) return res.json({ winners: [] });
  for(let i=pool.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, Number(winners || process.env.WINNERS_DEFAULT || 1));
  res.json({ winners: chosen });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function generateEmailHtml(p){
  return `
  <h2>Confirmación de compra — GanatuautoPR</h2>
  <p>Hola ${escape(p.name)},</p>
  <p>Gracias por comprar ${p.qty} boleto(s) para la rifa. Tus números asignados son:</p>
  <p><strong>${p.ticketNumbers.join(', ')}</strong></p>
  <p>El sorteo se realizará el <strong>${process.env.DRAW_DATE || 'Diciembre 15, 2025'}</strong>. Guardar este correo como comprobante.</p>
  <hr/>
  <p>GanatuautoPR LLC — Si tienes preguntas, responde a este correo.</p>
  `;
}
function escape(s){ return String(s).replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }
