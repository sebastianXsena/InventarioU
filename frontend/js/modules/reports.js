(function(App) {
  'use strict';

  let charts = {};

  async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const content = document.getElementById('reportContent');

    if (!startDate || !endDate) {
      content.innerHTML = '<div class="empty-state">Selecciona un rango de fechas.</div>';
      return;
    }

    content.innerHTML = '<div class="loading">Generando reporte...</div>';

    try {
      const data = await API.getReportByDateRange(startDate, endDate);
      
      let html = `
        <div class="report-stats">
          <div class="report-stat-card"><div class="report-stat-card__title">Total Reservas</div><div class="report-stat-card__value">${data.total_reservations}</div></div>
          <div class="report-stat-card"><div class="report-stat-card__title">Aprobadas</div><div class="report-stat-card__value">${data.approved_reservations}</div></div>
          <div class="report-stat-card"><div class="report-stat-card__title">Canceladas</div><div class="report-stat-card__value">${data.cancelled_reservations}</div></div>
        </div>
      `;

      if (data.total_reservations > 0) {
        html += `
          <div class="charts-grid">
            <div class="chart-card">
              <h3 class="chart-card__title">Estado de Reservas</h3>
              <div class="chart-container"><canvas id="statusChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h3 class="chart-card__title">Reservas por Laboratorio</h3>
              <div class="chart-container"><canvas id="labChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h3 class="chart-card__title">Demanda por Día</h3>
              <div class="chart-container"><canvas id="trendChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h3 class="chart-card__title">Top Materiales Solicitados</h3>
              <div class="chart-container"><canvas id="itemsChart"></canvas></div>
            </div>
          </div>
          <div style="text-align: right; margin-top: 1.5rem;">
            <button class="btn btn--outline" onclick="window.open('/report-template.html?start=${startDate}&end=${endDate}', '_blank')">
              <i class="ph ph-printer"></i> Imprimir Reporte
            </button>
          </div>
        `;
      } else {
        html += '<div class="empty-state">No hay reservas en este periodo.</div>';
      }

      content.innerHTML = html;

      if (data.total_reservations > 0 && typeof Chart !== 'undefined') {
        const textColor = App.Theme.getEffectiveTheme() === 'dark' ? '#f1f5f9' : '#1e293b';
        const gridColor = App.Theme.getEffectiveTheme() === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
          }
        };

        const statusCtx = document.getElementById('statusChart').getContext('2d');
        if (charts.status) charts.status.destroy();
        charts.status = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: ['Pendientes', 'Aprobadas', 'Rechazadas', 'Canceladas', 'Completadas'],
            datasets: [{
              data: [
                data.by_status.pending || 0,
                data.by_status.approved || 0,
                data.by_status.rejected || 0,
                data.by_status.cancelled || 0,
                data.by_status.completed || 0
              ],
              backgroundColor: ['#f59e0b', '#10b981', '#ef4444', '#64748b', '#4f46e5']
            }]
          },
          options: { ...chartOptions, scales: {} }
        });

        const labCtx = document.getElementById('labChart').getContext('2d');
        const labLabels = data.by_lab.map(l => l.lab_name);
        const labData = data.by_lab.map(l => l.count);
        if (charts.lab) charts.lab.destroy();
        charts.lab = new Chart(labCtx, {
          type: 'bar',
          data: {
            labels: labLabels,
            datasets: [{ label: 'Reservas', data: labData, backgroundColor: '#4f46e5' }]
          },
          options: chartOptions
        });

        const trendCtx = document.getElementById('trendChart').getContext('2d');
        const trendLabels = data.trend.map(t => new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        const trendData = data.trend.map(t => t.count);
        if (charts.trend) charts.trend.destroy();
        charts.trend = new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{ label: 'Reservas', data: trendData, borderColor: '#10b981', tension: 0.3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]
          },
          options: chartOptions
        });

        const itemCtx = document.getElementById('itemsChart').getContext('2d');
        const itemLabels = data.top_items.map(i => i.item_name);
        const itemData = data.top_items.map(i => i.total_requested);
        if (charts.item) charts.item.destroy();
        charts.item = new Chart(itemCtx, {
          type: 'bar',
          data: {
            labels: itemLabels,
            datasets: [{ label: 'Unidades Solicitadas', data: itemData, backgroundColor: '#f59e0b' }]
          },
          options: chartOptions
        });
      }
    } catch (err) {
      content.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function init() {
    const genBtn = document.getElementById('generateReportBtn');
    if (genBtn) {
      genBtn.removeEventListener('click', generateReport);
      genBtn.addEventListener('click', generateReport);
    }
    
    // Set default dates (last 30 days)
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    
    const endInput = document.getElementById('reportEndDate');
    const startInput = document.getElementById('reportStartDate');
    
    if (endInput && !endInput.value) {
      endInput.value = today.toISOString().split('T')[0];
    }
    if (startInput && !startInput.value) {
      startInput.value = lastMonth.toISOString().split('T')[0];
    }
  }

  App.Reports = {
    generateReport,
    init
  };

})(window.App = window.App || {});
