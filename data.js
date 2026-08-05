/* ==========================================================================
   SMARTTECH STORE — CAPA DE DATOS (data.js)
   Simula el backend/base de datos (tablas: productos, facturas,
   detalle_facturas, clientes, usuarios) usando localStorage como motor
   de persistencia. Todas las páginas (tienda y administración) comparten
   este mismo módulo para mantener la información 100% sincronizada.
   ========================================================================== */

const DB = (function () {

    const KEYS = {
        PRODUCTOS: 'stt_productos',
        FACTURAS: 'stt_facturas',
        CIERRES: 'stt_cierres',
        LOGS: 'stt_logs',
        USUARIOS: 'stt_usuarios',
        SESION: 'stt_sesion',
        FOLIO: 'stt_folio_seq'
    };

    /* ---------------------------------------------------------------
       SEMILLA INICIAL (solo se ejecuta si el navegador nunca ha
       guardado información — así "electronica_store" nace poblada,
       igual que la base de datos que administras en phpMyAdmin).
       --------------------------------------------------------------- */
    const PRODUCTOS_SEED = [
        { id: 1, nombre: 'Laptop Asus ROG Strix i7', categoria: 'Laptops', precio: 29500, stock: 8, icono: 'fa-laptop', color: '#2563eb', descripcion: 'Core i7, 16GB RAM, RTX 4060, 512GB SSD.' },
        { id: 2, nombre: 'Smartphone Galaxy S24 Ultra', categoria: 'Celulares', precio: 21000, stock: 15, icono: 'fa-mobile-screen-button', color: '#7c3aed', descripcion: 'Pantalla AMOLED 6.8", 256GB, cámara 200MP.' },
        { id: 3, nombre: 'Teclado Mecánico Corsair RGB', categoria: 'Accesorios', precio: 1850, stock: 25, icono: 'fa-keyboard', color: '#059669', descripcion: 'Switches rojos, retroiluminación RGB por tecla.' },
        { id: 4, nombre: 'Monitor LG UltraGear 27"', categoria: 'Monitores', precio: 7900, stock: 6, icono: 'fa-desktop', color: '#d97706', descripcion: '165Hz, 1ms, panel IPS QHD.' },
        { id: 5, nombre: 'Audífonos HyperX Cloud II', categoria: 'Accesorios', precio: 2700, stock: 20, icono: 'fa-headphones', color: '#db2777', descripcion: 'Sonido envolvente 7.1, micrófono desmontable.' },
        { id: 6, nombre: 'Mouse Logitech G502 Hero', categoria: 'Accesorios', precio: 1200, stock: 3, icono: 'fa-computer-mouse', color: '#0891b2', descripcion: '25,600 DPI, 11 botones programables.' },
        { id: 7, nombre: 'Tablet iPad Air 10.9"', categoria: 'Tablets', precio: 15500, stock: 4, icono: 'fa-tablet-screen-button', color: '#4f46e5', descripcion: 'Chip M1, 64GB, compatible con Apple Pencil.' },
        { id: 8, nombre: 'Impresora HP LaserJet Pro', categoria: 'Oficina', precio: 5300, stock: 10, icono: 'fa-print', color: '#65a30d', descripcion: 'Multifuncional, impresión dúplex automática.' }
    ];

    const USUARIOS_SEED = [
        { usuario: 'admin', password: 'admin123', nombre: 'Administrador General', rol: 'Administrador' },
        { usuario: 'cajero', password: 'cajero123', nombre: 'Cajero de Turno', rol: 'Cajero' }
    ];

    function _get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function _set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function init() {
        if (localStorage.getItem(KEYS.PRODUCTOS) === null) _set(KEYS.PRODUCTOS, PRODUCTOS_SEED);
        if (localStorage.getItem(KEYS.FACTURAS) === null) _set(KEYS.FACTURAS, []);
        if (localStorage.getItem(KEYS.CIERRES) === null) _set(KEYS.CIERRES, []);
        if (localStorage.getItem(KEYS.LOGS) === null) _set(KEYS.LOGS, []);
        if (localStorage.getItem(KEYS.USUARIOS) === null) _set(KEYS.USUARIOS, USUARIOS_SEED);
        if (localStorage.getItem(KEYS.FOLIO) === null) _set(KEYS.FOLIO, 1000);
    }
    init();

    /* ---------------------- PRODUCTOS ---------------------- */
    function getProductos() { return _get(KEYS.PRODUCTOS, []); }
    function saveProductos(arr) { _set(KEYS.PRODUCTOS, arr); }
    function getProducto(id) { return getProductos().find(p => p.id === id); }

    function upsertProducto(prod) {
        const lista = getProductos();
        if (prod.id) {
            const idx = lista.findIndex(p => p.id === prod.id);
            if (idx >= 0) { lista[idx] = { ...lista[idx], ...prod }; }
        } else {
            const nuevoId = lista.length ? Math.max(...lista.map(p => p.id)) + 1 : 1;
            prod.id = nuevoId;
            lista.push(prod);
        }
        saveProductos(lista);
        return prod;
    }

    function eliminarProducto(id) {
        saveProductos(getProductos().filter(p => p.id !== id));
    }

    function descontarStock(id, cantidad) {
        const lista = getProductos();
        const p = lista.find(x => x.id === id);
        if (p) { p.stock = Math.max(0, p.stock - cantidad); saveProductos(lista); }
    }

    function reponerStock(id, cantidad) {
        const lista = getProductos();
        const p = lista.find(x => x.id === id);
        if (p) { p.stock = p.stock + cantidad; saveProductos(lista); }
    }

    /* ---------------------- FOLIO ---------------------- */
    function siguienteFolio() {
        let n = _get(KEYS.FOLIO, 1000);
        n += 1;
        _set(KEYS.FOLIO, n);
        return 'FAC-' + String(n).padStart(6, '0');
    }

    /* ---------------------- FACTURAS ---------------------- */
    function getFacturas() { return _get(KEYS.FACTURAS, []); }
    function saveFacturas(arr) { _set(KEYS.FACTURAS, arr); }

    function crearFactura(factura) {
        const lista = getFacturas();
        factura.folio = siguienteFolio();
        factura.timestamp = Date.now();
        factura.estadoPedido = factura.estadoPedido || 'Pendiente';
        factura.cerrada = false;
        lista.push(factura);
        saveFacturas(lista);
        return factura;
    }

    function actualizarFactura(folio, cambios, autor) {
        const lista = getFacturas();
        const idx = lista.findIndex(f => f.folio === folio);
        if (idx >= 0) {
            lista[idx] = { ...lista[idx], ...cambios };
            lista[idx].editadoPor = autor || 'Sistema';
            lista[idx].fechaEdicion = new Date().toLocaleString('es-HN');
            saveFacturas(lista);
            return lista[idx];
        }
        return null;
    }

    function eliminarFactura(folio) {
        saveFacturas(getFacturas().filter(f => f.folio !== folio));
    }

    function actualizarEstadoPedido(folio, estado, autor) {
        return actualizarFactura(folio, { estadoPedido: estado }, autor);
    }

    function guardarResenia(folio, calificacion, comentario) {
        return actualizarFactura(folio, { calificacion, comentario, reseniaFecha: new Date().toLocaleString('es-HN') });
    }

    /* ---------------------- CIERRES DE CAJA ---------------------- */
    function getCierres() { return _get(KEYS.CIERRES, []); }
    function saveCierres(arr) { _set(KEYS.CIERRES, arr); }

    function facturasSinCerrar() {
        return getFacturas().filter(f => !f.cerrada);
    }

    function realizarCierreCaja(autor) {
        const pendientes = facturasSinCerrar();
        if (pendientes.length === 0) return null;

        const resumen = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Cheque: 0 };
        pendientes.forEach(f => {
            resumen[f.metodoPago] = (resumen[f.metodoPago] || 0) + f.total;
        });
        const totalGeneral = pendientes.reduce((s, f) => s + f.total, 0);

        const cierre = {
            id: 'CIERRE-' + Date.now(),
            fecha: new Date().toLocaleDateString('es-HN'),
            hora: new Date().toLocaleTimeString('es-HN'),
            usuario: autor || 'Administrador',
            totalEfectivo: resumen.Efectivo,
            totalTarjeta: resumen.Tarjeta,
            totalTransferencia: resumen.Transferencia,
            totalCheque: resumen.Cheque,
            totalGeneral: totalGeneral,
            numFacturas: pendientes.length
        };

        const cierres = getCierres();
        cierres.unshift(cierre);
        saveCierres(cierres);

        const lista = getFacturas().map(f => pendientes.find(p => p.folio === f.folio) ? { ...f, cerrada: true, cierreId: cierre.id } : f);
        saveFacturas(lista);

        addLog(autor, `Realizó CIERRE DE CAJA — ${pendientes.length} factura(s), total L. ${totalGeneral.toFixed(2)}`);
        return cierre;
    }

    /* ---------------------- LOGS DE AUDITORÍA ---------------------- */
    function getLogs() { return _get(KEYS.LOGS, []); }
    function addLog(usuario, accion) {
        const logs = getLogs();
        logs.unshift({
            fecha: new Date().toLocaleDateString('es-HN'),
            hora: new Date().toLocaleTimeString('es-HN'),
            usuario: usuario || 'Sistema',
            accion
        });
        _set(KEYS.LOGS, logs.slice(0, 300));
    }
    function limpiarLogs() { _set(KEYS.LOGS, []); }

    /* ---------------------- USUARIOS / SESIÓN ---------------------- */
    function getUsuarios() { return _get(KEYS.USUARIOS, []); }
    function saveUsuarios(arr) { _set(KEYS.USUARIOS, arr); }
    function validarLogin(usuario, password) {
        return getUsuarios().find(u => u.usuario.toLowerCase() === String(usuario).toLowerCase() && u.password === password);
    }
    function iniciarSesion(usuario) {
        _set(KEYS.SESION, { usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol, ts: Date.now() });
    }
    function cerrarSesion() { sessionStorage.removeItem(KEYS.SESION); localStorage.removeItem(KEYS.SESION); }
    function sesionActiva() { return _get(KEYS.SESION, null); }

    /* ---------------------- FRASES MOTIVACIONALES ---------------------- */
    const FRASES = [
        '“Gracias por confiar en nosotros: cada compra tuya impulsa nuestros sueños.”',
        '“Hoy invertiste en tecnología… y nosotros invertimos en darte el mejor servicio.”',
        '“Un cliente feliz es la mejor publicidad. ¡Gracias por ser parte de SmartTech!”',
        '“El éxito de una empresa se mide en sonrisas como la tuya. ¡Vuelve pronto!”',
        '“Cada factura cuenta una historia de confianza. Gracias por escribir la tuya con nosotros.”',
        '“Detrás de cada compra hay un sueño que ayudamos a cumplir. ¡Gracias por elegirnos!”',
        '“La tecnología conecta el mundo, y tú acabas de conectarte con la excelencia.”',
        '“Gracias por tu compra: pequeñas decisiones como esta construyen grandes negocios.”'
    ];
    function fraseMotivacional() {
        return FRASES[Math.floor(Math.random() * FRASES.length)];
    }

    return {
        getProductos, saveProductos, getProducto, upsertProducto, eliminarProducto,
        descontarStock, reponerStock,
        getFacturas, saveFacturas, crearFactura, actualizarFactura, eliminarFactura,
        actualizarEstadoPedido, guardarResenia,
        getCierres, facturasSinCerrar, realizarCierreCaja,
        getLogs, addLog, limpiarLogs,
        getUsuarios, saveUsuarios, validarLogin, iniciarSesion, cerrarSesion, sesionActiva,
        fraseMotivacional
    };
})();
