// Variables globales
let allCalls = [];
let filteredCalls = [];
let dispositionChart = null;
let extensionChart = null;
let hourChart = null;
let topSourceChart = null;
let avgDurationChart = null;
let weekdayChart = null;
let selectedExtensions = [];
let sessionData = {
    userid: '',
    userpass: '',
    sessionId: '',
    isActive: false
};

// URL de la API (cambiar según tu configuración)
const API_URL = 'http://localhost:3000/api';

// Elementos del DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const uploadSection = document.getElementById('uploadSection');
const dashboardContent = document.getElementById('dashboardContent');

// Inicializar eventos
function init() {
    setupUploadEvents();
    setupFilterEvents();
    setupCredentialsForm();
    setupCustomQueryForm();
    setupQuickQueryPanel();
    setupDashboardControls();
    setDefaultCustomDates();
}

// Configurar eventos de carga de archivos
function setupUploadEvents() {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/json') {
            handleFile(file);
        } else {
            alert('Por favor, selecciona un archivo JSON válido');
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });
}

// Configurar eventos de filtros
function setupFilterEvents() {
    document.getElementById('filterDisposition').addEventListener('change', applyFilters);
    document.getElementById('filterSrc').addEventListener('input', applyFilters);
    document.getElementById('filterDuration').addEventListener('input', applyFilters);
    setupMultiselect();
}

// Manejar archivo seleccionado
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);
            fileInfo.textContent = `✓ Archivo cargado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            fileInfo.classList.remove('hidden');
            loadData(jsonData);
        } catch (error) {
            alert('Error al leer el archivo JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Cargar datos desde JSON
function loadData(data) {
    const headers = data[0];
    allCalls = data.slice(1).map(row => {
        const call = {};
        headers.forEach((header, index) => {
            call[header] = row[index];
        });
        return call;
    });

    // Mostrar dashboard
    uploadSection.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // Actualizar información de usuario y registros
    if (sessionData.userid) {
        document.getElementById('dashboardUser').textContent = sessionData.userid;
    }
    document.getElementById('recordsCount').textContent = `${allCalls.length} registros`;

    // Poblar filtro de extensiones
    populateDestinationFilter();

    // Aplicar filtros y actualizar vista
    applyFilters();
}

// Poblar filtro de destinos
function populateDestinationFilter() {
    const destinations = [...new Set(allCalls.map(c => c.destination))].filter(d => d).sort((a, b) => a - b);
    const optionsContainer = document.getElementById('multiselectOptions');
    
    destinations.forEach(destination => {
        const option = document.createElement('div');
        option.className = 'multiselect-option';
        option.innerHTML = `
            <input type="checkbox" id="ext_${destination}" value="${destination}">
            <label for="ext_${destination}">Extensión ${destination}</label>
        `;
        
        const checkbox = option.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedExtensions.push(destination);
            } else {
                selectedExtensions = selectedExtensions.filter(ext => ext !== destination);
            }
            updateMultiselectDisplay();
            applyFilters();
        });
        
        optionsContainer.appendChild(option);
    });
}

// Configurar multiselect
function setupMultiselect() {
    const display = document.getElementById('multiselectDisplay');
    const dropdown = document.getElementById('multiselectDropdown');
    const searchInput = document.getElementById('extensionSearch');
    
    // Toggle dropdown
    display.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    
    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multiselect-wrapper')) {
            dropdown.classList.add('hidden');
        }
    });
    
    // Búsqueda
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = document.querySelectorAll('.multiselect-option');
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

// Actualizar visualización del multiselect
function updateMultiselectDisplay() {
    const display = document.getElementById('multiselectDisplay');
    
    if (selectedExtensions.length === 0) {
        display.innerHTML = '<span class="multiselect-placeholder">Seleccionar extensiones...</span>';
    } else {
        display.innerHTML = selectedExtensions.map(ext => `
            <span class="multiselect-tag">
                Ext. ${ext}
                <span class="multiselect-tag-remove" data-ext="${ext}">×</span>
            </span>
        `).join('');
        
        // Agregar eventos de eliminación
        display.querySelectorAll('.multiselect-tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ext = e.target.dataset.ext;
                selectedExtensions = selectedExtensions.filter(e => e !== ext);
                document.getElementById(`ext_${ext}`).checked = false;
                updateMultiselectDisplay();
                applyFilters();
            });
        });
    }
}

// Aplicar filtros
function applyFilters() {
    const disposition = document.getElementById('filterDisposition').value;
    const src = document.getElementById('filterSrc').value.toLowerCase();
    const minDuration = parseInt(document.getElementById('filterDuration').value) || 0;

    filteredCalls = allCalls.filter(call => {
        if (disposition && call.disposition !== disposition) return false;
        if (selectedExtensions.length > 0 && !selectedExtensions.includes(call.destination)) return false;
        if (src && !call.src.toLowerCase().includes(src)) return false;
        if (parseInt(call.duration) < minDuration) return false;
        return true;
    });

    updateStats();
    updateCharts();
    updateTable();
}

// Actualizar estadísticas
function updateStats() {
    const total = filteredCalls.length;
    const answered = filteredCalls.filter(c => c.disposition === 'ANSWERED').length;
    const totalDuration = filteredCalls.reduce((sum, c) => sum + parseInt(c.billsec || 0), 0);
    const avgDuration = answered > 0 ? Math.round(totalDuration / answered) : 0;

    document.getElementById('totalCalls').textContent = total;
    document.getElementById('answeredCalls').textContent = answered;
    document.getElementById('totalDuration').textContent = Math.round(totalDuration / 60);
    document.getElementById('avgDuration').textContent = avgDuration + 's';
}

// Actualizar gráficos
function updateCharts() {
    updateDispositionChart();
    updateExtensionChart();
    updateHourChart();
    updateAdvancedAnalytics();
}

// Actualizar gráfico de disposición
function updateDispositionChart() {
    const dispositionCounts = {};
    filteredCalls.forEach(call => {
        dispositionCounts[call.disposition] = (dispositionCounts[call.disposition] || 0) + 1;
    });

    const dispositionLabels = Object.keys(dispositionCounts);
    const dispositionData = Object.values(dispositionCounts);
    const dispositionColors = dispositionLabels.map(label => {
        switch(label) {
            case 'ANSWERED': return '#4caf50';
            case 'NO ANSWER': return '#ff9800';
            case 'FAILED': return '#f44336';
            case 'BUSY': return '#2196f3';
            default: return '#9e9e9e';
        }
    });

    if (dispositionChart) dispositionChart.destroy();
    
    const ctx1 = document.getElementById('dispositionChart').getContext('2d');
    dispositionChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: dispositionLabels,
            datasets: [{
                data: dispositionData,
                backgroundColor: dispositionColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de extensiones
function updateExtensionChart() {
    const extensionCounts = {};
    filteredCalls.forEach(call => {
        if (call.destination) {
            extensionCounts[call.destination] = (extensionCounts[call.destination] || 0) + 1;
        }
    });

    const topExtensions = Object.entries(extensionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (extensionChart) extensionChart.destroy();
    
    const ctx2 = document.getElementById('extensionChart').getContext('2d');
    extensionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: topExtensions.map(e => `Ext. ${e[0]}`),
            datasets: [{
                label: 'Llamadas',
                data: topExtensions.map(e => e[1]),
                backgroundColor: '#667eea',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Actualizar gráfico de llamadas por hora
function updateHourChart() {
    const hourData = {
        'ANSWERED': Array(24).fill(0),
        'NO ANSWER': Array(24).fill(0),
        'FAILED': Array(24).fill(0),
        'BUSY': Array(24).fill(0)
    };
    
    filteredCalls.forEach(call => {
        if (call.calldate && call.disposition) {
            // Extraer la hora del formato "31/10/25, 16:39"
            const timeMatch = call.calldate.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const hour = parseInt(timeMatch[1]);
                if (hourData[call.disposition]) {
                    hourData[call.disposition][hour]++;
                }
            }
        }
    });

    if (hourChart) hourChart.destroy();
    
    const ctx3 = document.getElementById('hourChart').getContext('2d');
    hourChart = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                {
                    label: 'ANSWERED',
                    data: hourData['ANSWERED'],
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'NO ANSWER',
                    data: hourData['NO ANSWER'],
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    borderColor: '#ff9800',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'FAILED',
                    data: hourData['FAILED'],
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    borderColor: '#f44336',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'BUSY',
                    data: hourData['BUSY'],
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    borderColor: '#2196f3',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    stacked: false,
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Actualizar tabla
function updateTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const maxRows = 100;
    filteredCalls.slice(0, maxRows).forEach(call => {
        const tr = document.createElement('tr');
        
        const dispositionClass = getDispositionClass(call.disposition);

        tr.innerHTML = `
            <td>${call.calldate}</td>
            <td>${call.src}</td>
            <td>${call.destination || call.dst || '-'}</td>
            <td><span class="badge ${dispositionClass}">${call.disposition}</span></td>
            <td>${call.duration}s</td>
            <td>${call.billsec}s</td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredCalls.length > maxRows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align: center; color: #888; font-style: italic;">
            Mostrando ${maxRows} de ${filteredCalls.length} llamadas
        </td>`;
        tbody.appendChild(tr);
    }

    if (filteredCalls.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align: center; color: #888; padding: 30px;">
            No se encontraron llamadas con los filtros seleccionados
        </td>`;
        tbody.appendChild(tr);
    }
}

// Obtener clase CSS para el estado de la llamada
function getDispositionClass(disposition) {
    const classes = {
        'ANSWERED': 'badge-success',
        'NO ANSWER': 'badge-warning',
        'FAILED': 'badge-danger',
        'BUSY': 'badge-info'
    };
    return classes[disposition] || 'badge-info';
}

// ============================================
// ANALÍTICAS AVANZADAS
// ============================================

function updateAdvancedAnalytics() {
    // Solo actualizar si hay datos
    if (filteredCalls.length === 0) {
        console.log('No hay datos para analíticas avanzadas');
        return;
    }
    
    try {
        updateSuccessRates();
        updateTopSourceChart();
        updateAvgDurationChart();
        updateWeekdayChart();
        updateHeatmap();
        updateTopDestinationsTable();
        updateKPIs();
    } catch (error) {
        console.error('Error al actualizar analíticas avanzadas:', error);
    }
}

// Tasa de éxito
function updateSuccessRates() {
    const total = filteredCalls.length;
    if (total === 0) return;
    
    const answered = filteredCalls.filter(c => c.disposition === 'ANSWERED').length;
    const noAnswer = filteredCalls.filter(c => c.disposition === 'NO ANSWER').length;
    const failed = filteredCalls.filter(c => c.disposition === 'FAILED').length;
    
    const successRate = ((answered / total) * 100).toFixed(1);
    const answeredRate = ((answered / total) * 100).toFixed(1);
    const noAnswerRate = ((noAnswer / total) * 100).toFixed(1);
    const failedRate = ((failed / total) * 100).toFixed(1);
    
    document.getElementById('successRate').textContent = successRate + '%';
    document.getElementById('answeredRate').textContent = answeredRate + '%';
    document.getElementById('noAnswerRate').textContent = noAnswerRate + '%';
    document.getElementById('failedRate').textContent = failedRate + '%';
}

// Top números origen
function updateTopSourceChart() {
    const sourceCounts = {};
    filteredCalls.forEach(call => {
        if (call.src) {
            sourceCounts[call.src] = (sourceCounts[call.src] || 0) + 1;
        }
    });
    
    const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    // Si no hay datos, mostrar mensaje
    if (topSources.length === 0) {
        console.log('No hay datos de origen para mostrar');
        return;
    }
    
    if (topSourceChart) topSourceChart.destroy();
    
    const ctx = document.getElementById('topSourceChart');
    if (!ctx) {
        console.error('Canvas topSourceChart no encontrado');
        return;
    }
    
    topSourceChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: topSources.map(s => s[0]),
            datasets: [{
                label: 'Llamadas',
                data: topSources.map(s => s[1]),
                backgroundColor: '#764ba2',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { 
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

// Duración promedio por hora
function updateAvgDurationChart() {
    const hourData = Array(24).fill(0);
    const hourCounts = Array(24).fill(0);
    
    filteredCalls.forEach(call => {
        if (call.calldate && call.billsec) {
            const timeMatch = call.calldate.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const hour = parseInt(timeMatch[1]);
                hourData[hour] += parseInt(call.billsec || 0);
                hourCounts[hour]++;
            }
        }
    });
    
    const avgData = hourData.map((total, i) => 
        hourCounts[i] > 0 ? Math.round(total / hourCounts[i]) : 0
    );
    
    if (avgDurationChart) avgDurationChart.destroy();
    
    const ctx = document.getElementById('avgDurationChart');
    if (!ctx) {
        console.error('Canvas avgDurationChart no encontrado');
        return;
    }
    
    avgDurationChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Duración Promedio (seg)',
                data: avgData,
                backgroundColor: '#ff9800',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { 
                        callback: (value) => value + 's'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Llamadas por día de semana
function updateWeekdayChart() {
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weekdayCounts = Array(7).fill(0);
    
    filteredCalls.forEach(call => {
        if (call.calldate) {
            // Parsear fecha en formato "31/10/25, 16:39"
            const dateMatch = call.calldate.match(/(\d{2})\/(\d{2})\/(\d{2})/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = 2000 + parseInt(dateMatch[3]);
                const date = new Date(year, month, day);
                weekdayCounts[date.getDay()]++;
            }
        }
    });
    
    if (weekdayChart) weekdayChart.destroy();
    
    const ctx = document.getElementById('weekdayChart');
    if (!ctx) {
        console.error('Canvas weekdayChart no encontrado');
        return;
    }
    
    weekdayChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: weekdays,
            datasets: [{
                label: 'Llamadas',
                data: weekdayCounts,
                backgroundColor: [
                    '#f44336', '#2196f3', '#4caf50', '#ff9800', 
                    '#9c27b0', '#00bcd4', '#ffeb3b'
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

// Mapa de calor
function updateHeatmap() {
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const heatmapData = Array(7).fill(null).map(() => Array(24).fill(0));
    
    filteredCalls.forEach(call => {
        if (call.calldate) {
            const dateMatch = call.calldate.match(/(\d{2})\/(\d{2})\/(\d{2}), (\d{1,2}):/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = 2000 + parseInt(dateMatch[3]);
                const hour = parseInt(dateMatch[4]);
                const date = new Date(year, month, day);
                const weekday = date.getDay();
                heatmapData[weekday][hour]++;
            }
        }
    });
    
    const maxValue = Math.max(...heatmapData.flat());
    
    const container = document.getElementById('heatmapContainer');
    
    // Crear encabezado de horas
    let html = '<div class="heatmap-header"><div></div>';
    for (let h = 0; h < 24; h++) {
        html += `<div class="heatmap-hour">${h}</div>`;
    }
    html += '</div>';
    
    // Crear filas
    html += '<div class="heatmap">';
    for (let d = 0; d < 7; d++) {
        html += '<div class="heatmap-row">';
        html += `<div class="heatmap-label">${weekdays[d]}</div>`;
        for (let h = 0; h < 24; h++) {
            const value = heatmapData[d][h];
            const intensity = maxValue > 0 ? value / maxValue : 0;
            const color = getHeatmapColor(intensity);
            const displayValue = value > 0 ? value : '';
            html += `<div class="heatmap-cell" style="background: ${color}" title="${weekdays[d]} ${h}:00 - ${value} llamadas">${displayValue}</div>`;
        }
        html += '</div>';
    }
    html += '</div>';
    
    // Leyenda
    html += '<div class="heatmap-legend">';
    html += '<span>Menos</span>';
    for (let i = 0; i <= 5; i++) {
        const color = getHeatmapColor(i / 5);
        html += `<div class="legend-item"><div class="legend-color" style="background: ${color}"></div></div>`;
    }
    html += '<span>Más</span>';
    html += '</div>';
    
    container.innerHTML = html;
}

function getHeatmapColor(intensity) {
    if (intensity === 0) return '#f5f5f5';
    const colors = [
        '#e3f2fd',
        '#90caf9',
        '#42a5f5',
        '#1e88e5',
        '#1565c0',
        '#0d47a1'
    ];
    const index = Math.min(Math.floor(intensity * colors.length), colors.length - 1);
    return colors[index];
}

// Tabla de top destinos
function updateTopDestinationsTable() {
    const destStats = {};
    
    filteredCalls.forEach(call => {
        const dest = call.destination || call.dst;
        if (!dest) return;
        
        if (!destStats[dest]) {
            destStats[dest] = {
                total: 0,
                answered: 0,
                noAnswer: 0,
                failed: 0,
                duration: 0
            };
        }
        
        destStats[dest].total++;
        destStats[dest].duration += parseInt(call.billsec || 0);
        
        if (call.disposition === 'ANSWERED') destStats[dest].answered++;
        else if (call.disposition === 'NO ANSWER') destStats[dest].noAnswer++;
        else if (call.disposition === 'FAILED') destStats[dest].failed++;
    });
    
    const sorted = Object.entries(destStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);
    
    const tbody = document.getElementById('topDestinationsBody');
    tbody.innerHTML = '';
    
    sorted.forEach(([dest, stats]) => {
        const avgDuration = stats.answered > 0 ? Math.round(stats.duration / stats.answered) : 0;
        const successRate = ((stats.answered / stats.total) * 100).toFixed(1);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>Ext. ${dest}</strong></td>
            <td>${stats.total}</td>
            <td><span class="badge badge-success">${stats.answered}</span></td>
            <td><span class="badge badge-warning">${stats.noAnswer}</span></td>
            <td><span class="badge badge-danger">${stats.failed}</span></td>
            <td>${Math.floor(stats.duration / 60)}m ${stats.duration % 60}s</td>
            <td>${avgDuration}s</td>
            <td>
                ${successRate}%
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${successRate}%"></div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// KPIs adicionales
function updateKPIs() {
    // Duración promedio
    const answeredCalls = filteredCalls.filter(c => c.disposition === 'ANSWERED');
    const totalDuration = answeredCalls.reduce((sum, c) => sum + parseInt(c.billsec || 0), 0);
    const avgDuration = answeredCalls.length > 0 ? Math.round(totalDuration / answeredCalls.length) : 0;
    document.getElementById('avgCallDuration').textContent = avgDuration + 's';
    
    // Hora pico
    const hourCounts = Array(24).fill(0);
    filteredCalls.forEach(call => {
        if (call.calldate) {
            const timeMatch = call.calldate.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                hourCounts[parseInt(timeMatch[1])]++;
            }
        }
    });
    const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
    document.getElementById('peakHour').textContent = `${peakHourIndex}:00`;
    
    // Extensión más ocupada
    const destCounts = {};
    filteredCalls.forEach(call => {
        const dest = call.destination || call.dst;
        if (dest) destCounts[dest] = (destCounts[dest] || 0) + 1;
    });
    const busiest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('busyExtension').textContent = busiest ? `Ext. ${busiest[0]}` : '-';
    
    // Tiempo de espera promedio (ring time)
    const totalRingTime = filteredCalls.reduce((sum, c) => {
        const duration = parseInt(c.duration || 0);
        const billsec = parseInt(c.billsec || 0);
        return sum + (duration - billsec);
    }, 0);
    const avgWaitTime = filteredCalls.length > 0 ? Math.round(totalRingTime / filteredCalls.length) : 0;
    document.getElementById('avgWaitTime').textContent = avgWaitTime + 's';
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

// ============================================
// INTEGRACIÓN CON CUAD TELMEX
// ============================================

// Obtener primer y último día del mes actual
function getCurrentMonthDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    return {
        from: formatDateForCUAD(firstDay),
        to: formatDateForCUAD(lastDay),
        fromInput: formatDateForInput(firstDay),
        toInput: formatDateForInput(lastDay)
    };
}

// Formatear fecha para CUAD (YYYY-MM-DD HH:mm)
function formatDateForCUAD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Formatear fecha para input datetime-local
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Establecer fechas por defecto en formulario personalizado
function setDefaultCustomDates() {
    const dates = getCurrentMonthDates();
    document.getElementById('customFromDate').value = dates.fromInput;
    document.getElementById('customToDate').value = dates.toInput;
}

// Configurar formulario de credenciales (login inicial)
function setupCredentialsForm() {
    const form = document.getElementById('credentialsForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await iniciarSesionYCargarDatos();
    });
    
    // Botón de logout
    document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
}

// Configurar formulario de consulta personalizada
function setupCustomQueryForm() {
    const form = document.getElementById('customQueryForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await consultarConParametrosPersonalizados();
        });
    }
}

// Configurar controles del dashboard
function setupDashboardControls() {
    // Botón nueva consulta
    document.getElementById('btnNewQuery').addEventListener('click', () => {
        const panel = document.getElementById('quickQueryPanel');
        panel.classList.remove('hidden');
        setDefaultQuickDates();
    });
    
    // Botón cerrar panel
    document.getElementById('btnCloseQuery').addEventListener('click', () => {
        document.getElementById('quickQueryPanel').classList.add('hidden');
    });
    
    // Botón logout del dashboard
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
}

// Configurar panel de consulta rápida
function setupQuickQueryPanel() {
    const form = document.getElementById('quickQueryForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await ejecutarConsultaRapida();
    });
    
    // Atajos de fecha
    document.querySelectorAll('.btn-shortcut').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const range = e.target.dataset.range;
            aplicarRangoFecha(range);
            
            // Efecto visual
            document.querySelectorAll('.btn-shortcut').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// Establecer fechas por defecto para consulta rápida
function setDefaultQuickDates() {
    const dates = getCurrentMonthDates();
    document.getElementById('quickFromDate').value = dates.fromInput;
    document.getElementById('quickToDate').value = dates.toInput;
}

// Aplicar rangos de fecha predefinidos
function aplicarRangoFecha(range) {
    const now = new Date();
    let from, to;
    
    switch(range) {
        case 'today':
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
            
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0);
            to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59);
            break;
            
        case 'week':
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            from = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
            
        case 'month':
            from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
            
        case 'last7':
            from = new Date(now);
            from.setDate(from.getDate() - 7);
            from.setHours(0, 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
            
        case 'last30':
            from = new Date(now);
            from.setDate(from.getDate() - 30);
            from.setHours(0, 0, 0);
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
            
        default:
            from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0);
            to = now;
    }
    
    document.getElementById('quickFromDate').value = formatDateForInput(from);
    document.getElementById('quickToDate').value = formatDateForInput(to);
}

// Ejecutar consulta rápida
async function ejecutarConsultaRapida() {
    if (!sessionData.isActive) {
        showQuickAlert('❌ Error: No hay sesión activa', 'error');
        return;
    }
    
    const queryBtn = document.getElementById('quickQueryBtn');
    const queryBtnText = document.getElementById('quickQueryBtnText');
    const queryBtnLoader = document.getElementById('quickQueryBtnLoader');
    
    const fromDate = document.getElementById('quickFromDate').value.replace('T', ' ');
    const toDate = document.getElementById('quickToDate').value.replace('T', ' ');
    const source = document.getElementById('quickSource').value;
    const destination = document.getElementById('quickDestination').value;
    
    queryBtn.disabled = true;
    queryBtnText.classList.add('hidden');
    queryBtnLoader.classList.remove('hidden');
    
    try {
        showQuickAlert(`🔄 Consultando: ${fromDate} - ${toDate}...`, 'info');
        
        // Siempre usar las credenciales guardadas para nueva consulta
        const result = await consultaTelmex(
            sessionData.userid,
            sessionData.userpass,
            fromDate,
            toDate,
            source,
            destination
        );
        
        if (result.data && result.data.rows) {
            showQuickAlert(`✓ Consulta exitosa: ${result.data.count} registros encontrados`, 'success');
            
            const formattedData = formatCUADData(result.data);
            loadData(formattedData);
            
            // Cerrar panel después de 2 segundos
            setTimeout(() => {
                document.getElementById('quickQueryPanel').classList.add('hidden');
            }, 2000);
        } else {
            throw new Error('No se recibieron datos del servidor');
        }
        
    } catch (error) {
        console.error('Error en consulta rápida:', error);
        showQuickAlert('❌ Error: ' + error.message, 'error');
    } finally {
        queryBtn.disabled = false;
        queryBtnText.classList.remove('hidden');
        queryBtnLoader.classList.add('hidden');
    }
}

// Mostrar alertas en panel rápido
function showQuickAlert(message, type) {
    const alertMsg = document.getElementById('quickAlertMsg');
    alertMsg.textContent = message;
    alertMsg.className = `alert ${type}`;
    alertMsg.classList.remove('hidden');
}

// Iniciar sesión y cargar datos del mes actual
async function iniciarSesionYCargarDatos() {
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginBtnLoader = document.getElementById('loginBtnLoader');
    const alertMsg = document.getElementById('alertMsg');
    
    const userid = document.getElementById('userid').value;
    const userpass = document.getElementById('userpass').value;
    
    // Guardar credenciales en sesión (necesarias para consultas posteriores)
    sessionData.userid = userid;
    sessionData.userpass = userpass;
    
    // Deshabilitar botón
    loginBtn.disabled = true;
    loginBtnText.classList.add('hidden');
    loginBtnLoader.classList.remove('hidden');
    
    try {
        showAlert('🔐 Iniciando sesión en CUAD Telmex...', 'info');
        
        // Obtener fechas del mes actual
        const dates = getCurrentMonthDates();
        
        showAlert(`📊 Consultando CDR desde ${dates.from} hasta ${dates.to}...`, 'info');
        
        const result = await consultaTelmex(userid, userpass, dates.from, dates.to, '', '');
        
        if (result.data && result.data.rows) {
            sessionData.isActive = true;
            
            showAlert(`✓ Consulta exitosa: ${result.data.count} registros encontrados`, 'success');
            
            // Actualizar UI
            document.getElementById('sessionUser').textContent = userid;
            document.getElementById('step1').classList.add('hidden');
            document.getElementById('step2').classList.remove('hidden');
            
            // Cargar datos en el dashboard
            const formattedData = formatCUADData(result.data);
            loadData(formattedData);
        } else {
            throw new Error('No se recibieron datos del servidor');
        }
        
    } catch (error) {
        console.error('Error en inicio de sesión:', error);
        showAlert('❌ Error: ' + error.message, 'error');
        sessionData.isActive = false;
    } finally {
        loginBtn.disabled = false;
        loginBtnText.classList.remove('hidden');
        loginBtnLoader.classList.add('hidden');
    }
}

// Consultar con parámetros personalizados
async function consultarConParametrosPersonalizados() {
    if (!sessionData.isActive) {
        showAlert('❌ Error: No hay sesión activa', 'error');
        return;
    }
    
    const queryBtn = document.getElementById('queryBtn');
    const queryBtnText = document.getElementById('queryBtnText');
    const queryBtnLoader = document.getElementById('queryBtnLoader');
    
    const fromDate = document.getElementById('customFromDate').value.replace('T', ' ');
    const toDate = document.getElementById('customToDate').value.replace('T', ' ');
    const source = document.getElementById('customSource').value;
    const destination = document.getElementById('customDestination').value;
    
    queryBtn.disabled = true;
    queryBtnText.classList.add('hidden');
    queryBtnLoader.classList.remove('hidden');
    
    try {
        showAlert(`🔄 Actualizando consulta: ${fromDate} - ${toDate}...`, 'info');
        
        // Usar credenciales guardadas para nueva consulta
        const result = await consultaTelmex(
            sessionData.userid,
            sessionData.userpass,
            fromDate,
            toDate,
            source,
            destination
        );
        
        if (result.data && result.data.rows) {
            showAlert(`✓ Consulta actualizada: ${result.data.count} registros encontrados`, 'success');
            
            const formattedData = formatCUADData(result.data);
            loadData(formattedData);
        } else {
            throw new Error('No se recibieron datos del servidor');
        }
        
    } catch (error) {
        console.error('Error en consulta:', error);
        showAlert('❌ Error: ' + error.message, 'error');
    } finally {
        queryBtn.disabled = false;
        queryBtnText.classList.remove('hidden');
        queryBtnLoader.classList.add('hidden');
    }
}

// Cerrar sesión
async function cerrarSesion() {
    // Notificar al backend
    if (sessionData.sessionId) {
        try {
            await fetch(`${API_URL}/cdr/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: sessionData.sessionId
                })
            });
        } catch (error) {
            console.error('Error al cerrar sesión en backend:', error);
        }
    }
    
    // Limpiar sesión
    sessionData = {
        userid: '',
        userpass: '',
        sessionId: '',
        isActive: false
    };
    
    // Limpiar datos
    allCalls = [];
    filteredCalls = [];
    selectedExtensions = [];
    
    // Destruir gráficos
    if (dispositionChart) {
        dispositionChart.destroy();
        dispositionChart = null;
    }
    if (extensionChart) {
        extensionChart.destroy();
        extensionChart = null;
    }
    if (hourChart) {
        hourChart.destroy();
        hourChart = null;
    }
    if (topSourceChart) {
        topSourceChart.destroy();
        topSourceChart = null;
    }
    if (avgDurationChart) {
        avgDurationChart.destroy();
        avgDurationChart = null;
    }
    if (weekdayChart) {
        weekdayChart.destroy();
        weekdayChart = null;
    }
    
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('userid').value = '';
    document.getElementById('userpass').value = '';
    
    // Ocultar dashboard y mostrar sección de upload
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('quickQueryPanel').classList.add('hidden');
    
    showAlert('✓ Sesión cerrada correctamente', 'info');
}

// Mostrar alertas
function showAlert(message, type) {
    const alertMsg = document.getElementById('alertMsg');
    alertMsg.textContent = message;
    alertMsg.className = `alert ${type}`;
    alertMsg.classList.remove('hidden');
}

// Formatear datos de CUAD al formato del dashboard
function formatCUADData(data) {
    const headers = ['cdr_id', 'calldate', 'clid', 'source', 'src', 'dst', 'destination', 
                    'dcontext', 'channel', 'dstchannel', 'lastapp', 'lastdata', 
                    'duration', 'billsec', 'disposition', 'amaflags'];
    
    const rows = data.rows.map(row => [
        row.cdr_id,
        row.calldate,
        row.clid,
        row.source,
        row.src || row.source,
        row.dst || row.destination,
        row.destination,
        row.dcontext,
        row.channel,
        row.dstchannel,
        row.lastapp,
        row.lastdata,
        row.duration,
        row.billsec,
        row.disposition,
        row.amaflags
    ]);
    
    return [headers, ...rows];
}

// NOTA IMPORTANTE: Ahora usa la API backend
async function consultaTelmex(userid, userpass, fromDate, toDate, source = '', destination = '') {
    try {
        const response = await fetch(`${API_URL}/cdr/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userid: userid,
                userpass: userpass,
                from: fromDate,
                to: toDate,
                source: source,
                destination: destination,
                page_size: '999999'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la consulta');
        }
        
        const result = await response.json();
        
        // Guardar sessionId para futuras consultas
        if (result.sessionId) {
            sessionData.sessionId = result.sessionId;
        }
        
        return {
            status: response.status,
            data: result.data
        };
        
    } catch (error) {
        throw new Error('Error al conectar con la API: ' + error.message);
    }
}

// Consultar usando sesión existente (más rápido)
async function consultaTelmexRefresh(fromDate, toDate, source = '', destination = '') {
    if (!sessionData.sessionId) {
        throw new Error('No hay sesión activa');
    }
    
    try {
        const response = await fetch(`${API_URL}/cdr/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionData.sessionId,
                from: fromDate,
                to: toDate,
                source: source,
                destination: destination,
                page_size: '999999'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la consulta');
        }
        
        const result = await response.json();
        
        return {
            status: response.status,
            data: result.data
        };
        
    } catch (error) {
        throw new Error('Error al refrescar datos: ' + error.message);
    }
}