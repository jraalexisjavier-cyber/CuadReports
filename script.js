// Variables globales
let allCalls = [];
let filteredCalls = [];
let dispositionChart = null;
let extensionChart = null;
let hourChart = null;
let selectedExtensions = [];

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

    const maxRows = 1000;
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

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);