// === Dashboard Reto Fitness - Chart.js ===

// Colores para gráficos
const COLORS = [
  '#4299e1', '#48bb78', '#ed8936', '#f56565', '#9f7aea',
  '#38b2ac', '#ed64a6', '#ecc94b', '#667eea', '#fc8181'
];

const HABIT_COLORS = {
  'Agua': '#4299e1',
  'Pasos': '#48bb78',
  'Ejercicio': '#ed8936',
  'Calorias': '#f56565',
  'Sueño': '#9f7aea',
  'Duolingo': '#38b2ac',
  'Lectura': '#ed64a6',
  'Celular': '#ecc94b',
  'Dientes': '#667eea',
  'Ducha': '#fc8181',
  'Retos': '#667eea'
};

// Hábitos comparables (para pestaña Hábitos - usan VALOR no puntos)
const HABITOS_COMPARABLES = ['Celular', 'Agua', 'Ejercicio', 'Lectura', 'Pasos', 'Sueño', 'Duolingo', 'Retos'];
const HABITO_DEFAULT = 'Ejercicio';

// Estado global
let allData = [];
let allDataWithValues = []; // Datos con valores (no solo puntos)
let users = [];
let habits = [];
let charts = {};

// === Utilidades ===
async function fetchJSON(url) {
  const r = await fetch(url);
  return r.json();
}

function isoDateOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function getColor(index) {
  return COLORS[index % COLORS.length];
}

function getHabitColor(habit) {
  // Agrupar retos
  if (habit && (habit.toLowerCase().startsWith('mini') || habit.toLowerCase().startsWith('semanal') || habit.toLowerCase().startsWith('bingo'))) {
    return HABIT_COLORS['Retos'];
  }
  return HABIT_COLORS[habit] || getColor(Object.keys(HABIT_COLORS).length);
}

// Normalizar nombre de hábito (agrupar retos)
function normalizeHabit(hab) {
  if (!hab) return hab;
  const lower = hab.toLowerCase();
  if (lower.startsWith('mini') || lower.startsWith('semanal') || lower.startsWith('bingo') || lower === 'reto') {
    return 'Retos';
  }
  return hab;
}

// === Cargar datos ===
async function loadUsers() {
  users = await fetchJSON('/api/users');
  const sel = document.getElementById('user-select');
  sel.innerHTML = '<option value="">Todos</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    sel.appendChild(opt);
  });
  
  // Heatmap user selector
  const heatmapSel = document.getElementById('heatmap-user');
  heatmapSel.innerHTML = '';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    heatmapSel.appendChild(opt);
  });
  
  // Comparativa user selector
  const compSel = document.getElementById('comparativa-user');
  if (compSel) {
    compSel.innerHTML = '';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      compSel.appendChild(opt);
    });
  }
  
  // Distribución user selector
  const distSel = document.getElementById('distribucion-user');
  if (distSel) {
    distSel.innerHTML = '';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      distSel.appendChild(opt);
    });
  }
}

async function loadHabits() {
  habits = await fetchJSON('/api/habits');
  
  // Filtrar solo hábitos comparables para la pestaña Hábitos
  const sel = document.getElementById('habit-filter');
  sel.innerHTML = '';
  
  // Agregar solo los hábitos comparables que existan
  HABITOS_COMPARABLES.forEach(h => {
    // Verificar si existe algún hábito que matchee
    const exists = habits.some(apiHab => normalizeHabit(apiHab) === h || apiHab === h);
    if (exists || h === 'Retos') {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === HABITO_DEFAULT) opt.selected = true;
      sel.appendChild(opt);
    }
  });
}

async function loadAllData() {
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  const user = document.getElementById('user-select').value;
  const userParam = user || users.join(',');
  const url = `/api/points?user=${encodeURIComponent(userParam)}&start=${start}&end=${end}`;
  const response = await fetchJSON(url);
  allData = response.series || {};
  
  // Cargar también datos con valores
  const latestUrl = `/api/latest?limit=2000`;
  const latestData = await fetchJSON(latestUrl);
  allDataWithValues = latestData || [];
}

// === Pestañas ===
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.getElementById('tab-' + tabId).classList.add('active');
      // Redraw chart for active tab
      refreshActiveTab(tabId);
    });
  });
}

function refreshActiveTab(tabId) {
  switch(tabId) {
    case 'resumen': drawResumen(); break;
    case 'habitos': drawHabitos(); break;
    case 'comparativa': drawComparativa(); break;
    case 'heatmap': drawHeatmap(); break;
    case 'ranking': drawRanking(); break;
    case 'progreso': drawProgreso(); break;
    case 'distribucion': drawDistribucion(); break;
    case 'alertas': drawAlertas(); break;
    case 'retos': drawRetos(); break;
  }
}

// === Gráfico: Resumen (Trendline puntos totales por día) ===
function drawResumen() {
  const ctx = document.getElementById('chart-resumen').getContext('2d');
  
  // Agregar puntos por día para cada usuario
  const datasets = [];
  let colorIdx = 0;
  const allDates = new Set();
  
  Object.keys(allData).forEach(usuario => {
    const userObj = allData[usuario];
    const dateMap = {};
    
    Object.keys(userObj).forEach(hab => {
      userObj[hab].forEach(p => {
        dateMap[p.date] = (dateMap[p.date] || 0) + (p.puntos || 0);
        allDates.add(p.date);
      });
    });
    
    // Solo incluir fechas con datos (no 0 o vacías)
    const validDates = Array.from(allDates).filter(d => dateMap[d] && dateMap[d] !== 0).sort();
    const data = validDates.map(d => ({ x: d, y: dateMap[d] }));
    
    datasets.push({
      label: usuario,
      data: data,
      borderColor: getColor(colorIdx),
      backgroundColor: getColor(colorIdx) + '33',
      fill: true,
      tension: 0.3
    });
    colorIdx++;
  });
  
  // Obtener etiquetas sin transformación (solo fechas con datos)
  const allDatesArray = Array.from(allDates).filter(d => {
    // Verificar si hay datos en esta fecha para al menos un usuario
    return Object.keys(allData).some(u => {
      const userObj = allData[u];
      let dateTotal = 0;
      Object.keys(userObj).forEach(hab => {
        userObj[hab].forEach(p => {
          if (p.date === d) dateTotal += (p.puntos || 0);
        });
      });
      return dateTotal !== 0;
    });
  }).sort();
  
  if (charts.resumen) charts.resumen.destroy();
  charts.resumen = new Chart(ctx, {
    type: 'line',
    data: { 
      labels: allDatesArray,
      datasets 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: 'category', title: { display: true, text: 'Fecha' } },
        y: { title: { display: true, text: 'Puntos' }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}

// === Gráfico: Hábitos (Trendline individual por hábito - usa VALOR no puntos) ===
function drawHabitos() {
  const ctx = document.getElementById('chart-habitos').getContext('2d');
  const habitFilter = document.getElementById('habit-filter').value || HABITO_DEFAULT;
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  
  const datasets = [];
  let colorIdx = 0;
  
  // Agrupar datos por usuario, filtrando por fecha y hábito
  const userDataMap = {};
  
  allDataWithValues.forEach(row => {
    const usuario = row.Usuario || '';
    const hab = row.Hábito || row.Habito || '';
    const fecha = row.Fecha || '';
    
    // Aplicar filtros de fecha
    if (start && fecha < start) return;
    if (end && fecha > end) return;
    
    const valor = parseFloat(row['Valor (L)']) || parseFloat(row.Valor) || 0;
    
    const normalizedHab = normalizeHabit(hab);
    if (normalizedHab !== habitFilter) return;
    
    if (!userDataMap[usuario]) userDataMap[usuario] = {};
    if (!userDataMap[usuario][fecha]) userDataMap[usuario][fecha] = 0;
    userDataMap[usuario][fecha] += valor;
  });
  
  Object.keys(userDataMap).forEach(usuario => {
    const dateMap = userDataMap[usuario];
    const dates = Object.keys(dateMap).sort();
    const data = dates.map(d => ({ x: d, y: dateMap[d] }));
    
    datasets.push({
      label: usuario,
      data: data,
      borderColor: getColor(colorIdx),
      backgroundColor: 'transparent',
      tension: 0.3
    });
    colorIdx++;
  });
  
  // Determinar unidad de medida según hábito
  const unidades = {
    'Celular': 'Minutos',
    'Agua': 'Litros',
    'Ejercicio': 'Minutos',
    'Lectura': 'Minutos',
    'Pasos': 'Pasos',
    'Sueño': 'Horas',
    'Duolingo': 'Minutos',
    'Retos': 'Cantidad'
  };
  const unidad = unidades[habitFilter] || 'Valor';
  
  if (charts.habitos) charts.habitos.destroy();
  charts.habitos = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: 'category', title: { display: true, text: 'Fecha' } },
        y: { title: { display: true, text: unidad }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: `${habitFilter} - Comparativa por Usuario` }
      }
    }
  });
}

// === Gráfico: Comparativa (Barras por día de UN usuario, colores por hábito) ===
function drawComparativa() {
  const ctx = document.getElementById('chart-comparativa').getContext('2d');
  const selectedUser = document.getElementById('comparativa-user').value;
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  
  if (!selectedUser || !allData[selectedUser]) {
    if (charts.comparativa) charts.comparativa.destroy();
    return;
  }
  
  const userObj = allData[selectedUser];
  
  // Obtener todas las fechas únicas, filtrando por rango
  const allDates = new Set();
  Object.keys(userObj).forEach(hab => {
    userObj[hab].forEach(p => {
      if (start && p.date < start) return;
      if (end && p.date > end) return;
      allDates.add(p.date);
    });
  });
  const dates = Array.from(allDates).sort();
  
  // Crear datasets por hábito (agrupando retos)
  const habitDataMap = {};
  
  Object.keys(userObj).forEach(hab => {
    const normalizedHab = normalizeHabit(hab);
    if (!habitDataMap[normalizedHab]) {
      habitDataMap[normalizedHab] = {};
    }
    userObj[hab].forEach(p => {
      if (start && p.date < start) return;
      if (end && p.date > end) return;
      habitDataMap[normalizedHab][p.date] = (habitDataMap[normalizedHab][p.date] || 0) + (p.puntos || 0);
    });
  });
  
  const datasets = [];
  Object.keys(habitDataMap).forEach(hab => {
    const data = dates.map(d => habitDataMap[hab][d] || 0);
    const backgroundColor = [];
    const baseColor = getHabitColor(hab);
    
    data.forEach(value => {
      if (value < 0) {
        backgroundColor.push('#f56565'); // Rojo para negativos
      } else if (value === 0) {
        backgroundColor.push('#ecc94b'); // Amarillo para ceros
      } else {
        backgroundColor.push(baseColor); // Color normal para positivos
      }
    });
    
    datasets.push({
      label: hab,
      data: data,
      backgroundColor: backgroundColor,
      stack: 'stack1'
    });
  });
  
  if (charts.comparativa) charts.comparativa.destroy();
  charts.comparativa = new Chart(ctx, {
    type: 'bar',
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, title: { display: true, text: 'Fecha' } },
        y: { stacked: true, title: { display: true, text: 'Puntos' }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: `Puntos por hábito - ${selectedUser}` }
      }
    }
  });
}

// === Gráfico: Heatmap (Cumplimiento hábitos vs días) ===
function drawHeatmap() {
  const container = document.getElementById('heatmap-container');
  const selectedUser = document.getElementById('heatmap-user').value;
  
  if (!selectedUser || !allData[selectedUser]) {
    container.innerHTML = '<p>Selecciona un usuario.</p>';
    return;
  }
  
  const userObj = allData[selectedUser];
  const habitsInData = Object.keys(userObj);
  
  // Obtener fechas únicas
  const allDates = new Set();
  habitsInData.forEach(hab => {
    userObj[hab].forEach(p => allDates.add(p.date));
  });
  const dates = Array.from(allDates).sort();
  
  // Crear matriz de cumplimiento
  let html = '<table><thead><tr><th>Hábito</th>';
  dates.forEach(d => {
    html += `<th>${d.slice(5)}</th>`; // MM-DD
  });
  html += '</tr></thead><tbody>';
  
  habitsInData.forEach(hab => {
    html += `<tr><td><strong>${hab}</strong></td>`;
    const habData = {};
    userObj[hab].forEach(p => {
      habData[p.date] = p.puntos;
    });
    
    dates.forEach(d => {
      const puntos = habData[d] || 0;
      let cls = 'missed'; // default para valores vacíos
      if (puntos > 0) {
        cls = 'done'; // verde para positivos
      } else if (puntos === 0) {
        cls = 'partial'; // amarillo para ceros
      } else if (puntos < 0) {
        cls = 'missed'; // rojo para negativos
      }
      html += `<td class="${cls}">${puntos}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// === Gráfico: Ranking Semanal ===
async function drawRanking() {
  const ctx = document.getElementById('chart-ranking').getContext('2d');
  const data = await fetchJSON('/api/ranking?type=semanal&top=10');
  
  const labels = data.map(d => d.usuario);
  const pts = data.map(d => d.puntos);
  
  if (charts.ranking) charts.ranking.destroy();
  charts.ranking = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Puntos',
        data: pts,
        backgroundColor: COLORS.slice(0, labels.length),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Puntos' }, beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// === Gráfico: Progreso Mensual (Barras por usuario) ===
function drawProgreso() {
  const ctx = document.getElementById('chart-progreso').getContext('2d');
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  
  // Agrupar puntos por mes y usuario, filtrando por fecha
  const userMonthMap = {};
  const allMonths = new Set();
  
  Object.keys(allData).forEach(usuario => {
    if (!userMonthMap[usuario]) userMonthMap[usuario] = {};
    const userObj = allData[usuario];
    Object.keys(userObj).forEach(hab => {
      userObj[hab].forEach(p => {
        // Aplicar filtros de fecha
        if (start && p.date < start) return;
        if (end && p.date > end) return;
        
        const month = p.date.slice(0, 7); // YYYY-MM
        allMonths.add(month);
        userMonthMap[usuario][month] = (userMonthMap[usuario][month] || 0) + (p.puntos || 0);
      });
    });
  });
  
  const months = Array.from(allMonths).sort();
  
  // Crear datasets por usuario
  const datasets = [];
  let colorIdx = 0;
  
  Object.keys(userMonthMap).forEach(usuario => {
    const data = months.map(m => userMonthMap[usuario][m] || 0);
    datasets.push({
      label: usuario,
      data: data,
      backgroundColor: getColor(colorIdx),
      borderRadius: 6
    });
    colorIdx++;
  });
  
  if (charts.progreso) charts.progreso.destroy();
  charts.progreso = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { title: { display: true, text: 'Puntos' }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Progreso Mensual por Usuario' }
      }
    }
  });
}

// === Gráfico: Distribución de Hábitos (Pastel por usuario) ===
function drawDistribucion() {
  const ctx = document.getElementById('chart-distribucion').getContext('2d');
  const selectedUser = document.getElementById('distribucion-user').value;
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  
  if (!selectedUser || !allData[selectedUser]) {
    if (charts.distribucion) charts.distribucion.destroy();
    return;
  }
  
  const userObj = allData[selectedUser];
  
  // Sumar puntos por hábito (agrupando retos), filtrando por fecha
  const habitMap = {};
  
  Object.keys(userObj).forEach(hab => {
    const normalizedHab = normalizeHabit(hab);
    userObj[hab].forEach(p => {
      // Aplicar filtros de fecha
      if (start && p.date < start) return;
      if (end && p.date > end) return;
      
      habitMap[normalizedHab] = (habitMap[normalizedHab] || 0) + (p.puntos || 0);
    });
  });
  
  const labels = Object.keys(habitMap);
  const data = labels.map(h => habitMap[h]);
  const colors = labels.map(h => getHabitColor(h));
  const total = data.reduce((a, b) => a + b, 0);
  
  // Crear etiquetas con porcentaje
  const labelsWithPct = labels.map((h, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
    return `${h} (${pct}%)`;
  });
  
  if (charts.distribucion) charts.distribucion.destroy();
  charts.distribucion = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labelsWithPct,
      datasets: [{
        data: data,
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: `Distribución de puntos - ${selectedUser}` },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value} pts (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// === Panel de Alertas ===
function drawAlertas() {
  const container = document.getElementById('alertas-container');
  const diasConsiderar = parseInt(document.getElementById('alertas-dias')?.value) || 7;
  const fechaLimite = isoDateOffset(diasConsiderar);
  const alerts = [];
  
  // Calcular hábitos menos cumplidos POR USUARIO
  Object.keys(allData).forEach(usuario => {
    const userObj = allData[usuario];
    const habitCounts = {};
    const habitTotals = {};
    
    Object.keys(userObj).forEach(hab => {
      const normalizedHab = normalizeHabit(hab);
      
      userObj[hab].forEach(p => {
        if (p.date >= fechaLimite) {
          habitTotals[normalizedHab] = (habitTotals[normalizedHab] || 0) + 1;
          if (p.puntos > 0) {
            habitCounts[normalizedHab] = (habitCounts[normalizedHab] || 0) + 1;
          }
        }
      });
    });
    
    // Encontrar hábitos con bajo cumplimiento para este usuario
    Object.keys(habitTotals).forEach(hab => {
      const cumplidos = habitCounts[hab] || 0;
      const total = habitTotals[hab];
      if (total === 0) return;
      const pct = (cumplidos / total * 100).toFixed(1);
      
      if (pct < 50) {
        alerts.push({
          type: 'danger',
          icon: '⚠️',
          title: `${usuario}: ${hab} con bajo cumplimiento`,
          desc: `Solo ${pct}% (${cumplidos}/${total} días) en los últimos ${diasConsiderar} días`
        });
      } else if (pct < 70) {
        alerts.push({
          type: 'warning',
          icon: '⚡',
          title: `${usuario}: ${hab} a mejorar`,
          desc: `${pct}% (${cumplidos}/${total} días) en los últimos ${diasConsiderar} días`
        });
      }
    });
    
    // Verificar actividad reciente del usuario
    let recentCount = 0;
    Object.keys(userObj).forEach(hab => {
      userObj[hab].forEach(p => {
        if (p.date >= fechaLimite && p.puntos > 0) recentCount++;
      });
    });
    
    if (recentCount < 5) {
      alerts.push({
        type: 'warning',
        icon: '👤',
        title: `${usuario} tiene poca actividad`,
        desc: `Solo ${recentCount} registros positivos en los últimos ${diasConsiderar} días`
      });
    }
  });
  
  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      icon: '✅',
      title: '¡Todo bien!',
      desc: `No hay alertas en los últimos ${diasConsiderar} días. ¡Sigan así!`
    });
  }
  
  container.innerHTML = alerts.map(a => `
    <div class="alert-card ${a.type}">
      <span class="icon">${a.icon}</span>
      <div class="content">
        <div class="title">${a.title}</div>
        <div class="desc">${a.desc}</div>
      </div>
    </div>
  `).join('');
}

// === Retos Activos ===
async function drawRetos() {
  const container = document.getElementById('retos-container');
  
  try {
    const retos = await fetchJSON('/api/retos');
    
    if (!retos || retos.length === 0) {
      container.innerHTML = '<p>No hay retos activos en este momento.</p>';
      return;
    }
    
    // Función para determinar color según urgencia
    function getUrgencyClass(diasRestantes) {
      if (diasRestantes <= 1) return 'urgente';      // Rojo - vence hoy o mañana
      if (diasRestantes <= 3) return 'proximo';       // Naranja - vence en 3 días
      if (diasRestantes <= 7) return 'moderado';      // Amarillo - vence en 7 días
      return 'normal';                                 // Azul - más de 7 días
    }
    
    let html = '<h3>🎯 Retos Activos</h3><div class="retos-grid">';
    
    html += retos.map(r => {
      const dias = r.dias_restantes || 999;
      const urgencyClass = getUrgencyClass(dias);
      const diasTexto = dias === 0 ? '¡Hoy!' : dias === 1 ? '1 día' : `${dias} días`;
      
      return `
        <div class="reto-card ${urgencyClass}">
          <div class="reto-id">ID: ${r.id || '-'}</div>
          <div class="reto-tipo">${r.tipo || 'Reto'}</div>
          <div class="reto-descripcion">${r.descripcion || '-'}</div>
          <div class="reto-fecha">📅 Vence: ${r.fecha_fin || '-'} <span class="dias-badge ${urgencyClass}">${diasTexto}</span></div>
          <div class="reto-puntos">🏆 +${r.puntos || 0} puntos</div>
        </div>
      `;
    }).join('');
    
    html += '</div>';
    
    // Resumen
    const totalPuntosPosibles = retos.reduce((sum, r) => sum + (parseInt(r.puntos) || 0), 0);
    html += `
      <div class="retos-resumen" style="margin-top: 24px; padding: 16px; background: var(--bg); border-radius: 8px;">
        <strong>📊 Resumen:</strong> ${retos.length} retos activos. 
        <strong>Puntos posibles:</strong> +${totalPuntosPosibles} puntos
      </div>
    `;
    
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p>No se pudieron cargar los retos.</p>';
  }
}

// === Exportar CSV ===
async function exportCSV() {
  const rows = await fetchJSON('/api/latest?limit=1000');
  if (!rows || !rows.length) return;
  
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')]
    .concat(rows.map(r => keys.map(k => `"${(r[k] || '').toString().replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reto_fitness_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// === Refresh all ===
async function refreshAll() {
  await loadAllData();
  const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'resumen';
  refreshActiveTab(activeTab);
}

// === Refresh active tab considerando cambios en filtros específicos ===
function refreshCurrentTab() {
  const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'resumen';
  refreshActiveTab(activeTab);
}

// === Init ===
async function init() {
  // Configurar fechas por defecto (últimos 21 días)
  document.getElementById('end-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('start-date').value = isoDateOffset(21);
  
  // Cargar datos iniciales
  await loadUsers();
  await loadHabits();
  await loadAllData();
  
  // Inicializar pestañas
  initTabs();
  
  // Dibujar gráfico inicial
  drawResumen();
  
  // Event listeners
  document.getElementById('refresh').addEventListener('click', refreshAll);
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('user-select').addEventListener('change', refreshAll);
  
  // Filtros de fecha: reload datos y redraw tab actual
  document.getElementById('start-date').addEventListener('change', async () => {
    await loadAllData();
    refreshCurrentTab();
  });
  document.getElementById('end-date').addEventListener('change', async () => {
    await loadAllData();
    refreshCurrentTab();
  });
  
  document.getElementById('habit-filter').addEventListener('change', drawHabitos);
  document.getElementById('heatmap-user').addEventListener('change', drawHeatmap);
  
  // Nuevos listeners
  const compUser = document.getElementById('comparativa-user');
  if (compUser) compUser.addEventListener('change', drawComparativa);
  
  const distUser = document.getElementById('distribucion-user');
  if (distUser) distUser.addEventListener('change', drawDistribucion);
  
  const alertasDias = document.getElementById('alertas-dias');
  if (alertasDias) alertasDias.addEventListener('change', drawAlertas);
}

init();
