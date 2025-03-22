const firebaseConfig = {
  apiKey: "AIzaSyBoYb3C07_s2isjJ90CglJlgzLzqWOnSCc",
  authDomain: "autenticacion-cura-esencial.firebaseapp.com",
  projectId: "autenticacion-cura-esencial",
  storageBucket: "autenticacion-cura-esencial.firebasestorage.app",
  messagingSenderId: "673089083379",
  appId: "1:673089083379:web:67fe8e109bfff9a1b42486",
  measurementId: "G-Q0HTCPSRWC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentFilter = 'all';
let currentView = 'list';
let tasksCache = new Map();
let unsubscribe = null;

const personNames = {
  '+525565414878': 'Angie',
  '+525634000661': 'Mar',
  '+525525690271': 'Minerva',
  '+522213282315': 'Jessica',
  '+584241408272': 'Nathaly',
  '+34676553121': 'Jose'
};

// Agregar tarea
async function addTask() {
  const taskName = document.getElementById('taskName').value;
  const assignedTo = document.getElementById('assignedTo').value;
  const deadline = document.getElementById('deadline').value;
  const urgency = document.getElementById('urgency').value;
  const estimatedTime = document.getElementById('estimatedTime').value;
  const recurrence = document.getElementById('recurrence').value;
  const recurrenceDays = Array.from(document.querySelectorAll('input[name="recurrenceDays"]:checked')).map(input => parseInt(input.value));
  const recurrenceEnd = document.getElementById('recurrenceEnd').value;
  const completeOnDay = document.getElementById('completeOnDay').value;
  const recurrenceDayOfMonth = document.getElementById('recurrenceDayOfMonth')?.value || null;
  const dependsOn = document.getElementById('dependsOn').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!taskName || !assignedTo) return alert("Faltan datos");

  let createdAt = new Date().toISOString();
  if (recurrence === 'weekly' && recurrenceDays.length > 0) {
    const today = new Date().getDay();
    const nextDay = recurrenceDays.sort().find(day => day > today) || recurrenceDays[0];
    const daysToAdd = nextDay > today ? nextDay - today : 7 - today + nextDay;
    createdAt = new Date(new Date().setDate(new Date().getDate() + daysToAdd)).toISOString();
  } else if (recurrence === 'monthly' && recurrenceDayOfMonth) {
    const today = new Date();
    const dayOfMonth = parseInt(recurrenceDayOfMonth);
    const nextDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (nextDate <= today) nextDate.setMonth(nextDate.getMonth() + 1);
    createdAt = nextDate.toISOString();
  }

  const task = {
    taskName,
    assignedTo,
    deadline: deadline ? new Date(deadline).toISOString() : null,
    urgency,
    estimatedTime: estimatedTime ? parseFloat(estimatedTime) : null,
    recurrence,
    recurrenceDays: recurrence === 'weekly' ? recurrenceDays : [],
    recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null,
    completeOnDay: completeOnDay || null,
    recurrenceDayOfMonth: recurrence === 'monthly' && recurrenceDayOfMonth ? parseInt(recurrenceDayOfMonth) : null,
    dependsOn: dependsOn || null,
    notes: notes || '',
    completed: false,
    completedAt: null,
    status: 'todo',
    createdBy: 'Sistema',
    createdAt,
    lastEditedBy: null,
    lastEditedAt: null
  };

  const docRef = await db.collection('tasks').add(task);
  tasksCache.set(docRef.id, task);
  toggleSidebar();
  clearForm();
}

// Limpiar formulario
function clearForm() {
  document.getElementById('taskName').value = '';
  document.getElementById('assignedTo').value = '';
  document.getElementById('deadline').value = '';
  document.getElementById('urgency').value = 'medium';
  document.getElementById('estimatedTime').value = '';
  document.getElementById('recurrence').value = 'none';
  document.querySelectorAll('input[name="recurrenceDays"]').forEach(input => input.checked = false);
  document.getElementById('recurrenceEnd').value = '';
  document.getElementById('completeOnDay').value = '';
  document.getElementById('recurrenceDayOfMonth')?.value = '';
  document.getElementById('dependsOn').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('recurrenceOptions').style.display = 'none';
}

// Filtrar tareas
function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (['upcoming', 'overdue', 'noDeadline'].includes(filter)) {
    document.querySelector(`button[onclick="filterTasks('${filter}')"]`).classList.add('active');
  }
  renderTasks();
}

// Cambiar vista
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`button[onclick="switchView('${view}')"]`).classList.add('active');
  document.getElementById('taskList').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('kanban').style.display = view === 'kanban' ? 'flex' : 'none';
  document.getElementById('calendar').style.display = view === 'calendar' ? 'block' : 'none';
  document.getElementById('history').style.display = view === 'history' ? 'block' : 'none';
  document.getElementById('workload').style.display = view === 'workload' ? 'block' : 'none';
  document.getElementById('reports').style.display = view === 'reports' ? 'block' : 'none';
  renderTasks();
}

// Renderizar tareas
function renderTasks() {
  const taskList = document.getElementById('taskList');
  const kanbanTodo = document.getElementById('todo');
  const kanbanInProgress = document.getElementById('inProgress');
  const kanbanDone = document.getElementById('done');
  const calendarEl = document.getElementById('calendar');
  const historyList = document.getElementById('history');
  const workloadEl = document.getElementById('workload');
  const reportsEl = document.getElementById('reports');

  taskList.innerHTML = '';
  kanbanTodo.innerHTML = '<h3>Por Hacer</h3>';
  kanbanInProgress.innerHTML = '<h3>En Progreso</h3>';
  kanbanDone.innerHTML = '<h3>Completadas</h3>';
  historyList.innerHTML = '';
  workloadEl.innerHTML = '';
  reportsEl.innerHTML = '';

  if (currentView === 'calendar') {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      events: Array.from(tasksCache.entries()).map(([taskId, task]) => ({
        id: taskId,
        title: task.taskName,
        start: task.createdAt,
        end: task.deadline || null,
        backgroundColor: getColorByPerson(task.assignedTo),
        extendedProps: { completed: task.completed }
      })).filter(event => applyFilter(tasksCache.get(event.id)) && !event.extendedProps.completed),
      eventClick: (info) => showTaskPopup(info.event.id)
    });
    calendar.render();
  } else if (currentView === 'kanban') {
    tasksCache.forEach((task, taskId) => {
      if (applyFilter(task) && !task.completed) {
        const taskItem = createTaskItem(taskId, task);
        if (task.status === 'todo') kanbanTodo.appendChild(taskItem);
        else if (task.status === 'inProgress') kanbanInProgress.appendChild(taskItem);
        else if (task.status === 'done') kanbanDone.appendChild(taskItem);
      }
    });
    initSortable();
  } else if (currentView === 'workload') {
    renderWorkload(workloadEl);
  } else if (currentView === 'reports') {
    renderReports(reportsEl);
  } else {
    tasksCache.forEach((task, taskId) => {
      if (applyFilter(task)) {
        const taskItem = createTaskItem(taskId, task);
        if (currentView === 'history' && task.completed) {
          historyList.appendChild(taskItem);
        } else if (currentView === 'list' && !task.completed) {
          taskList.appendChild(taskItem);
        }
      }
    });
  }

  updateTimers();
}

// Crear elemento de tarea
function createTaskItem(taskId, task) {
  const timeElapsed = getTimeElapsed(new Date(task.createdAt));
  const taskItem = document.createElement('div');
  taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
  taskItem.dataset.id = taskId;
  taskItem.dataset.assigned = task.assignedTo;
  taskItem.innerHTML = `
    <div class="task-header">
      <span class="task-name" onclick="editTaskName('${taskId}', this)">${task.taskName}</span> (${timeElapsed}) - ${task.urgency}
      <div class="task-actions">
        <button onclick="toggleComplete('${taskId}', ${task.completed})" ${task.completeOnDay && !isValidCompleteDay(task.completeOnDay) ? 'disabled' : ''}>
          <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
        </button>
        <button onclick="deleteTask('${taskId}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    ${task.deadline ? `<div>Deadline: ${new Date(task.deadline).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</div>` : ''}
    ${task.completed && task.completedAt ? `<div>Completada: ${new Date(task.completedAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</div>` : ''}
    ${task.estimatedTime ? `<div>Tiempo estimado: ${task.estimatedTime} horas</div>` : ''}
    ${task.dependsOn ? `<div>Depende de: ${task.dependsOn}</div>` : ''}
    ${task.recurrence !== 'none' ? `<div>Recurrencia: ${task.recurrence}${task.recurrenceDays.length ? ' (' + task.recurrenceDays.map(day => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day]).join(', ') + ')' : task.recurrenceDayOfMonth ? ` (Día ${task.recurrenceDayOfMonth})` : ''}</div>` : ''}
    ${task.recurrenceEnd ? `<div>Fin de recurrencia: ${new Date(task.recurrenceEnd).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</div>` : ''}
    ${task.completeOnDay ? `<div>Completar solo el: ${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][task.completeOnDay]}</div>` : ''}
    <div class="notes editable" onclick="editNotes('${taskId}', this)">${task.notes || 'Click para agregar notas'}</div>
    <div class="accordion" onclick="toggleAccordion(this)">Subtareas (${(task.subtasks || []).length})</div>
    <div class="accordion-content">
      <div class="subtask-form">
        <input type="text" id="subtask-${taskId}" placeholder="Añadir subtarea...">
        <button onclick="addSubtask('${taskId}')"><i class="fas fa-plus"></i></button>
      </div>
      <div class="subtask-list">
        ${(task.subtasks || []).map(sub => `<div class="subtask" data-assigned="${task.assignedTo}">${sub}</div>`).join('')}
      </div>
    </div>
  `;
  return taskItem;
}

// Inicializar Sortable para Kanban
function initSortable() {
  ['todo', 'inProgress', 'done'].forEach(status => {
    new Sortable(document.getElementById(status), {
      group: 'kanban',
      animation: 150,
      onEnd: (evt) => {
        const taskId = evt.item.dataset.id;
        const newStatus = evt.to.id;
        const updates = { 
          status: newStatus, 
          lastEditedAt: new Date().toISOString(), 
          lastEditedBy: 'Sistema' 
        };
        if (newStatus === 'done') {
          const task = tasksCache.get(taskId);
          if (task.completeOnDay && !isValidCompleteDay(task.completeOnDay)) {
            alert(`Esta tarea solo puede completarse el ${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][task.completeOnDay]}`);
            evt.item.remove();
            renderTasks();
            return;
          }
          updates.completed = true;
          updates.completedAt = new Date().toISOString();
        } else {
          updates.completed = false;
          updates.completedAt = null;
        }
        db.collection('tasks').doc(taskId).update(updates);
      }
    });
  });
}

// Renderizar carga de trabajo
function renderWorkload(workloadEl) {
  const workload = {};
  tasksCache.forEach(task => {
    if (!task.completed) {
      workload[task.assignedTo] = (workload[task.assignedTo] || 0) + 1;
    }
  });

  workloadEl.innerHTML = '<h3>Carga de Trabajo</h3>';
  for (const [phone, count] of Object.entries(workload)) {
    const color = count > 5 ? 'red' : count > 3 ? 'orange' : 'green';
    workloadEl.innerHTML += `<p>${personNames[phone] || phone}: ${count} tareas <span style="color: ${color};">●</span></p>`;
  }
}

// Renderizar reportes
function renderReports(reportsEl) {
  reportsEl.innerHTML = `
    <select id="reportFilter" onchange="toggleCustomRange()">
      <option value="week">Semana actual</option>
      <option value="custom">Días personalizados</option>
      <option value="month">Mes completo</option>
    </select>
    <div id="customRange" style="display: none;">
      <input type="date" id="startDate">
      <input type="date" id="endDate">
    </div>
    <button onclick="downloadReport()">Descargar Reporte</button>
    <div id="reportContent"></div>
  `;
}

// Alternar rango personalizado
function toggleCustomRange() {
  const filter = document.getElementById('reportFilter').value;
  document.getElementById('customRange').style.display = filter === 'custom' ? 'block' : 'none';
}

// Descargar reporte
function downloadReport() {
  const filter = document.getElementById('reportFilter').value;
  let startDate, endDate;

  if (filter === 'week') {
    endDate = new Date();
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 7);
  } else if (filter === 'month') {
    endDate = new Date();
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  } else {
    startDate = new Date(document.getElementById('startDate').value);
    endDate = new Date(document.getElementById('endDate').value);
    if (!startDate || !endDate) return alert("Selecciona fechas válidas");
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Tarea,Asignada a,Completada en,Tiempo Estimado\n";

  tasksCache.forEach((task) => {
    if (task.completed && task.completedAt) {
      const completedAt = new Date(task.completedAt);
      if (completedAt >= startDate && completedAt <= endDate) {
        const row = [
          task.taskName,
          personNames[task.assignedTo] || task.assignedTo,
          completedAt.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
          task.estimatedTime || 'N/A'
        ].join(',');
        csvContent += row + "\n";
      }
    }
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `reporte_tareas_${filter}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const reportContent = document.getElementById('reportContent');
  reportContent.innerHTML = `<p>Reporte generado para ${filter === 'week' ? 'semana actual' : filter === 'month' ? 'mes completo' : 'rango personalizado'}.</p>`;
}

// Filtro de tareas
function applyFilter(task) {
  const now = new Date();
  const todayEnd = new Date(now.setHours(23, 59, 59, 999));
  
  return (
    currentFilter === 'all' ||
    (currentFilter === 'upcoming' && task.deadline && new Date(task.deadline) > todayEnd) ||
    (currentFilter === 'overdue' && task.deadline && new Date(task.deadline) < now && !task.completed) ||
    (currentFilter === 'noDeadline' && !task.deadline && !task.completed) ||
    currentFilter === task.assignedTo
  );
}

// Obtener color por persona
function getColorByPerson(phone) {
  const colors = {
    '+525565414878': '#ff6b6b',
    '+525634000661': '#4ecdc4',
    '+525525690271': '#45b7d1',
    '+522213282315': '#96ceb4',
    '+584241408272': '#ffeead',
    '+34676553121': '#d4a4eb'
  };
  return colors[phone] || '#485bf3';
}

// Calcular tiempo transcurrido
function getTimeElapsed(createdAt) {
  const now = new Date();
  const diff = Math.floor((now - createdAt) / (1000 * 60 * 60)); // Horas
  const hours = diff;
  const minutes = Math.floor((now - createdAt) / (1000 * 60)) % 60;
  return `${hours}h ${minutes}m`;
}

// Validar día de completado
function isValidCompleteDay(day) {
  const today = new Date().getDay();
  return parseInt(day) === today;
}

// Actualizar timers
function updateTimers() {
  clearInterval(window.timerInterval);
  window.timerInterval = setInterval(() => {
    document.querySelectorAll('.task-item span').forEach(span => {
      const taskId = span.parentElement.parentElement.dataset.id;
      const task = tasksCache.get(taskId);
      if (task) {
        const timeElapsed = getTimeElapsed(new Date(task.createdAt));
        span.textContent = `${task.taskName} (${timeElapsed}) - ${task.urgency}`;
      }
    });
  }, 60000);
}

// Escuchar cambios en tiempo real
function listenToChanges() {
  if (unsubscribe) unsubscribe();
  unsubscribe = db.collection('tasks').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const taskId = change.doc.id;
      if (change.type === 'added') {
        tasksCache.set(taskId, change.doc.data());
      } else if (change.type === 'modified') {
        tasksCache.set(taskId, change.doc.data());
      } else if (change.type === 'removed') {
        tasksCache.delete(taskId);
      }
      if (change.doc.data().completed && change.doc.data().recurrence !== 'none') {
        recreateTask(change.doc.data(), taskId);
      }
    });
    renderTasks();
  });
}

// Agregar subtarea
async function addSubtask(taskId) {
  const subtaskInput = document.getElementById(`subtask-${taskId}`);
  const subtask = subtaskInput.value.trim();
  if (!subtask) return;
  const task = tasksCache.get(taskId);
  const subtasks = task.subtasks || [];
  subtasks.push(subtask);
  await db.collection('tasks').doc(taskId).update({ 
    subtasks, 
    lastEditedAt: new Date().toISOString(), 
    lastEditedBy: 'Sistema' 
  });
  tasksCache.set(taskId, { ...task, subtasks });
  subtaskInput.value = '';
}

// Editar nombre de tarea
function editTaskName(taskId, element) {
  const currentName = element.textContent;
  const newName = prompt('Editar nombre:', currentName);
  if (newName !== null && newName.trim()) {
    db.collection('tasks').doc(taskId).update({ 
      taskName: newName.trim(),
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: 'Sistema'
    });
  }
}

// Editar notas
function editNotes(taskId, element) {
  const currentNotes = element.textContent.replace('Click para agregar notas', '');
  const newNotes = prompt('Editar notas:', currentNotes);
  if (newNotes !== null) {
    db.collection('tasks').doc(taskId).update({ 
      notes: newNotes,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: 'Sistema'
    });
  }
}

// Toggle acordeón
function toggleAccordion(element) {
  const content = element.nextElementSibling;
  content.classList.toggle('active');
}

// Toggle sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  sidebar.classList.toggle('active');
  mainContent.classList.toggle('sidebar-active');
}

// Toggle opciones de recurrencia
function toggleRecurrenceOptions() {
  const recurrence = document.getElementById('recurrence').value;
  const options = document.getElementById('recurrenceOptions');
  options.style.display = recurrence === 'none' || recurrence === 'daily' ? 'none' : 'block';
  if (recurrence === 'monthly') {
    options.innerHTML = `
      <label>Día del mes:</label>
      <input type="number" id="recurrenceDayOfMonth" min="1" max="31" placeholder="Día del mes (1-31)">
      <label>Fin de recurrencia:</label>
      <input type="date" id="recurrenceEnd">
      <label>Completar solo en día específico:</label>
      <select id="completeOnDay">
        <option value="">Ninguno</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miércoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sábado</option>
        <option value="0">Domingo</option>
      </select>
    `;
  } else if (recurrence === 'weekly') {
    options.innerHTML = `
      <label>Días de la semana (para semanal):</label>
      <div>
        <input type="checkbox" id="mon" name="recurrenceDays" value="1"> Lun
        <input type="checkbox" id="tue" name="recurrenceDays" value="2"> Mar
        <input type="checkbox" id="wed" name="recurrenceDays" value="3"> Mié
        <input type="checkbox" id="thu" name="recurrenceDays" value="4"> Jue
        <input type="checkbox" id="fri" name="recurrenceDays" value="5"> Vie
        <input type="checkbox" id="sat" name="recurrenceDays" value="6"> Sáb
        <input type="checkbox" id="sun" name="recurrenceDays" value="0"> Dom
      </div>
      <label>Fin de recurrencia:</label>
      <input type="date" id="recurrenceEnd">
      <label>Completar solo en día específico:</label>
      <select id="completeOnDay">
        <option value="">Ninguno</option>
        <option value="1">Lunes</option>
        <option value="2">Martes</option>
        <option value="3">Miércoles</option>
        <option value="4">Jueves</option>
        <option value="5">Viernes</option>
        <option value="6">Sábado</option>
        <option value="0">Domingo</option>
      </select>
    `;
  }
}

// Marcar/desmarcar tarea
async function toggleComplete(taskId, currentStatus) {
  const task = tasksCache.get(taskId);
  if (!currentStatus && task.completeOnDay && !isValidCompleteDay(task.completeOnDay)) {
    alert(`Esta tarea solo puede completarse el ${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][task.completeOnDay]}`);
    return;
  }

  const updates = { 
    completed: !currentStatus,
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: 'Sistema'
  };
  if (!currentStatus) {
    updates.completedAt = new Date().toISOString();
    updates.status = 'done';
  } else {
    updates.completedAt = null;
    updates.status = 'todo';
  }
  await db.collection('tasks').doc(taskId).update(updates);
}

// Borrar tarea
async function deleteTask(taskId) {
  await db.collection('tasks').doc(taskId).delete();
}

// Recrear tarea recurrente
async function recreateTask(task, taskId) {
  if (task.recurrence === 'none' || (task.recurrenceEnd && new Date(task.recurrenceEnd) < new Date())) return;

  let nextDate;
  switch (task.recurrence) {
    case 'daily':
      nextDate = new Date(new Date().setDate(new Date().getDate() + 1));
      break;
    case 'weekly': {
      const today = new Date().getDay();
      const nextDay = task.recurrenceDays.sort().find(day => day > today) || task.recurrenceDays[0];
      const daysToAdd = nextDay > today ? nextDay - today : 7 - today + nextDay;
      nextDate = new Date(new Date().setDate(new Date().getDate() + daysToAdd));
      break;
    }
    case 'monthly': {
      const today = new Date();
      const dayOfMonth = task.recurrenceDayOfMonth || 1; // Día por defecto si no se especifica
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
      break;
    }
    default:
      return;
  }

  const newTask = {
    ...task,
    createdAt: nextDate.toISOString(),
    deadline: task.deadline ? new Date(new Date(task.deadline).getTime() + (nextDate - new Date(task.createdAt))).toISOString() : null,
    completed: false,
    completedAt: null,
    status: 'todo',
    lastEditedBy: null,
    lastEditedAt: null
  };
  const docRef = await db.collection('tasks').add(newTask);
  tasksCache.set(docRef.id, newTask);
}

// Inicializar el sistema
renderTasks();
listenToChanges();