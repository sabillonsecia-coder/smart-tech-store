/* ==========================================================================
   SMARTTECH STORE — LÓGICA DE TIENDA (store.js)
   ========================================================================== */

let carrito = [];
let categoriaActiva = 'Todos';
let totalFacturaGlobal = 0;
let ultimoFolioGenerado = null;

document.getElementById('fraseTop').innerText = DB.fraseMotivacional();

/* ---------------------- RENDER CATÁLOGO ---------------------- */
function renderFiltros() {
    const productos = DB.getProductos();
    const categorias = ['Todos', ...new Set(productos.map(p => p.categoria))];
    const cont = document.getElementById('filtroCategorias');
    cont.innerHTML = categorias.map(cat => `
        <button class="btn btn-sm ${cat === categoriaActiva ? 'btn-success' : 'btn-outline-secondary'} rounded-pill px-3"
                onclick="filtrarCategoria('${cat}')">${cat}</button>
    `).join('');
}

function filtrarCategoria(cat) {
    categoriaActiva = cat;
    renderFiltros();
    renderCatalogo();
}

function stockBadge(stock) {
    if (stock <= 0) return `<span class="stock-pill stock-out">Agotado</span>`;
    if (stock <= 5) return `<span class="stock-pill stock-low">¡Solo ${stock} en stock!</span>`;
    return `<span class="stock-pill stock-ok">${stock} disponibles</span>`;
}

function renderCatalogo() {
    const productos = DB.getProductos();
    const filtrados = categoriaActiva === 'Todos' ? productos : productos.filter(p => p.categoria === categoriaActiva);
    const cont = document.getElementById('catalogoContainer');

    if (filtrados.length === 0) {
        cont.innerHTML = `<div class="col-12 text-center text-muted py-5">No hay productos en esta categoría.</div>`;
        return;
    }

    cont.innerHTML = filtrados.map(p => `
        <div class="col-6 col-md-4 col-lg-3">
            <div class="product-card">
                <div class="product-media" style="background: linear-gradient(135deg, ${p.color}, ${p.color}cc);">
                    <i class="fa-solid ${p.icono}"></i>
                </div>
                <div class="product-body">
                    <span class="product-cat">${p.categoria}</span>
                    <div class="product-name">${p.nombre}</div>
                    <div class="mb-2">${stockBadge(p.stock)}</div>
                    <div class="product-price mb-2">L. ${p.precio.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    <div class="d-flex gap-2 mt-auto">
                        <input type="number" min="1" max="${p.stock}" value="1" class="form-control form-control-sm" id="qty-${p.id}" style="width: 62px;" ${p.stock <= 0 ? 'disabled' : ''}>
                        <button class="btn btn-success btn-sm flex-grow-1 fw-semibold" onclick="agregarAlCarrito(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-cart-plus me-1"></i>Agregar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/* ---------------------- CARRITO ---------------------- */
function agregarAlCarrito(id) {
    const producto = DB.getProducto(id);
    const qtyInput = document.getElementById('qty-' + id);
    const cantidad = parseInt(qtyInput.value) || 1;

    if (cantidad <= 0) { Swal.fire('Cantidad inválida', 'Ingrese una cantidad mayor a cero.', 'warning'); return; }
    if (cantidad > producto.stock) { Swal.fire('Stock insuficiente', `Solo hay ${producto.stock} unidades disponibles de "${producto.nombre}".`, 'warning'); return; }

    const existente = carrito.find(i => i.id === id);
    const cantidadEnCarrito = existente ? existente.cantidad : 0;
    if (cantidadEnCarrito + cantidad > producto.stock) {
        Swal.fire('Stock insuficiente', `Ya tienes ${cantidadEnCarrito} en el carrito. Solo hay ${producto.stock} en total.`, 'warning');
        return;
    }

    if (existente) { existente.cantidad += cantidad; }
    else { carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: cantidad }); }

    actualizarCarritoUI();
    Swal.fire({ icon: 'success', title: `${producto.nombre} añadido`, toast: true, position: 'top-end', showConfirmButton: false, timer: 1400 });
}

function quitarDelCarrito(id) {
    carrito = carrito.filter(i => i.id !== id);
    actualizarCarritoUI();
}

function cambiarCantidadCarrito(id, valor) {
    const producto = DB.getProducto(id);
    let cant = parseInt(valor);
    if (isNaN(cant) || cant <= 0) { quitarDelCarrito(id); return; }
    if (cant > producto.stock) {
        Swal.fire('Stock insuficiente', `Solo hay ${producto.stock} unidades disponibles.`, 'warning');
        cant = producto.stock;
    }
    const item = carrito.find(i => i.id === id);
    item.cantidad = cant;
    actualizarCarritoUI();
}

function calcularTotales(esTerceraEdad) {
    let subtotal = 0, descuento = 0;
    carrito.forEach(item => {
        const sub = item.precio * item.cantidad;
        subtotal += sub;
        if (esTerceraEdad) descuento += sub * 0.25;
        else if (item.cantidad > 2) descuento += sub * 0.15;
    });
    const base = subtotal - descuento;
    const isv = base * 0.15;
    const total = base + isv;
    return { subtotal, descuento, isv, total };
}

function actualizarCarritoUI() {
    const cantidadTotal = carrito.reduce((s, i) => s + i.cantidad, 0);
    document.getElementById('cartBadge').innerText = cantidadTotal;

    const listaCarrito = document.getElementById('listaCarrito');
    const vacioMsg = document.getElementById('carritoVacioMsg');
    const resumen = document.getElementById('resumenCarrito');

    if (carrito.length === 0) {
        listaCarrito.innerHTML = '';
        vacioMsg.style.display = 'block';
        resumen.style.display = 'none';
        return;
    }
    vacioMsg.style.display = 'none';
    resumen.style.display = 'block';

    listaCarrito.innerHTML = carrito.map(item => `
        <div class="cart-item">
            <div class="d-flex justify-content-between">
                <strong class="small">${item.nombre}</strong>
                <button class="btn btn-sm btn-link text-danger p-0" onclick="quitarDelCarrito(${item.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
                <input type="number" min="1" class="form-control form-control-sm" style="width:64px;" value="${item.cantidad}" onchange="cambiarCantidadCarrito(${item.id}, this.value)">
                <span class="fw-bold text-success">L. ${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    const t = calcularTotales(false);
    document.getElementById('cSubtotal').innerText = `L. ${t.subtotal.toFixed(2)}`;
    document.getElementById('cDescuento').innerText = `-L. ${t.descuento.toFixed(2)}`;
    document.getElementById('cIsv').innerText = `L. ${t.isv.toFixed(2)}`;
    document.getElementById('cTotal').innerText = `L. ${t.total.toFixed(2)}`;
}

/* ---------------------- CHECKOUT ---------------------- */
const dniInput = () => document.getElementById('dni');
const terceraEdadCheck = () => document.getElementById('terceraEdad');
const errorEdadDiv = () => document.getElementById('errorEdad');
const metodoPago = () => document.getElementById('metodoPago');
const pagaCon = () => document.getElementById('pagaCon');
const cambioVuelto = () => document.getElementById('cambioVuelto');
const tipoEntrega = () => document.getElementById('tipoEntrega');

function abrirCheckout() {
    if (carrito.length === 0) { Swal.fire('Carrito vacío', 'Agrega al menos un producto antes de continuar.', 'info'); return; }
    renderTablaCheckout();
    new bootstrap.Modal(document.getElementById('modalCheckout')).show();
}

function renderTablaCheckout() {
    const esTerceraEdad = terceraEdadCheck().checked && !terceraEdadCheck().disabled;
    const tbody = document.getElementById('tablaResumenCheckout');
    tbody.innerHTML = carrito.map(item => `
        <tr><td class="text-start">${item.nombre}</td><td>L. ${item.precio.toFixed(2)}</td><td>${item.cantidad}</td><td>L. ${(item.precio * item.cantidad).toFixed(2)}</td></tr>
    `).join('');
    const t = calcularTotales(esTerceraEdad);
    totalFacturaGlobal = t.total;
    document.getElementById('rSubtotal').innerText = `L. ${t.subtotal.toFixed(2)}`;
    document.getElementById('rDescuento').innerText = `-L. ${t.descuento.toFixed(2)}`;
    document.getElementById('rIsv').innerText = `L. ${t.isv.toFixed(2)}`;
    document.getElementById('rTotal').innerText = `L. ${t.total.toFixed(2)}`;
    pagaCon().dispatchEvent(new Event('input'));
}

document.getElementById('dni').addEventListener('input', function () {
    const val = this.value.replace(/[^0-9]/g, '');
    if (val.length >= 8) {
        const anioNacimiento = parseInt(val.substring(4, 8));
        const edad = new Date().getFullYear() - anioNacimiento;
        if (edad < 60 || isNaN(edad)) {
            terceraEdadCheck().checked = false; terceraEdadCheck().disabled = true; errorEdadDiv().style.display = 'block';
        } else {
            terceraEdadCheck().disabled = false; errorEdadDiv().style.display = 'none';
        }
    } else {
        terceraEdadCheck().checked = false; terceraEdadCheck().disabled = true; errorEdadDiv().style.display = 'none';
    }
    renderTablaCheckout();
});
document.getElementById('terceraEdad').addEventListener('change', renderTablaCheckout);

document.getElementById('tipoEntrega').addEventListener('change', function () {
    document.getElementById('contenedorDireccion').style.display = this.value === 'Domicilio' ? 'block' : 'none';
    document.getElementById('direccion').required = this.value === 'Domicilio';
});

document.getElementById('metodoPago').addEventListener('change', function () {
    const map = {
        Efectivo: ['contenedorPagaCon', 'contenedorCambio'],
        Tarjeta: ['contenedorTarjeta'],
        Transferencia: ['contenedorTransferencia'],
        Cheque: ['contenedorCheque', 'contenedorChequeBanco']
    };
    ['contenedorPagaCon', 'contenedorCambio', 'contenedorTarjeta', 'contenedorTransferencia', 'contenedorCheque', 'contenedorChequeBanco'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    (map[this.value] || []).forEach(id => document.getElementById(id).style.display = 'block');
});

document.getElementById('pagaCon').addEventListener('input', function () {
    const monto = parseFloat(this.value) || 0;
    if (monto >= totalFacturaGlobal && totalFacturaGlobal > 0) {
        cambioVuelto().value = `L. ${(monto - totalFacturaGlobal).toFixed(2)}`;
        cambioVuelto().className = 'form-control fw-bold text-success';
    } else {
        cambioVuelto().value = monto > 0 ? 'Insuficiente' : 'L. 0.00';
        cambioVuelto().className = 'form-control fw-bold text-danger';
    }
});

document.getElementById('formCheckout').addEventListener('submit', function (e) {
    e.preventDefault();

    // Verificación de stock en tiempo real antes de procesar
    for (const item of carrito) {
        const prod = DB.getProducto(item.id);
        if (!prod || item.cantidad > prod.stock) {
            Swal.fire('Stock insuficiente', `El producto "${item.nombre}" ya no tiene suficiente inventario disponible.`, 'error');
            return;
        }
    }

    if (metodoPago().value === 'Efectivo') {
        const entregado = parseFloat(pagaCon().value) || 0;
        if (entregado < totalFacturaGlobal) {
            Swal.fire('Cobro denegado', 'El efectivo entregado es menor al total de la factura.', 'error');
            return;
        }
    }
    if (tipoEntrega().value === 'Domicilio' && !document.getElementById('direccion').value.trim()) {
        Swal.fire('Falta la dirección', 'Indica la dirección de entrega a domicilio.', 'warning');
        return;
    }

    const esTerceraEdad = terceraEdadCheck().checked && !terceraEdadCheck().disabled;
    const t = calcularTotales(esTerceraEdad);

    const detallePago = {};
    if (metodoPago().value === 'Efectivo') { detallePago.entregado = parseFloat(pagaCon().value) || t.total; detallePago.cambio = detallePago.entregado - t.total; }
    if (metodoPago().value === 'Tarjeta') { detallePago.digitos = document.getElementById('tarjetaDigitos').value; }
    if (metodoPago().value === 'Transferencia') { detallePago.referencia = document.getElementById('transferenciaRef').value; }
    if (metodoPago().value === 'Cheque') { detallePago.numero = document.getElementById('chequeNumero').value; detallePago.banco = document.getElementById('chequeBanco').value; }

    const factura = {
        dni: document.getElementById('dni').value,
        nombre: document.getElementById('nombre').value,
        email: document.getElementById('email').value,
        celular: document.getElementById('celular').value,
        terceraEdad: esTerceraEdad,
        tipoEntrega: tipoEntrega().value,
        direccion: document.getElementById('direccion').value || '',
        metodoPago: metodoPago().value,
        detallePago: detallePago,
        detalle: carrito.map(i => ({ productoId: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, subtotal: i.precio * i.cantidad })),
        subtotal: t.subtotal, descuento: t.descuento, impuesto: t.isv, total: t.total,
        fecha: new Date().toLocaleDateString('es-HN'), hora: new Date().toLocaleTimeString('es-HN')
    };

    const nueva = DB.crearFactura(factura);
    carrito.forEach(i => DB.descontarStock(i.id, i.cantidad));
    DB.addLog(factura.nombre || 'Cliente POS', `Registró la factura ${nueva.folio} por L. ${t.total.toFixed(2)} (${factura.metodoPago})`);

    ultimoFolioGenerado = nueva.folio;
    mostrarTicket(nueva);

    carrito = [];
    actualizarCarritoUI();
    renderCatalogo();
    renderHistorial();

    bootstrap.Modal.getInstance(document.getElementById('modalCheckout')).hide();
});

/* ---------------------- TICKET ---------------------- */
function mostrarTicket(f) {
    document.getElementById('reciboFolio').innerText = f.folio;
    document.getElementById('reciboFecha').innerText = f.fecha;
    document.getElementById('reciboHora').innerText = f.hora;
    document.getElementById('reciboCliente').innerText = f.nombre;
    document.getElementById('reciboDni').innerText = f.dni;
    document.getElementById('reciboEntrega').innerText = f.tipoEntrega + (f.direccion ? ' — ' + f.direccion : '');
    document.getElementById('reciboMetodo').innerText = f.metodoPago;

    const cuerpo = document.getElementById('reciboCuerpoTabla');
    cuerpo.innerHTML = f.detalle.map(i => `
        <tr><td>${i.nombre}<br><small class="text-muted">L. ${i.precio.toFixed(2)} c/u</small></td><td class="text-center">${i.cantidad}</td><td class="text-end">L. ${i.subtotal.toFixed(2)}</td></tr>
    `).join('');

    document.getElementById('reciboSubtotal').innerText = `L. ${f.subtotal.toFixed(2)}`;
    document.getElementById('reciboDescuento').innerText = `-L. ${f.descuento.toFixed(2)}`;
    document.getElementById('reciboIsv').innerText = `L. ${f.impuesto.toFixed(2)}`;
    document.getElementById('reciboTotal').innerText = `L. ${f.total.toFixed(2)}`;
    document.getElementById('reciboEntregado').innerText = f.metodoPago === 'Efectivo' ? `L. ${f.detallePago.entregado.toFixed(2)}` : `L. ${f.total.toFixed(2)}`;
    document.getElementById('reciboVueltoFinal').innerText = f.metodoPago === 'Efectivo' ? `L. ${f.detallePago.cambio.toFixed(2)}` : 'L. 0.00';
    document.getElementById('reciboFrase').innerText = DB.fraseMotivacional();

    new bootstrap.Modal(document.getElementById('modalFactura')).show();
}

document.getElementById('btnCerrarTicket').addEventListener('click', function () {
    setTimeout(() => { new bootstrap.Modal(document.getElementById('modalResenia')).show(); }, 350);
});

/* ---------------------- RESEÑA ---------------------- */
let calificacionSeleccionada = 0;
document.querySelectorAll('#starRating i').forEach(star => {
    star.addEventListener('mouseenter', () => pintarEstrellas(parseInt(star.dataset.val)));
    star.addEventListener('mouseleave', () => pintarEstrellas(calificacionSeleccionada));
    star.addEventListener('click', () => { calificacionSeleccionada = parseInt(star.dataset.val); pintarEstrellas(calificacionSeleccionada); });
});
function pintarEstrellas(n) {
    document.querySelectorAll('#starRating i').forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= n));
}

function cerrarFlujoResenia() {
    bootstrap.Modal.getInstance(document.getElementById('modalResenia')).hide();
    document.getElementById('formCheckout').reset();
    calificacionSeleccionada = 0; pintarEstrellas(0);
    document.getElementById('comentarioResenia').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btnEnviarResenia').addEventListener('click', function () {
    if (!ultimoFolioGenerado) { cerrarFlujoResenia(); return; }
    const comentario = document.getElementById('comentarioResenia').value.trim();
    DB.guardarResenia(ultimoFolioGenerado, calificacionSeleccionada || 5, comentario);
    Swal.fire({ icon: 'success', title: '¡Gracias por tu opinión!', text: 'Valoramos mucho que uses nuestro sistema de compra. Tu experiencia nos ayuda a mejorar cada día.', confirmButtonColor: '#059669' })
        .then(cerrarFlujoResenia);
});
document.getElementById('btnOmitirResenia').addEventListener('click', cerrarFlujoResenia);

/* ---------------------- HISTORIAL DE PEDIDOS ---------------------- */
function renderHistorial(filtro) {
    const tbody = document.querySelector('#tablaClientesHistorial tbody');
    let facturas = DB.getFacturas().slice().reverse();
    if (filtro) {
        const f = filtro.toLowerCase();
        facturas = facturas.filter(x => x.dni.toLowerCase().includes(f) || x.nombre.toLowerCase().includes(f));
    }
    if (facturas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-3">No hay pedidos registrados todavía.</td></tr>`;
        return;
    }
    tbody.innerHTML = facturas.map(f => `
        <tr>
            <td class="fw-bold small">${f.folio}</td>
            <td class="text-start">${f.nombre}</td>
            <td><small>${f.fecha}<br>${f.hora}</small></td>
            <td class="text-start small text-muted">${f.detalle.map(i => `${i.nombre} (x${i.cantidad})`).join(', ')}</td>
            <td class="fw-bold text-success">L. ${f.total.toFixed(2)}</td>
            <td><small>${f.metodoPago}</small></td>
            <td><span class="badge-estado badge-${f.estadoPedido}">${f.estadoPedido}</span></td>
        </tr>
    `).join('');
}
document.getElementById('buscarDniHistorial').addEventListener('input', function () { renderHistorial(this.value); });

/* ---------------------- INIT ---------------------- */
renderFiltros();
renderCatalogo();
actualizarCarritoUI();
renderHistorial();
