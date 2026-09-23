const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp5pi6kORcXzziLHNvL8t-6at1BBUJj8molRYYrvyz_pFbQRnMbKrjISmDJlfM3hfL/exec';

// Almacenamiento local de citas cargadas
let citasExistentes = [];

// Identificador para el temporizador de auto-refresco
let autoRefreshTimer = null;
const DIEZ_MINUTOS = 5 * 60 * 1000; // 5 minutos en milisegundos

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

  modalTitle.textContent = titulo;
  modalMessage.textContent = mensaje;

  // Personalizar ícono y estilo según el tipo de mensaje
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

  // Mostrar modal desocultándolo primero
  modal.classList.remove('hidden');

  // Animación de entrada
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

  // Animación de salida
  backdrop.classList.remove('opacity-100');
  backdrop.classList.add('opacity-0');
  
  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  // Configurar escuchadores de eventos para el modal
  const backdrop = document.getElementById('modalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const refreshBtn = document.getElementById('refreshBtn');

  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (refreshBtn) refreshBtn.addEventListener('click', fetchAppointmentsManual);

  // Bloquear fechas pasadas en el selector de fecha (input date)
  const fechaInput = document.getElementById('fecha');
  const hoyStr = getFechaHoyString();
  fechaInput.min = hoyStr;

  fetchAppointments();
  iniciarAutoRefresh();
  
  // Aplicar la restricción de solo números al input de teléfono
  const inputTel = document.getElementById('telefono');
  if (inputTel) {
    restringirSoloNumeros(inputTel);
  }
});

// Iniciar el temporizador para actualizar cada 10 minutos
function iniciarAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    fetchAppointments();
  }, DIEZ_MINUTOS);
}

// Función ejecutada por el botón "Actualizar"
function fetchAppointmentsManual() {
  fetchAppointments();
  iniciarAutoRefresh(); // Reinicia la cuenta de 10 minutos
}

// Devuelve fecha de hoy en formato YYYY-MM-DD
function getFechaHoyString() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convierte "YYYY-MM-DD" y "9:30 am" a un objeto Date de JavaScript
function parseFechaHora(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return null;

  const [year, month, day] = fechaStr.split('-').map(Number);
  
  // Extraer hora, minutos y periodo (am/pm)
  const match = horaStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toLowerCase() : null;

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// Escuchar cambios en la fecha seleccionada
document.getElementById('fecha').addEventListener('change', actualizarHorariosDisponibles);

// Función para restringir solo números
function restringirSoloNumeros(inputElement) {
  inputElement.addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  });
}

// Obtener citas (GET)
async function fetchAppointments() {
  const tbody = document.getElementById('citasTable');
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

    // Ordenar registros por fecha y hora de menor a mayor (orden ascendente)
    citasExistentes.sort((a, b) => {
      const fechaA = parseFechaHora(
        a.Fecha ? new Date(a.Fecha).toISOString().split('T')[0] : '',
        a['Hora Inicio'] || a.Hora || '12:00 am'
      );
      const fechaB = parseFechaHora(
        b.Fecha ? new Date(b.Fecha).toISOString().split('T')[0] : '',
        b['Hora Inicio'] || b.Hora || '12:00 am'
      );
      return (fechaA || 0) - (fechaB || 0);
    });

    citasExistentes.forEach(cita => {
      if (!cita.Cliente) return;
      
      const fechaFormateada = cita.Fecha ? new Date(cita.Fecha).toISOString().split('T')[0] : '';
      const estado = cita.Estado || 'Agendada';
      const esConfirmada = estado.trim().toUpperCase() === 'CONFIRMADA' || estado.trim().toUpperCase() === 'CONFIRMADO';
      
      // Asignar clases de color en base al estado
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

// Función para deshabilitar las horas ocupadas y horas del pasado
function actualizarHorariosDisponibles() {
  const fechaInput = document.getElementById('fecha').value;
  const selectHora = document.getElementById('hora');

  if (!fechaInput) {
    selectHora.disabled = true;
    return;
  }

  selectHora.disabled = false;

  const ahora = new Date();

  const horasOcupadas = citasExistentes
    .filter(cita => {
      if (!cita.Fecha) return false;
      const fechaCita = new Date(cita.Fecha).toISOString().split('T')[0];
      return fechaCita === fechaInput;
    })
    .map(cita => cita['Hora Inicio'] || cita.Hora);

  Array.from(selectHora.options).forEach(option => {
    if (!option.value) return;

    // Comprobar si la hora de esta opción ya pasó en el día de hoy
    const fechaHoraOpcion = parseFechaHora(fechaInput, option.value);
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

function formatHoraTexto(hora) {
  const [h, m] = hora.split(':');
  const horaNum = parseInt(h);
  const hora12 = horaNum % 12 || 12;
  return `${hora12.toString().padStart(2, '0')}:${m}`;
}

// Guardar cita (POST)
document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const btnText = document.getElementById('btnText');
  const refreshBtn = document.getElementById('refreshBtn');

  const fecha = document.getElementById('fecha').value;
  const hora = document.getElementById('hora').value;
  
  // 1. VALIDACIÓN FECHA/HORA PASADA
  const fechaHoraSeleccionada = parseFechaHora(fecha, hora);
  const ahora = new Date();

  if (fechaHoraSeleccionada && fechaHoraSeleccionada < ahora) {
    showModal('No puedes agendar una cita en una fecha u hora pasada. Por favor elige un horario futuro.', 'Fecha Inválida', 'warning');
    return;
  }

  // 2. VALIDACIÓN HORARIO DISPONIBLE
  const yaOcupado = citasExistentes.some(cita => {
    if (!cita.Fecha) return false;    
    const fechaCita = new Date(cita.Fecha).toISOString().split('T')[0];
    const horaCita = cita['Hora Inicio'] || cita.Hora;
    return fechaCita === fecha && horaCita === hora;
  });
    
  if (yaOcupado) {
    showModal('Este horario y fecha ya no están disponibles. Por favor selecciona otro.', 'Horario Ocupado', 'warning');
    return;
  }

  // === BLOQUEAR FORMULARIO Y CAMBIAR CURSOR ===
  document.body.classList.add('is-submitting');
  
  // Deshabilitar todos los controles del formulario
  const inputs = form.querySelectorAll('input, select, textarea, button');
  inputs.forEach(input => input.disabled = true);
  refreshBtn.disabled = true;

  // Cambiar texto del botón e insertar spinner
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

    // Mostrar popup personalizado de éxito
    showModal('Cita enviada para su Revisión y Confirmación. ¡Te esperamos!', '¡Cita Registrada!', 'success');
    form.reset();
    
  } catch (err) {
    showModal('Ocurrió un error al intentar guardar la cita. Inténtalo nuevamente.', 'Error de Conexión', 'error');
  } finally {
    // === RESTAURAR FORMULARIO Y CURSOR ===
    document.body.classList.remove('is-submitting');
    
    inputs.forEach(input => {
      // Mantener deshabilitados únicamente el precio y la hora si no hay fecha seleccionada
      if (input.id !== 'precio' && input.id !== 'hora') {
        input.disabled = false;
      }
    });
    refreshBtn.disabled = false;
    
    btnText.textContent = 'Guardar Cita';
    
    setTimeout(() => {
      fetchAppointments();
      iniciarAutoRefresh();
    }, 1000);
  }
});