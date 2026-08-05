document.getElementById('formLoginAdmin').addEventListener('submit', function (e) {
    e.preventDefault();

    const usuario = document.getElementById('usuarioAdmin').value.trim();
    const pass = document.getElementById('passAdmin').value.trim();
    const btnSubmit = document.getElementById('btnSubmit');

    const user = DB.validarLogin(usuario, pass);

    if (user) {
        DB.iniciarSesion(user);
        sessionStorage.setItem('stt_sesion', JSON.stringify({ usuario: user.usuario, nombre: user.nombre, rol: user.rol }));
        DB.addLog(user.nombre, 'Inició sesión en el panel administrativo');
        showAlert('🔓 Autenticación exitosa. Redirigiendo...', 'success');
        btnSubmit.disabled = true;
        setTimeout(() => { window.location.href = 'admin_dashboard.html'; }, 1000);
    } else {
        showAlert('❌ Usuario o contraseña incorrectos. Acceso denegado.', 'danger');
        document.getElementById('passAdmin').value = '';
        document.getElementById('passAdmin').focus();
    }
});

function showAlert(message, type) {
    document.getElementById('alertContainer').innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show small py-2" role="alert">
            ${message}
            <button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
}

document.getElementById('btnTogglePassword').addEventListener('click', function () {
    const passInput = document.getElementById('passAdmin');
    const icon = document.getElementById('toggleIcon');
    if (passInput.type === 'password') {
        passInput.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passInput.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
});
