(() => {
  // Valores visuales locales (se actualizarán con /status)
  const ticketQty = document.getElementById("ticket-qty");
  const qtyIncrease = document.getElementById("qty-increase");
  const qtyDecrease = document.getElementById("qty-decrease");
  const ticketPriceDisplay = document.getElementById("ticket-price-display");
  const totalPrice = document.getElementById("total-price");
  const checkoutBtn = document.getElementById("checkout-btn");
  const manualPayBtn = document.getElementById("manual-pay-btn");
  const remainingCountEl = document.getElementById("remaining-count");
  const limitDisplay = document.getElementById("limit-display");
  const winnersCountDisplay = document.getElementById("winners-count-display");
  const drawDateText = document.getElementById("draw-date-text");
  const soldoutBanner = document.getElementById("soldout-banner");
  const openAdminBtn = document.getElementById("open-admin");
  const adminModal = document.getElementById("admin-modal");
  const adminClose = document.getElementById("admin-close");
  const selectWinnersBtn = document.getElementById("select-winners-btn");
  const adminPasswordInput = document.getElementById("admin-password");
  const winnersCountInput = document.getElementById("winners-count-input");
  const winnersResult = document.getElementById("winners-result");
  const contactForm = document.getElementById("contact-form");

  let STATUS = null; // fetched from server

  // Inicial UI
  document.getElementById("copy-year").textContent = new Date().getFullYear();
  ticketQty.addEventListener("input", updateTotal);
  qtyIncrease.addEventListener("click", ()=> ticketQty.stepUp() );
  qtyDecrease.addEventListener("click", ()=> ticketQty.stepDown() );
  ticketQty.addEventListener("input", updateTotal);
  updateTotal();

  checkoutBtn.addEventListener("click", handleCheckout);
  manualPayBtn.addEventListener("click", handleManualPayment);
  openAdminBtn.addEventListener("click", ()=> adminModal.style.display = "flex");
  adminClose.addEventListener("click", ()=> adminModal.style.display = "none");
  selectWinnersBtn.addEventListener("click", selectWinners);
  contactForm.addEventListener("submit", (e)=> { e.preventDefault(); alert("Gracias. Te contactaremos pronto."); contactForm.reset(); });

  // obtener estado del servidor (precio, boletos restantes)
  async function fetchStatus(){
    try{
      const r = await fetch('/status');
      STATUS = await r.json();
      ticketPriceDisplay.textContent = `$${Number(STATUS.ticketPrice).toFixed(2)}`;
      document.getElementById("ticket-price-text").textContent = `$${Number(STATUS.ticketPrice).toFixed(2)}`;
      document.getElementById("limit-display").textContent = STATUS.totalTickets;
      document.getElementById("winners-count-display").textContent = STATUS.winnersDefault;
      document.getElementById("remaining-count").textContent = STATUS.remaining;
      document.getElementById("draw-date-text").textContent = STATUS.drawDateText;
      document.getElementById("ein-placeholder").textContent = STATUS.ein || "(agrega EIN aquí)";
      updateRemainingUI();
      updateTotal();
    }catch(err){
      console.error("No se pudo obtener estado:", err);
    }
  }
  fetchStatus();

  function updateTotal(){
    const qty = Math.max(1, Number(ticketQty.value || 1));
    const price = STATUS ? Number(STATUS.ticketPrice) : Number(ticketPriceDisplay.textContent.replace('$','')) || 25;
    const total = qty * price;
    totalPrice.textContent = `$${total.toFixed(2)}`;
  }

  function updateRemainingUI(){
    if(!STATUS) return;
    if(STATUS.remaining <= 0){
      soldoutBanner.style.display = "block";
      checkoutBtn.disabled = true;
      manualPayBtn.disabled = true;
    } else {
      soldoutBanner.style.display = "none";
      checkoutBtn.disabled = false;
      manualPayBtn.disabled = false;
    }
  }

  // HANDLE: crear sesión de checkout (backend)
  async function handleCheckout(){
    const qty = Math.max(1, Number(ticketQty.value || 1));
    if(!STATUS) { alert("Cargando... intenta de nuevo en un momento."); return; }
    if(qty > STATUS.remaining){ alert(`Solo quedan ${STATUS.remaining} boletos disponibles.`); return; }
    const name = document.getElementById("buyer-name").value.trim();
    const email = document.getElementById("buyer-email").value.trim();
    if(!name || !email){ alert("Por favor completa nombre y correo."); return; }

    try{
      const resp = await fetch('/create-checkout-session', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ name, email, qty })
      });
      const data = await resp.json();
      if(data.error) throw new Error(data.error);
      // redirigir a Stripe Checkout
      window.location = data.url;
    }catch(err){
      alert("Error al crear sesión de pago: " + (err.message || err));
      console.error(err);
    }
  }

  // HANDLE: pago manual (registrar pendiente)
  async function handleManualPayment(){
    const qty = Math.max(1, Number(ticketQty.value || 1));
    if(!STATUS) { alert("Cargando... intenta de nuevo en un momento."); return; }
    if(qty > STATUS.remaining){ alert(`Solo quedan ${STATUS.remaining} boletos disponibles.`); return; }
    const name = document.getElementById("buyer-name").value.trim();
    const email = document.getElementById("buyer-email").value.trim();
    if(!name || !email){ alert("Por favor completa nombre y correo."); return; }

    const bankInfo = `Banco: XXXX\nCuenta: 000-000-000\nReferencia: TUEMAIL o NOMBRE\nEnviar comprobante a info@ganatuautopr.com`;
    if(!confirm(`Para pagar por transferencia:\n\n${bankInfo}\n\n¿Deseas registrar la compra ahora como pendiente y recibir números temporales?`)) return;

    try{
      const resp = await fetch('/manual-payment', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, email, qty })
      });
      const data = await resp.json();
      if(data.error) throw new Error(data.error);
      alert(`Compra registrada como pendiente. Números asignados:\n${data.ticketNumbers.join(', ')}\nEnvía comprobante a info@ganatuautopr.com`);
      await fetchStatus();
    }catch(err){
      alert("Error: " + (err.message || err));
      console.error(err);
    }
  }

  // Admin select winners (llama al backend)
  async function selectWinners(){
    const pw = adminPasswordInput.value;
    const n = Math.max(1, Number(winnersCountInput.value || 1));
    if(!pw){ alert("Introduce contraseña admin."); return; }
    try{
      const resp = await fetch('/admin/select-winners', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ password: pw, winners: n })
      });
      const data = await resp.json();
      if(data.error) { winnersResult.innerText = "Error: " + data.error; return; }
      if(!data.winners || data.winners.length === 0){ winnersResult.innerText = "No se encontraron boletos."; return; }
      winnersResult.innerHTML = `<strong>Ganador(es):</strong><ol>${data.winners.map(w => `<li>#${w.ticket} — ${escapeHtml(w.name)} (${escapeHtml(w.email)})</li>`).join('')}</ol>`;
    }catch(err){
      winnersResult.innerText = "Error al seleccionar ganadores.";
      console.error(err);
    }
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }
})();
