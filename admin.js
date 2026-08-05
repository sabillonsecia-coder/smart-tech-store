/* ==========================================================================
   SMARTTECH STORE — LÓGICA DEL PANEL ADMINISTRATIVO (admin.js)
   ========================================================================== */

/* ---------------------- GUARDIA DE SESIÓN ---------------------- */
const sesionRaw = sessionStorage.getItem('stt_sesion');
if (!sesionRaw) {
    window.location.href = 'admin_login.html';
}
const sesion = sesionRaw ? JSON.parse(sesionRaw) : { nombre: 'Invitado', rol: 'Invitado' };
document.getElementById('usuarioActivoLabel').innerText = `${sesion.nombre} · ${sesion.rol}`;

document.getElementById('btnLogout').addEventListener('click', function () {
    Swal.fire({
        title: '¿Cerrar sesión?', icon: 'question', showCancelButton: true,
        confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
    }).then(r => {
        if (r.isConfirmed) {
            DB.addLog(sesion.nombre, 'Cerró sesión del panel administrativo');
            sessionStorage.removeItem('stt_sesion');
            window.location.href = 'admin_login.html';
        }
    });
});

/* ---------------------- RELOJ ---------------------- */
function actualizarReloj() {
    document.getElementById('fechaHoraTopbar').innerText = new Date().toLocaleString('es-HN');
}
setInterval(actualizarReloj, 1000); actualizarReloj();

/* ---------------------- NAVEGACIÓN LATERAL ---------------------- */
const titulos = {
    dashboard: 'Dashboard', pedidos: 'Pedidos en Curso', facturas: 'Gestión de Facturas',
    productos: 'Productos & Stock', caja: 'Cierre de Caja', reportes: 'Reportes y Estadísticas',
    opiniones: 'Opiniones de Clientes', auditoria: 'Bitácora de Auditoría', config: 'Configuración'
};
document.querySelectorAll('.admin-nav-link[data-section]').forEach(link => {
    link.addEventListener('click', function () {
        const target = this.dataset.section;
        document.querySelectorAll('.admin-nav-link[data-section]').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + target).classList.add('active');
        document.getElementById('tituloSeccion').innerText = titulos[target];
        document.getElementById('adminSidebar').classList.remove('open');
        renderAll();
    });
});
document.getElementById('btnToggleSidebar').addEventListener('click', () => document.getElementById('adminSidebar').classList.toggle('open'));

/* ---------------------- RENDER GENERAL ---------------------- */
function renderAll() {
    renderDashboard();
    renderPedidos();
    renderFacturasAdmin();
    renderProductosAdmin();
    renderCaja();
    renderReportes();
    renderOpiniones();
    renderLogs();
    renderUsuariosConfig();
}

/* ==================== DASHBOARD ==================== */
let chartVentas7, chartMetodoPago;
function renderDashboard() {
    const facturas = DB.getFacturas();
    const productos = DB.getProductos();

    const totalCaja = DB.facturasSinCerrar().reduce((s, f) => s + f.total, 0);
    document.getElementById('kpiCaja').innerText = `L. ${totalCaja.toFixed(2)}`;
    document.getElementById('kpiFacturas').innerText = facturas.length;
    const promedio = facturas.length ? facturas.reduce((s, f) => s + f.total, 0) / facturas.length : 0;
    document.getElementById('kpiPromedio').innerText = `L. ${promedio.toFixed(2)}`;
    document.getElementById('kpiStockBajo').innerText = productos.filter(p => p.stock <= 5).length;

    const tbody = document.getElementById('tablaUltimasFacturas');
    const ultimas = facturas.slice().reverse().slice(0, 6);
    tbody.innerHTML = ultimas.length ? ultimas.map(f => `
        <tr><td class="small fw-bold">${f.folio}</td><td>${f.nombre}</td><td><small>${f.fecha}</small></td>
        <td class="fw-bold text-success">L. ${f.total.toFixed(2)}</td><td><small>${f.metodoPago}</small></td>
        <td><span class="badge-estado badge-${f.estadoPedido}">${f.estadoPedido}</span></td></tr>
    `).join('') : `<tr><td colspan="6" class="text-muted py-3">Aún no hay facturas registradas.</td></tr>`;

    // Últimos 7 días
    const dias = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dias.push(d.toLocaleDateString('es-HN'));
    }
    const ventasPorDia = dias.map(d => facturas.filter(f => f.fecha === d).reduce((s, f) => s + f.total, 0));

    const ctx7 = document.getElementById('chartVentas7');
    if (chartVentas7) chartVentas7.destroy();
    chartVentas7 = new Chart(ctx7, {
        type: 'line',
        data: { labels: dias, datasets: [{ label: 'Ventas (L.)', data: ventasPorDia, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.15)', fill: true, tension: .3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    const metodos = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque'];
    const dataMetodos = metodos.map(m => facturas.filter(f => f.metodoPago === m).reduce((s, f) => s + f.total, 0));
    const ctxM = document.getElementById('chartMetodoPago');
    if (chartMetodoPago) chartMetodoPago.destroy();
    chartMetodoPago = new Chart(ctxM, {
        type: 'doughnut',
        data: { labels: metodos, datasets: [{ data: dataMetodos, backgroundColor: ['#059669', '#2563eb', '#d97706', '#7c3aed'] }] },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

/* ==================== PEDIDOS (KANBAN) ==================== */
const flujoEstados = ['Pendiente', 'Preparando', 'Listo', 'Entregado'];
function renderPedidos() {
    const facturas = DB.getFacturas().slice().reverse();
    flujoEstados.forEach(estado => {
        const cont = document.getElementById('kanban-' + estado);
        const items = facturas.filter(f => f.estadoPedido === estado);
        if (items.length === 0) { cont.innerHTML = `<p class="text-muted small text-center py-3">Sin pedidos aquí.</p>`; return; }
        cont.innerHTML = items.map(f => {
            const siguienteIdx = flujoEstados.indexOf(f.estadoPedido) + 1;
            const siguiente = flujoEstados[siguienteIdx];
            return `
            <div class="order-card">
                <div class="d-flex justify-content-between"><strong class="small">${f.folio}</strong><small>${f.hora}</small></div>
                <div class="small">${f.nombre}</div>
                <div class="small text-muted"><i class="fa-solid fa-location-dot me-1"></i>${f.tipoEntrega}${f.direccion ? ' — ' + f.direccion : ''}</div>
                <div class="small fw-bold text-success mt-1">L. ${f.total.toFixed(2)}</div>
                ${siguiente ? `<button class="btn btn-sm btn-outline-primary w-100 mt-2" onclick="avanzarPedido('${f.folio}','${siguiente}')">Mover a: ${siguiente} <i class="fa-solid fa-arrow-right ms-1"></i></button>` : `<div class="text-success small fw-bold mt-2"><i class="fa-solid fa-circle-check me-1"></i>Completado</div>`}
            </div>`;
        }).join('');
    });
}
function avanzarPedido(folio, estado) {
    DB.actualizarEstadoPedido(folio, estado, sesion.nombre);
    DB.addLog(sesion.nombre, `Cambió el pedido ${folio} al estado "${estado}"`);
    renderAll();
}

/* ==================== FACTURAS ==================== */
let filtroTextoFactura = '', filtroFechaFactura = '';
function renderFacturasAdmin() {
    let facturas = DB.getFacturas().slice().reverse();
    if (filtroTextoFactura) {
        const f = filtroTextoFactura.toLowerCase();
        facturas = facturas.filter(x => x.folio.toLowerCase().includes(f) || x.dni.toLowerCase().includes(f) || x.nombre.toLowerCase().includes(f));
    }
    if (filtroFechaFactura) {
        facturas = facturas.filter(x => {
            const [y, m, d] = filtroFechaFactura.split('-');
            return x.fecha === `${d}/${m}/${y}`;
        });
    }
    const tbody = document.getElementById('tablaAdminFacturas');
    tbody.innerHTML = facturas.length ? facturas.map(f => `
        <tr style="cursor:pointer;" onclick="seleccionarFactura('${f.folio}')">
            <td class="fw-bold small">${f.folio}</td><td>${f.nombre}</td><td><small>${f.fecha}</small></td>
            <td class="fw-bold text-success">L. ${f.total.toFixed(2)}</td><td><small>${f.metodoPago}</small></td>
            <td><span class="badge-estado badge-${f.estadoPedido}">${f.estadoPedido}</span></td>
            <td><small class="text-muted">${f.editadoPor || '—'}</small></td>
        </tr>`).join('') : `<tr><td colspan="7" class="text-muted py-3">No se encontraron facturas.</td></tr>`;
}
document.getElementById('filtroFacturaTexto').addEventListener('input', function () { filtroTextoFactura = this.value; renderFacturasAdmin(); });
document.getElementById('filtroFacturaFecha').addEventListener('input', function () { filtroFechaFactura = this.value; renderFacturasAdmin(); });
document.getElementById('btnLimpiarFiltroFactura').addEventListener('click', function () {
    filtroTextoFactura = ''; filtroFechaFactura = '';
    document.getElementById('filtroFacturaTexto').value = ''; document.getElementById('filtroFacturaFecha').value = '';
    renderFacturasAdmin();
});

let facturaSeleccionada = null;
function seleccionarFactura(folio) {
    facturaSeleccionada = DB.getFacturas().find(f => f.folio === folio);
    if (!facturaSeleccionada) return;
    document.getElementById('editFolio').value = folio;
    document.getElementById('editFolioLabel').value = folio;
    document.getElementById('editDni').value = facturaSeleccionada.dni;
    document.getElementById('editNombre').value = facturaSeleccionada.nombre;
    document.getElementById('editEstado').value = facturaSeleccionada.estadoPedido;
    document.getElementById('editTotal').value = facturaSeleccionada.total.toFixed(2);
    document.getElementById('editAuditInfo').innerText = facturaSeleccionada.editadoPor
        ? `Última edición: ${facturaSeleccionada.editadoPor} — ${facturaSeleccionada.fechaEdicion}`
        : 'Sin ediciones registradas todavía.';
    ['editEstado', 'editTotal'].forEach(id => document.getElementById(id).disabled = false);
    ['btnGuardarFactura', 'btnVerTicketAdmin', 'btnEliminarFactura'].forEach(id => document.getElementById(id).disabled = false);
    document.getElementById('btnCancelarEdicion').style.display = 'block';
}
document.getElementById('btnCancelarEdicion').addEventListener('click', function () {
    facturaSeleccionada = null;
    document.getElementById('formEdicionFactura').reset();
    ['editEstado', 'editTotal'].forEach(id => document.getElementById(id).disabled = true);
    ['btnGuardarFactura', 'btnVerTicketAdmin', 'btnEliminarFactura'].forEach(id => document.getElementById(id).disabled = true);
    this.style.display = 'none';
    document.getElementById('editAuditInfo').innerText = '';
});

document.getElementById('formEdicionFactura').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!facturaSeleccionada) return;
    const nuevoEstado = document.getElementById('editEstado').value;
    const nuevoTotal = parseFloat(document.getElementById('editTotal').value);
    DB.actualizarFactura(facturaSeleccionada.folio, { estadoPedido: nuevoEstado, total: nuevoTotal }, sesion.nombre);
    DB.addLog(sesion.nombre, `Editó la factura ${facturaSeleccionada.folio} (estado: ${nuevoEstado}, total: L. ${nuevoTotal.toFixed(2)})`);
    Swal.fire({ icon: 'success', title: 'Factura actualizada', timer: 1800, showConfirmButton: false });
    document.getElementById('btnCancelarEdicion').click();
    renderAll();
});

document.getElementById('btnVerTicketAdmin').addEventListener('click', function () {
    if (!facturaSeleccionada) return;
    const f = facturaSeleccionada;
    document.getElementById('printAreaAdmin').innerHTML = `
        <div class="text-center mb-2"><h5 class="fw-bold mb-0">SMARTTECH STORE</h5><small>RTN: 05011995123456</small><br><small>Terminal POS — Honduras</small><div class="divider"></div></div>
        <div class="small mb-2">
            <div><strong>Folio:</strong> ${f.folio}</div>
            <div><strong>Fecha:</strong> ${f.fecha} &nbsp; <strong>Hora:</strong> ${f.hora}</div>
            <div><strong>Cliente:</strong> ${f.nombre}</div>
            <div><strong>DNI:</strong> ${f.dni}</div>
            <div><strong>Entrega:</strong> ${f.tipoEntrega}${f.direccion ? ' — ' + f.direccion : ''}</div>
            <div><strong>Pago:</strong> ${f.metodoPago}</div>
        </div>
        <div class="divider"></div>
        <table class="table table-sm table-borderless small mb-1">
            <thead><tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-end">Total</th></tr></thead>
            <tbody>${f.detalle.map(i => `<tr><td>${i.nombre}</td><td class="text-center">${i.cantidad}</td><td class="text-end">L. ${i.subtotal.toFixed(2)}</td></tr>`).join('')}</tbody>
        </table>
        <div class="divider"></div>
        <div class="small">
            <div class="d-flex justify-content-between"><span>Subtotal:</span><span>L. ${f.subtotal.toFixed(2)}</span></div>
            <div class="d-flex justify-content-between text-danger"><span>Descuento:</span><span>-L. ${f.descuento.toFixed(2)}</span></div>
            <div class="d-flex justify-content-between"><span>ISV:</span><span>L. ${f.impuesto.toFixed(2)}</span></div>
            <div class="d-flex justify-content-between fw-bold border-top pt-1"><span>TOTAL:</span><span>L. ${f.total.toFixed(2)}</span></div>
        </div>
        ${f.calificacion ? `<div class="divider"></div><div class="small text-center">Calificación del cliente: ${'⭐'.repeat(f.calificacion)}<br><em>"${f.comentario || ''}"</em></div>` : ''}
    `;
    new bootstrap.Modal(document.getElementById('modalTicketAdmin')).show();
});

document.getElementById('btnEliminarFactura').addEventListener('click', function () {
    if (!facturaSeleccionada) return;
    const folio = facturaSeleccionada.folio, total = facturaSeleccionada.total, cliente = facturaSeleccionada.nombre;
    Swal.fire({
        title: `¿Eliminar factura ${folio}?`, text: `Se descontará L. ${total.toFixed(2)} del reporte de caja. Esta acción requiere auditoría.`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
        if (r.isConfirmed) {
            DB.eliminarFactura(folio);
            DB.addLog(sesion.nombre, `ELIMINÓ la factura ${folio} del cliente "${cliente}" (L. ${total.toFixed(2)})`);
            Swal.fire({ icon: 'success', title: 'Factura eliminada', timer: 1500, showConfirmButton: false });
            document.getElementById('btnCancelarEdicion').click();
            renderAll();
        }
    });
});

/* ==================== PRODUCTOS ==================== */
function renderProductosAdmin() {
    const productos = DB.getProductos();
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = productos.map(p => `
        <tr class="${p.stock <= 0 ? 'out-stock-row' : (p.stock <= 5 ? 'low-stock-row' : '')}">
            <td class="text-start">
                <div class="d-flex align-items-center gap-2">
                    <div style="width:36px;height:36px;border-radius:8px;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff;">
                        <i class="fa-solid ${p.icono}"></i>
                    </div>
                    <span class="fw-semibold">${p.nombre}</span>
                </div>
            </td>
            <td><span class="badge bg-secondary">${p.categoria}</span></td>
            <td>L. ${p.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td class="fw-bold">${p.stock} ${p.stock <= 5 ? '<i class="fa-solid fa-triangle-exclamation text-warning ms-1"></i>' : ''}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarProducto(${p.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="borrarProducto(${p.id})"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`).join('');
}

document.getElementById('btnNuevoProducto').addEventListener('click', function () {
    document.getElementById('formProducto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('tituloModalProducto').innerText = 'Nuevo Producto';
    new bootstrap.Modal(document.getElementById('modalProducto')).show();
});

function editarProducto(id) {
    const p = DB.getProducto(id);
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodNombre').value = p.nombre;
    document.getElementById('prodCategoria').value = p.categoria;
    document.getElementById('prodPrecio').value = p.precio;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodIcono').value = p.icono;
    document.getElementById('prodColor').value = p.color;
    document.getElementById('tituloModalProducto').innerText = 'Editar Producto';
    new bootstrap.Modal(document.getElementById('modalProducto')).show();
}

function borrarProducto(id) {
    const p = DB.getProducto(id);
    Swal.fire({
        title: `¿Eliminar "${p.nombre}"?`, icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
        if (r.isConfirmed) {
            DB.eliminarProducto(id);
            DB.addLog(sesion.nombre, `Eliminó el producto "${p.nombre}" del catálogo`);
            renderAll();
            Swal.fire({ icon: 'success', title: 'Producto eliminado', timer: 1500, showConfirmButton: false });
        }
    });
}

document.getElementById('formProducto').addEventListener('submit', function (e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const prod = {
        id: id ? parseInt(id) : undefined,
        nombre: document.getElementById('prodNombre').value.trim(),
        categoria: document.getElementById('prodCategoria').value.trim(),
        precio: parseFloat(document.getElementById('prodPrecio').value),
        stock: parseInt(document.getElementById('prodStock').value),
        icono: document.getElementById('prodIcono').value,
        color: document.getElementById('prodColor').value,
        descripcion: ''
    };
    DB.upsertProducto(prod);
    DB.addLog(sesion.nombre, `${id ? 'Actualizó' : 'Creó'} el producto "${prod.nombre}" (stock: ${prod.stock})`);
    bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
    renderAll();
    Swal.fire({ icon: 'success', title: 'Producto guardado', timer: 1500, showConfirmButton: false });
});

/* ==================== CIERRE DE CAJA ==================== */
function renderCaja() {
    const pendientes = DB.facturasSinCerrar();
    const resumen = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Cheque: 0 };
    pendientes.forEach(f => { resumen[f.metodoPago] = (resumen[f.metodoPago] || 0) + f.total; });
    document.getElementById('cajaEfectivo').innerText = `L. ${resumen.Efectivo.toFixed(2)}`;
    document.getElementById('cajaTarjeta').innerText = `L. ${resumen.Tarjeta.toFixed(2)}`;
    document.getElementById('cajaTransferencia').innerText = `L. ${resumen.Transferencia.toFixed(2)}`;
    document.getElementById('cajaCheque').innerText = `L. ${resumen.Cheque.toFixed(2)}`;
    const total = Object.values(resumen).reduce((a, b) => a + b, 0);
    document.getElementById('cajaTotal').innerText = `L. ${total.toFixed(2)}`;
    document.getElementById('cajaNumFacturas').innerText = `${pendientes.length} factura(s) pendientes de cierre.`;

    const tbody = document.getElementById('tablaCierres');
    const cierres = DB.getCierres();
    tbody.innerHTML = cierres.length ? cierres.map(c => `
        <tr><td><small>${c.fecha}<br>${c.hora}</small></td><td><small>${c.usuario}</small></td><td>${c.numFacturas}</td><td class="fw-bold text-success">L. ${c.totalGeneral.toFixed(2)}</td></tr>
    `).join('') : `<tr><td colspan="4" class="text-muted py-3">Sin cierres registrados aún.</td></tr>`;
}

document.getElementById('btnCerrarCaja').addEventListener('click', function () {
    const pendientes = DB.facturasSinCerrar();
    if (pendientes.length === 0) { Swal.fire('Sin movimientos', 'No hay facturas pendientes de cierre en este momento.', 'info'); return; }
    Swal.fire({
        title: '¿Confirmar Cierre de Caja?', text: `Se cerrarán ${pendientes.length} facturas y quedará un registro permanente en el historial.`,
        icon: 'question', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, cerrar caja', cancelButtonText: 'Cancelar'
    }).then(r => {
        if (r.isConfirmed) {
            const cierre = DB.realizarCierreCaja(sesion.nombre);
            renderAll();
            Swal.fire({ icon: 'success', title: 'Caja cerrada exitosamente', html: `Total cerrado: <strong>L. ${cierre.totalGeneral.toFixed(2)}</strong>`, confirmButtonColor: '#059669' });
        }
    });
});

/* ==================== REPORTES ==================== */
let chartTopProductos, chartCategorias;
function renderReportes() {
    const facturas = DB.getFacturas();

    // Top productos
    const conteo = {};
    facturas.forEach(f => f.detalle.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; }));
    const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ctxTop = document.getElementById('chartTopProductos');
    if (chartTopProductos) chartTopProductos.destroy();
    chartTopProductos = new Chart(ctxTop, {
        type: 'bar',
        data: { labels: top.map(t => t[0]), datasets: [{ label: 'Unidades vendidas', data: top.map(t => t[1]), backgroundColor: '#2563eb' }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    });

    // Calificación promedio
    const califs = facturas.filter(f => f.calificacion).map(f => f.calificacion);
    const promedio = califs.length ? (califs.reduce((a, b) => a + b, 0) / califs.length) : 0;
    document.getElementById('promedioEstrellas').innerText = promedio.toFixed(1);
    document.getElementById('estrellasPromedioVisual').innerHTML = '★'.repeat(Math.round(promedio)) + '☆'.repeat(5 - Math.round(promedio));
    document.getElementById('totalReseñasLabel').innerText = `${califs.length} reseña(s) registrada(s)`;

    // Ventas por categoría
    const productos = DB.getProductos();
    const catMap = {};
    productos.forEach(p => catMap[p.nombre] = p.categoria);
    const catTotales = {};
    facturas.forEach(f => f.detalle.forEach(i => {
        const cat = catMap[i.nombre] || 'Otros';
        catTotales[cat] = (catTotales[cat] || 0) + i.subtotal;
    }));
    const ctxCat = document.getElementById('chartCategorias');
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctxCat, {
        type: 'bar',
        data: { labels: Object.keys(catTotales), datasets: [{ label: 'Ventas (L.)', data: Object.values(catTotales), backgroundColor: '#059669' }] },
        options: { plugins: { legend: { display: false } } }
    });
}

/* ==================== OPINIONES ==================== */
function renderOpiniones() {
    const facturas = DB.getFacturas().filter(f => f.calificacion).slice().reverse();
    const cont = document.getElementById('listaOpiniones');
    if (facturas.length === 0) { cont.innerHTML = `<p class="text-muted text-center py-4">Aún no hay opiniones registradas por los clientes.</p>`; return; }
    cont.innerHTML = facturas.map(f => `
        <div class="col-md-6 col-lg-4">
            <div class="panel-card h-100">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong>${f.nombre}</strong><small class="text-muted">${f.fecha}</small>
                </div>
                <div class="text-warning mb-2">${'★'.repeat(f.calificacion)}${'☆'.repeat(5 - f.calificacion)}</div>
                <p class="small text-muted mb-0">${f.comentario ? '"' + f.comentario + '"' : '<em>Sin comentario adicional.</em>'}</p>
            </div>
        </div>`).join('');
}

/* ==================== AUDITORÍA ==================== */
function renderLogs() {
    const logs = DB.getLogs();
    const cont = document.getElementById('logsContainer');
    cont.innerHTML = logs.length ? logs.map(l => `
        <div class="border-bottom py-2"><span class="text-primary">[${l.fecha} ${l.hora}]</span> <strong>${l.usuario}</strong> — ${l.accion}</div>
    `).join('') : `<p class="text-muted text-center py-4">Sin actividad registrada todavía.</p>`;
}
document.getElementById('btnLimpiarLogs').addEventListener('click', function () {
    Swal.fire({
        title: '¿Vaciar bitácora de auditoría?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, limpiar', cancelButtonText: 'Cancelar'
    }).then(r => { if (r.isConfirmed) { DB.limpiarLogs(); renderLogs(); Swal.fire('Bitácora limpiada', '', 'success'); } });
});

/* ==================== CONFIGURACIÓN ==================== */
function renderUsuariosConfig() {
    const tbody = document.getElementById('tablaUsuariosConfig');
    tbody.innerHTML = DB.getUsuarios().map(u => `<tr><td>${u.usuario}</td><td>${u.nombre}</td><td>${u.rol}</td></tr>`).join('');
}
document.getElementById('btnTogglePassConfig').addEventListener('click', function () {
    const input = document.getElementById('nuevaPassword');
    const icon = document.getElementById('iconPassConfig');
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
});
document.getElementById('formCambiarPass').addEventListener('submit', function (e) {
    e.preventDefault();
    const nueva = document.getElementById('nuevaPassword').value;
    const usuarios = DB.getUsuarios();
    const idx = usuarios.findIndex(u => u.usuario === sesion.usuario);
    if (idx >= 0) {
        usuarios[idx].password = nueva;
        DB.saveUsuarios(usuarios);
        DB.addLog(sesion.nombre, 'Actualizó su contraseña de acceso al panel');
        Swal.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 1800, showConfirmButton: false });
        this.reset();
    }
});

/* ---------------------- INIT ---------------------- */
renderAll();
