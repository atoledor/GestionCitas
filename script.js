const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp5pi6kORcXzziLHNvL8t-6at1BBUJj8molRYYrvyz_pFbQRnMbKrjISmDJlfM3hfL/exec';

// Almacenamiento local de citas cargadas
let citasExistentes = [];

// Identificador para el temporizador de auto-refresco
let autoRefreshTimer = null;
const DIEZ_MINUTOS = 5 * 60 * 1000; // 5 minutos en milisegundos

// -------------------------------------------------------------
// FUNCIONES DE PARSEO Y FORMATO SEGURO PARA WEBKIT / IOS
// -------------------------------------------------------------

// Convierte cualquier formato de fecha a string YYYY-MM-DD compatible con iOS Safari
function formatFechaSafe(fechaRaw) {
  if (!fechaRaw) return '';
  
  // Si ya viene en formato YYYY-MM-DD
  if (typeof fechaRaw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaRaw)) {
    return fechaRaw.split('T')[0];
  }

  const d = new Date(fechaRaw);
  if (isNaN(d.getTime())) return '';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Devuelve la fecha de hoy en formato YYYY-MM-DD
function getFechaHoyString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convierte "YYYY-MM-DD" y "9:30 am" a un objeto Date de JS sin usar new Date(string)
function parseFechaHora(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return null;

  const partesFecha = fechaStr.split('-');
  if (partesFecha.length !== 3) return null;

  const year = parseInt(partesFecha[0], 10);
  const month = parseInt(partesFecha[1], 10);
  const day = parseInt(partesFecha[2], 10);
  
  const match = horaStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toLowerCase() : null;

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatHoraTexto(hora) {
  if (!hora || typeof hora !== 'string') return '';
  const partes = hora.split(':');
  if (partes.length < 2) return hora;
  const h = partes[0];
  const m = partes[1];
  const horaNum = parseInt(h, 10);
  const hora12 = horaNum % 12 || 12;
  return `${hora12.toString().padStart(2, '0')}:${m}`;
}

// -------------------------------------------------------------
// FUNCIONES DEL MODAL / POPUP
// -------------------------------------------------------------
function showModal(mensaje, titulo = "La Luna Roja", tipo = "success") {
  const modal = document.getElementById('customModal');
  const backdrop = document.getElementById('modalBackdrop');
  const content = document.getElementById('modalContent');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const iconContainer = document.getElementById('modalIconContainer');
  const icon = document.getElementById('modalIcon');

  if (!modal || !backdrop || !content) return;

  modalTitle.textContent = titulo;
  modalMessage.textContent = mensaje;

  if (tipo === 'success') {
    iconContainer.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 border border-[#e5b757] bg-[#2a2200] text-[#e5b757]";
    icon.textContent = "✔";
  } else if (tipo === 'warning') {
    iconContainer.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 border border-amber-500 bg-amber-950/40 text-amber-500";
    icon.textContent = "⚠️";
  } else if (tipo === 'error') {
    iconContainer.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 border border-[#d3122a] bg-red-950/40 text-[#d3122a]";
    icon.textContent = "✕";
  } else {
    iconContainer.className = "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 border border-[#262626] bg-[#1a1a1a] text-gray-300";
    icon.textContent = "🌙";
  }

  modal.classList.remove('hidden');

  setTimeout(() => {
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
  }, 10);
}

function closeModal() {
  const modal = document.getElementById('customModal');
  const backdrop = document.getElementById('modalBackdrop');
  const content = document.getElementById('modalContent');

  if (!modal || !backdrop || !content) return;

  backdrop.classList.remove('opacity-100');
  backdrop.classList.add('opacity-0');
  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// -------------------------------------------------------------
// INICIALIZACIÓN Y EVENTOS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.getElementById('modalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const fechaInput = document.getElementById('fecha');

  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (refreshBtn) refreshBtn.addEventListener('click', fetchAppointmentsManual);

  if (fechaInput) {
    fechaInput.min = getFechaHoyString();
    fechaInput.addEventListener('change', actualizarHorariosDisponibles);
  }

  const inputTel = document.getElementById('telefono');
  if (inputTel) {
    restringirSoloNumeros(inputTel);
  }

  fetchAppointments();
  iniciarAutoRefresh();
});

function iniciarAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    fetchAppointments();
  }, DIEZ_MINUTOS);
}

function fetchAppointmentsManual() {
  fetchAppointments();
  iniciarAutoRefresh();
}

function restringirSoloNumeros(inputElement) {
  inputElement.addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  });
}

// -------------------------------------------------------------
// OBTENER CITAS (GET)
// -------------------------------------------------------------
async function fetchAppointments() {
  const tbody = document.getElementById('citasTable');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">Cargando citas...</td></tr>';

  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();

    citasExistentes = json.data || [];

    tbody.innerHTML = '';
    if (citasExistentes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No hay citas agendadas aún.</td></tr>';
      return;
    }

    // Ordenar citas ascendentemente
    citasExistentes.sort((a, b) => {
      const fechaAStr = formatFechaSafe(a.Fecha);
      const fechaBStr = formatFechaSafe(b.Fecha);
      const fechaA = parseFechaHora(fechaAStr, a['Hora Inicio'] || a.Hora || '12:00 am');
      const fechaB = parseFechaHora(fechaBStr, b['Hora Inicio'] || b.Hora || '12:00 am');
      return (fechaA || 0) - (fechaB || 0);
    });

    citasExistentes.forEach(cita => {
      if (!cita.Cliente) return;

      const fechaFormateada = formatFechaSafe(cita.Fecha);
      const estado = cita.Estado || 'Agendada';
      const estadoUpper = estado.trim().toUpperCase();
      const esConfirmada = estadoUpper === 'CONFIRMADA' || estadoUpper === 'CONFIRMADO';

      const badgeClass = esConfirmada
        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-600'
        : 'bg-[#2a2200] text-[#e5b757] border border-[#554400]';

      const row = `<tr class="hover:bg-[#1a1a1a] transition">
        <td class="p-3 text-gray-400">${fechaFormateada}</td>
        <td class="p-3 font-semibold text-[#e5b757]">${cita['Hora Inicio'] || cita.Hora || ''}</td>
        <td class="p-3 font-medium text-white">${cita.Cliente}</td>
        <td class="p-3 text-gray-300">${cita.Servicio}</td>
        <td class="p-3 text-gray-300">${cita.Barbero}</td>
        <td class="p-3"><span class="px-2.5 py-1 rounded text-xs font-semibold ${badgeClass}">${estado}</span></td>
      </tr>`;
      tbody.innerHTML += row;
    });

    actualizarHorariosDisponibles();

  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-red-500">Error al cargar datos de citas</td></tr>';
  }
}

// -------------------------------------------------------------
// ACTUALIZAR HORARIOS DISPONIBLES
// -------------------------------------------------------------
function actualizarHorariosDisponibles() {
  const fechaInput = document.getElementById('fecha');
  const selectHora = document.getElementById('hora');

  if (!fechaInput || !selectHora) return;

  const fechaVal = fechaInput.value;
  if (!fechaVal) {
    selectHora.disabled = true;
    return;
  }

  selectHora.disabled = false;
  const ahora = new Date();

  const horasOcupadas = citasExistentes
    .filter(cita => {
      if (!cita.Fecha) return false;
      const fechaCita = formatFechaSafe(cita.Fecha);
      return fechaCita === fechaVal;
    })
    .map(cita => cita['Hora Inicio'] || cita.Hora);

  Array.from(selectHora.options).forEach(option => {
    if (!option.value) return;

    const fechaHoraOpcion = parseFechaHora(fechaVal, option.value);
    const esHoraPasada = fechaHoraOpcion && fechaHoraOpcion < ahora;

    if (horasOcupadas.includes(option.value)) {
      option.disabled = true;
      option.textContent = `${option.value} (Ocupado)`;
    } else if (esHoraPasada) {
      option.disabled = true;
      option.textContent = `${option.value} (Pasado)`;
    } else {
      option.disabled = false;
      option.textContent = option.value.includes(':') ? formatHoraTexto(option.value) : option.value;
    }
  });
}

// -------------------------------------------------------------
// GUARDAR CITA (POST)
// -------------------------------------------------------------
document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  const btnText = document.getElementById('btnText');
  const refreshBtn = document.getElementById('refreshBtn');

  const fecha = document.getElementById('fecha').value;
  const hora = document.getElementById('hora').value;

  // 1. Validación de fecha/hora pasada
  const fechaHoraSeleccionada = parseFechaHora(fecha, hora);
  const ahora = new Date();

  if (fechaHoraSeleccionada && fechaHoraSeleccionada < ahora) {
    showModal('No puedes agendar una cita en una fecha u hora pasada. Por favor elige un horario futuro.', 'Fecha Inválida', 'warning');
    return;
  }

  // 2. Validación de horario disponible
  const yaOcupado = citasExistentes.some(cita => {
    if (!cita.Fecha) return false;
    const fechaCita = formatFechaSafe(cita.Fecha);
    const horaCita = cita['Hora Inicio'] || cita.Hora;
    return fechaCita === fecha && horaCita === hora;
  });

  if (yaOcupado) {
    showModal('Este horario y fecha ya no están disponibles. Por favor selecciona otro.', 'Horario Ocupado', 'warning');
    return;
  }

  // Bloqueo de interfaz
  document.body.classList.add('is-submitting');

  const inputs = form.querySelectorAll('input, select, textarea, button');
  inputs.forEach(input => input.disabled = true);
  if (refreshBtn) refreshBtn.disabled = true;

  btnText.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Guardando Cita...
  `;

  const payload = {
    cliente: document.getElementById('cliente').value,
    telefono: document.getElementById('telefono').value,
    fecha: fecha,
    horaInicio: hora,
    servicio: document.getElementById('servicio').value,
    barbero: document.getElementById('barbero').value,
    precio: document.getElementById('precio').value,
    metodoPago: document.getElementById('metodoPago').value,
    notas: document.getElementById('notas').value
  };

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    showModal('Cita enviada para su Revisión y Confirmación. ¡Te esperamos!', '¡Cita Registrada!', 'success');
    form.reset();

  } catch (err) {
    showModal('Ocurrió un error al intentar guardar la cita. Inténtalo nuevamente.', 'Error de Conexión', 'error');
  } finally {
    document.body.classList.remove('is-submitting');

    inputs.forEach(input => {
      if (input.id !== 'precio' && input.id !== 'hora') {
        input.disabled = false;
      }
    });
    if (refreshBtn) refreshBtn.disabled = false;

    btnText.textContent = 'Guardar Cita';

    setTimeout(() => {
      fetchAppointments();
      iniciarAutoRefresh();
    }, 1000);
  }
});
