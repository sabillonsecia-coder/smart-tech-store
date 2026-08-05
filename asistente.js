/* ==========================================================================
   SMARTTECH STORE — MÚSICA AMBIENTAL + ASISTENTE DE VOZ (asistente.js)
   --------------------------------------------------------------------------
   Dos módulos independientes:

   1) MusicaAmbiental: genera un pad musical suave y continuo con el
      Web Audio API (osciladores en tiempo real). No usa ningún archivo
      de audio externo, así que no hay problema de derechos de autor ni
      de tener que subir un .mp3 — funciona apenas se abre la página.

   2) Asistente: un asistente de compras por voz. Usa las APIs nativas
      del navegador (no necesita ninguna llave ni servicio de pago):
        - SpeechRecognition   -> convierte lo que dices en texto
        - SpeechSynthesis     -> hace que el asistente te responda hablando
      Entiende comandos como "agregar laptop", "quiero unos audífonos",
      "abrir el carrito", "vaciar carrito" y "cómo funciona".

   Requiere Google Chrome o Microsoft Edge para el reconocimiento de voz
   (es la limitación del navegador, no del código: Firefox y Safari
   todavía no implementan SpeechRecognition). La música y el botón de
   silenciar funcionan en cualquier navegador.
   ========================================================================== */

/* =========================================================================
   1) MÚSICA AMBIENTAL DE FONDO
   ========================================================================= */
const MusicaAmbiental = (function () {
    let contexto = null;
    let nodos = [];
    let sonando = false;
    let silenciado = localStorage.getItem('stt_musica_muted') === 'true';

    // Acordes suaves en La menor (Am - F - C - G), típico de música "lofi"
    // relajante, tocados en bucle con osciladores tipo "sine/triangle".
    const ACORDES = [
        [220.00, 261.63, 329.63],   // A3, C4, E4  (Am)
        [174.61, 220.00, 261.63],   // F3, A3, C4  (F)
        [130.81, 164.81, 196.00],   // C3, E3, G3  (C)
        [196.00, 246.94, 293.66]    // G3, B3, D4  (G)
    ];
    const DURACION_ACORDE = 4.2; // segundos
    let indiceAcorde = 0;
    let temporizador = null;

    function crearContextoSiHaceFalta() {
        if (!contexto) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            contexto = new AC();
        }
        return true;
    }

    function tocarAcorde(frecuencias) {
        const ahora = contexto.currentTime;
        frecuencias.forEach(function (frecuencia, i) {
            const osc = contexto.createOscillator();
            const gain = contexto.createGain();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = frecuencia;

            // Entrada y salida suaves (fade in/out) para que no truene ni chasquee
            gain.gain.setValueAtTime(0, ahora);
            gain.gain.linearRampToValueAtTime(0.045, ahora + 1.2);
            gain.gain.linearRampToValueAtTime(0, ahora + DURACION_ACORDE);

            osc.connect(gain);
            gain.connect(contexto.destination);
            osc.start(ahora);
            osc.stop(ahora + DURACION_ACORDE + 0.1);
            nodos.push(osc);
        });
    }

    function cicloMusical() {
        if (!sonando || silenciado) return;
        tocarAcorde(ACORDES[indiceAcorde]);
        indiceAcorde = (indiceAcorde + 1) % ACORDES.length;
        temporizador = setTimeout(cicloMusical, DURACION_ACORDE * 1000 * 0.92);
    }

    function iniciar() {
        if (!crearContextoSiHaceFalta()) return;
        if (contexto.state === 'suspended') contexto.resume();
        if (sonando) return;
        sonando = true;
        if (!silenciado) cicloMusical();
    }

    function alternarSilencio() {
        silenciado = !silenciado;
        localStorage.setItem('stt_musica_muted', String(silenciado));
        if (!silenciado && sonando) {
            cicloMusical();
        } else if (temporizador) {
            clearTimeout(temporizador);
        }
        return silenciado;
    }

    function estaSilenciado() { return silenciado; }

    return { iniciar, alternarSilencio, estaSilenciado };
})();


/* =========================================================================
   2) ASISTENTE DE VOZ
   ========================================================================= */
const Asistente = (function () {
    let reconocimiento = null;
    let escuchando = false;
    let vozSilenciada = localStorage.getItem('stt_asistente_muted') === 'true';
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const soportado = !!SpeechRecognitionAPI && 'speechSynthesis' in window;

    /* ---------------- Utilidades de texto ---------------- */
    function normalizar(texto) {
        return (texto || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
            .replace(/[^a-z0-9\s]/g, ' ')
            .trim();
    }

    /* ---------------- Hablar (texto a voz) ---------------- */
    function hablar(texto, callback) {
        actualizarBurbuja(texto);
        if (vozSilenciada || !('speechSynthesis' in window)) {
            if (callback) setTimeout(callback, 400);
            return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 1.02;
        u.pitch = 1.05;
        if (callback) u.onend = callback;
        window.speechSynthesis.speak(u);
    }

    function alternarVoz() {
        vozSilenciada = !vozSilenciada;
        localStorage.setItem('stt_asistente_muted', String(vozSilenciada));
        if (vozSilenciada) window.speechSynthesis.cancel();
        return vozSilenciada;
    }

    /* ---------------- Buscar producto por voz (coincidencia difusa) ---------------- */
    function buscarProductoPorTexto(textoOido) {
        const dicho = normalizar(textoOido);
        const palabrasDichas = dicho.split(/\s+/).filter(function (p) { return p.length > 2; });
        const productos = DB.getProductos();

        let mejor = null;
        let mejorPuntaje = 0;

        productos.forEach(function (p) {
            const nombreNorm = normalizar(p.nombre + ' ' + p.categoria);
            let puntaje = 0;
            palabrasDichas.forEach(function (palabra) {
                if (nombreNorm.indexOf(palabra) !== -1) puntaje++;
            });
            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejor = p;
            }
        });

        return mejorPuntaje > 0 ? mejor : null;
    }

    /* ---------------- Interpretar el comando dicho ---------------- */
    function procesarComando(textoOido) {
        const dicho = normalizar(textoOido);

        if (/ayuda|instruccion|como (uso|funciona|se usa)/.test(dicho)) {
            explicarUso();
            return;
        }

        if (/(abrir|ver|mostrar).*carrito/.test(dicho)) {
            const off = new bootstrap.Offcanvas(document.getElementById('offcanvasCarrito'));
            off.show();
            hablar('Aquí tienes tu carrito.');
            return;
        }

        if (/vaciar.*carrito|limpiar.*carrito/.test(dicho)) {
            carrito = [];
            actualizarCarritoUI();
            hablar('Listo, vacié tu carrito.');
            return;
        }

        if (/pagar|finalizar|checkout|comprar ya/.test(dicho)) {
            abrirCheckout();
            hablar('Perfecto, vamos a finalizar tu compra.');
            return;
        }

        // Si no fue un comando especial, intentamos interpretarlo como un producto
        const producto = buscarProductoPorTexto(dicho);
        if (producto) {
            if (producto.stock <= 0) {
                hablar('Lo siento, ' + producto.nombre + ' está agotado en este momento.');
                return;
            }
            agregarAlCarrito(producto.id);
            hablar('Agregué ' + producto.nombre + ' a tu carrito, por ' + producto.precio.toLocaleString('es-HN') + ' lempiras.');
        } else {
            hablar('No encontré ese producto. Puedes decir, por ejemplo: agregar una laptop, o, quiero unos audífonos.');
        }
    }

    /* ---------------- Instrucciones de uso (habladas) ---------------- */
    function explicarUso() {
        hablar(
            'Así se usa el asistente de SmartTech Store. Presiona el micrófono y dime qué producto quieres, ' +
            'por ejemplo: agregar una laptop, o quiero un mouse gamer. ' +
            'También puedes decirme: abrir el carrito, vaciar el carrito, o finalizar compra. ' +
            'Usa el botón de la bocina para silenciarme cuando quieras.'
        );
    }

    /* ---------------- Reconocimiento de voz (escuchar al usuario) ---------------- */
    function iniciarEscucha() {
        if (!soportado) {
            Swal.fire('No disponible', 'Tu navegador no soporta reconocimiento de voz. Usa Google Chrome o Microsoft Edge para hablarle al asistente.', 'info');
            return;
        }
        if (escuchando) return;

        if (!reconocimiento) {
            reconocimiento = new SpeechRecognitionAPI();
            reconocimiento.lang = 'es-ES';
            reconocimiento.continuous = false;
            reconocimiento.interimResults = false;

            reconocimiento.onstart = function () {
                escuchando = true;
                actualizarEstadoMic(true);
                actualizarBurbuja('🎙️ Te escucho...');
            };
            reconocimiento.onerror = function () {
                escuchando = false;
                actualizarEstadoMic(false);
                actualizarBurbuja('No logré escucharte bien. Intenta de nuevo.');
            };
            reconocimiento.onend = function () {
                escuchando = false;
                actualizarEstadoMic(false);
            };
            reconocimiento.onresult = function (evento) {
                const texto = evento.results[0][0].transcript;
                actualizarBurbuja('🗣️ "' + texto + '"');
                procesarComando(texto);
            };
        }

        try { reconocimiento.start(); } catch (e) { /* ya estaba escuchando */ }
    }

    /* ---------------- UI helpers (burbuja de texto y estado del botón) ---------------- */
    function actualizarBurbuja(texto) {
        const burbuja = document.getElementById('asistenteBurbuja');
        if (burbuja) burbuja.textContent = texto;
    }

    function actualizarEstadoMic(activo) {
        const btn = document.getElementById('btnAsistenteMic');
        if (btn) btn.classList.toggle('mic-activo', activo);
    }

    function bienvenida() {
        if (!soportado) {
            actualizarBurbuja('Este navegador no soporta el reconocimiento de voz. Puedes usar el catálogo normalmente 🙂');
            return;
        }
        hablar('Hola, soy tu asistente de SmartTech Store. Presiona el micrófono y pide el producto que buscas.');
    }

    return { iniciarEscucha, alternarVoz, explicarUso, bienvenida, hablar, estaSilenciado: function () { return vozSilenciada; }, soportado: soportado };
})();


/* =========================================================================
   3) CONEXIÓN CON LOS BOTONES DE LA PÁGINA (portada, música, asistente)
   ========================================================================= */
document.addEventListener('DOMContentLoaded', function () {

    /* ---- Portada de bienvenida ---- */
    const portada = document.getElementById('portadaInicio');
    const btnEntrar = document.getElementById('btnEntrarTienda');
    if (btnEntrar) {
        btnEntrar.addEventListener('click', function () {
            portada.classList.add('portada-oculta');
            MusicaAmbiental.iniciar();
            setTimeout(function () { portada.style.display = 'none'; }, 700);
            setTimeout(function () { Asistente.bienvenida(); }, 900);
        });
    }

    /* ---- Botón flotante: silenciar música ---- */
    const btnMusica = document.getElementById('btnMusica');
    if (btnMusica) {
        function pintarBotonMusica() {
            const silenciada = MusicaAmbiental.estaSilenciado();
            btnMusica.innerHTML = silenciada
                ? '<i class="fa-solid fa-volume-xmark"></i>'
                : '<i class="fa-solid fa-music"></i>';
            btnMusica.title = silenciada ? 'Activar música de fondo' : 'Silenciar música de fondo';
        }
        pintarBotonMusica();
        btnMusica.addEventListener('click', function () {
            MusicaAmbiental.alternarSilencio();
            pintarBotonMusica();
        });
    }

    /* ---- Panel del asistente: abrir/cerrar ---- */
    const btnAbrirAsistente = document.getElementById('btnAbrirAsistente');
    const panelAsistente = document.getElementById('panelAsistente');
    const btnCerrarAsistente = document.getElementById('btnCerrarAsistente');
    if (btnAbrirAsistente && panelAsistente) {
        btnAbrirAsistente.addEventListener('click', function () {
            panelAsistente.classList.toggle('panel-abierto');
        });
    }
    if (btnCerrarAsistente) {
        btnCerrarAsistente.addEventListener('click', function () {
            panelAsistente.classList.remove('panel-abierto');
        });
    }

    /* ---- Botón del micrófono ---- */
    const btnMic = document.getElementById('btnAsistenteMic');
    if (btnMic) {
        btnMic.addEventListener('click', function () { Asistente.iniciarEscucha(); });
    }

    /* ---- Botón: silenciar la VOZ del asistente ---- */
    const btnSilenciarAsistente = document.getElementById('btnSilenciarAsistente');
    if (btnSilenciarAsistente) {
        function pintarBotonVoz() {
            const silenciado = Asistente.estaSilenciado();
            btnSilenciarAsistente.innerHTML = silenciado
                ? '<i class="fa-solid fa-microphone-slash"></i>'
                : '<i class="fa-solid fa-volume-high"></i>';
            btnSilenciarAsistente.title = silenciado ? 'Activar voz del asistente' : 'Silenciar voz del asistente';
        }
        pintarBotonVoz();
        btnSilenciarAsistente.addEventListener('click', function () {
            Asistente.alternarVoz();
            pintarBotonVoz();
        });
    }

    /* ---- Botón: "¿Cómo se usa?" ---- */
    const btnComoUsar = document.getElementById('btnComoUsar');
    if (btnComoUsar) {
        btnComoUsar.addEventListener('click', function () { Asistente.explicarUso(); });
    }

    /* Si no hay portada en esta página (ej. admin), arrancamos la música directo */
    if (!portada) MusicaAmbiental.iniciar();
});
