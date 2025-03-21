// Configuración de Firebase
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
  
  // Agregar tarea
  async function addTask() {
    const taskName = document.getElementById('taskName').value;
    const assignedTo = document.getElementById('assignedTo').value;
    const deadline = document.getElementById('deadline').value;
  
    if (!taskName || !assignedTo) return alert("Faltan datos");
  
    const createdAt = new Date();
    await db.collection('tasks').add({
      taskName,
      assignedTo,
      deadline: deadline || null,
      completed: false,
      createdAt: createdAt.toISOString()
    });
  
    // Enviar SMS inicial
    await sendSMS(assignedTo, `Nueva tarea asignada: ${taskName}\nDeadline: ${deadline || 'No definido'}`);
  
    // Limpiar formulario
    document.getElementById('taskName').value = '';
    document.getElementById('assignedTo').value = '';
    document.getElementById('deadline').value = '';
  }
  
  // Mostrar tareas y timers
  db.collection('tasks').onSnapshot(snapshot => {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    snapshot.forEach(doc => {
      const task = doc.data();
      const taskId = doc.id;
      const createdAt = new Date(task.createdAt);
      const timeElapsed = getTimeElapsed(createdAt);
  
      const taskItem = document.createElement('div');
      taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
      taskItem.innerHTML = `
        <span>${task.taskName} - Asignada a: ${task.assignedTo} (Hace: ${timeElapsed})</span>
        <span>Deadline: ${task.deadline || 'No definido'}</span>
        <button onclick="toggleComplete('${taskId}', ${task.completed})">${task.completed ? 'Desmarcar' : 'Completar'}</button>
      `;
      taskList.appendChild(taskItem);
  
      // Verificar si hay deadline y enviar recordatorio si no está completada
      if (task.deadline && !task.completed) {
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        if (now >= deadlineDate) {
          sendSMS(task.assignedTo, `Recordatorio: La tarea "${task.taskName}" ha alcanzado su deadline y no está completada.`);
        }
      }
    });
  });
  
  // Calcular tiempo transcurrido
  function getTimeElapsed(createdAt) {
    const now = new Date();
    const diff = Math.floor((now - createdAt) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  
  // Marcar/desmarcar tarea como completada
  async function toggleComplete(taskId, currentStatus) {
    await db.collection('tasks').doc(taskId).update({
      completed: !currentStatus
    });
  }
  
  // Enviar SMS (llama al backend)
  async function sendSMS(phoneNumber, message) {
    await fetch('http://localhost:3000/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneNumber, message })
    });
  }