async function fetchJSON(url){
  const r = await fetch(url);
  return r.json();
}

function isoDateOffset(daysBack){
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0,10);
}

async function populateUsers(){
  const users = await fetchJSON('/api/users');
  const sel = document.getElementById('user-select');
  sel.innerHTML = '';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u; sel.appendChild(opt);
  });
  // select all by default
  for (let i=0;i<sel.options.length;i++) sel.options[i].selected = true;
}

async function populateHabits(){
  const habits = await fetchJSON('/api/habits');
  const sel = document.getElementById('habit-select');
  sel.innerHTML = '';
  habits.forEach(h => {
    const opt = document.createElement('option'); opt.value = h; opt.textContent = h; sel.appendChild(opt);
  });
  for (let i=0;i<sel.options.length;i++) sel.options[i].selected = true;
}

function getSelectedUsers(){
  const sel = document.getElementById('user-select');
  return Array.from(sel.selectedOptions).map(o => o.value);
}

function getSelectedHabits(){
  const sel = document.getElementById('habit-select');
  return Array.from(sel.selectedOptions).map(o => o.value);
}

async function drawPoints(){
  const users = getSelectedUsers();
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  const paramUser = users.join(',');
  const url = `/api/points?user=${encodeURIComponent(paramUser)}&start=${start}&end=${end}`;
  const data = await fetchJSON(url);
  const series = data.series || {};
  const selectedHabits = getSelectedHabits();
  const viewMode = document.getElementById('view-mode').value;

  const traces = [];
  if(viewMode === 'total'){
    // aggregate per user across selected habits by date
    Object.keys(series).forEach(u => {
      const userObj = series[u];
      const dateMap = {};
      Object.keys(userObj).forEach(h => {
        if (selectedHabits.length && !selectedHabits.includes(h)) return;
        userObj[h].forEach(p => {
          dateMap[p.date] = (dateMap[p.date] || 0) + (p.puntos || 0);
        });
      });
      const dates = Object.keys(dateMap).sort();
      const ys = dates.map(d => dateMap[d]);
      traces.push({x: dates, y: ys, mode: 'lines+markers', name: u});
    });
  } else {
    // per-habit series
    Object.keys(series).forEach(u => {
      const userObj = series[u];
      Object.keys(userObj).forEach(h => {
        if (selectedHabits.length && !selectedHabits.includes(h)) return;
        const points = userObj[h];
        traces.push({x: points.map(p=>p.date), y: points.map(p=>p.puntos), mode: 'lines+markers', name: `${u} — ${h}`});
      });
    });
  }

  const layout = {paper_bgcolor:'#0b0f14', plot_bgcolor:'#0b0f14', font:{color:'#ddd'}};
  Plotly.newPlot('points-chart', traces, layout, {responsive:true});
}

async function drawRanking(){
  const data = await fetchJSON('/api/ranking?type=semanal&top=10');
  const users = data.map(d=>d.usuario);
  const pts = data.map(d=>d.puntos);
  const trace = [{x: pts.reverse(), y: users.reverse(), type:'bar', orientation:'h', marker:{color:'#1f77b4'}}];
  const layout = {paper_bgcolor:'#0b0f14', plot_bgcolor:'#0b0f14', font:{color:'#ddd'}, margin:{l:150}};
  Plotly.newPlot('ranking-chart', trace, layout, {responsive:true});
}

function buildTable(rows){
  const container = document.getElementById('latest-table');
  const table = document.createElement('table');
  table.className = 'data';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Usuario</th><th>Fecha</th><th>Hábito</th><th>Valor</th><th>Cumplido</th><th>Puntos</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.Usuario||''}</td><td>${r.Fecha||''}</td><td>${r.Hábito||r.Habito||''}</td><td>${r.Valor||''}</td><td>${r.Cumplido||''}</td><td>${r.Puntos||''}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

async function loadLatest(){
  const rows = await fetchJSON('/api/latest?limit=100');
  buildTable(rows);
}

function downloadCSV(rows){
  if(!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(',')].concat(rows.map(r=>keys.map(k=>`"${(r[k]||'').toString().replace(/"/g,'""')}"`).join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'latest.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function init(){
  await populateUsers();
  await populateHabits();
  // default date range 30 days
  document.getElementById('end-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('start-date').value = isoDateOffset(30);
  await drawPoints();
  await drawRanking();
  await loadLatest();

  document.getElementById('refresh').addEventListener('click', async ()=>{
    await drawPoints(); await drawRanking(); await loadLatest();
  });
  // redraw on selection changes
  document.getElementById('user-select').addEventListener('change', drawPoints);
  document.getElementById('habit-select').addEventListener('change', drawPoints);
  document.getElementById('view-mode').addEventListener('change', drawPoints);

  document.getElementById('export-csv').addEventListener('click', async ()=>{
    const rows = await fetchJSON('/api/latest?limit=500');
    downloadCSV(rows);
  });
}

init();
