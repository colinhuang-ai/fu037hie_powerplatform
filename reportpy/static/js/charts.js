// Dashboard Charts with Chart.js for Light Theme

document.addEventListener('DOMContentLoaded', () => {
    const prodTrendCanvas = document.getElementById('prodTrendChart');
    if (!prodTrendCanvas) return; // Only run on dashboard page

    fetch('/api/chart-data')
        .then(response => response.json())
        .then(data => {
            renderTrendChart(data.daily);
            renderReasonChart(data.reasons);
            renderProductChart(data.products);
        })
        .catch(err => console.error('Lỗi tải dữ liệu biểu đồ:', err));
});

function renderTrendChart(dailyData) {
    const ctx = document.getElementById('prodTrendChart').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dailyData.dates.map(d => {
                const parts = d.split('-');
                return `${parts[2]}/${parts[1]}`;
            }),
            datasets: [
                {
                    label: 'Sản lượng đạt (Cái)',
                    data: dailyData.actual.map((act, i) => act - dailyData.defect[i]),
                    backgroundColor: '#28a745',
                    borderRadius: 4,
                    stack: 'Stack 0',
                    order: 2
                },
                {
                    label: 'Sản phẩm lỗi (Cái)',
                    data: dailyData.defect,
                    backgroundColor: '#dc3545',
                    borderRadius: 4,
                    stack: 'Stack 0',
                    order: 2
                },
                {
                    label: 'Tỷ lệ lỗi (%)',
                    data: dailyData.rate,
                    type: 'line',
                    borderColor: '#fd7e14',
                    backgroundColor: '#fd7e14',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#fd7e14',
                    pointRadius: 4,
                    yAxisID: 'y1',
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#495057', font: { family: 'Source Sans Pro', size: 12, weight: '600' } }
                },
                tooltip: {
                    backgroundColor: '#343a40',
                    titleColor: '#ffffff',
                    bodyColor: '#e9ecef',
                    padding: 10,
                    boxPadding: 4
                }
            },
            scales: {
                x: {
                    grid: { color: '#f0f0f0' },
                    ticks: { color: '#6c757d', font: { size: 11 } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: '#e9ecef' },
                    ticks: { color: '#6c757d' },
                    title: { display: true, text: 'Số lượng máy điện (Cái)', color: '#495057', font: { size: 12, weight: '600' } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { 
                        color: '#fd7e14',
                        callback: val => val + '%'
                    },
                    title: { display: true, text: 'Tỷ lệ lỗi (%)', color: '#fd7e14', font: { size: 12, weight: '600' } },
                    min: 0
                }
            }
        }
    });
}

function renderReasonChart(reasonData) {
    const ctx = document.getElementById('defectReasonChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: reasonData.labels,
            datasets: [{
                data: reasonData.counts,
                backgroundColor: [
                    '#dc3545',
                    '#ffc107',
                    '#6f42c1',
                    '#007bff',
                    '#17a2b8',
                    '#e83e8c'
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        color: '#495057', 
                        font: { family: 'Source Sans Pro', size: 11 },
                        boxWidth: 12,
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: '#343a40',
                    titleColor: '#ffffff',
                    bodyColor: '#e9ecef',
                    padding: 10
                }
            },
            cutout: '68%'
        }
    });
}

function renderProductChart(productData) {
    const canvas = document.getElementById('productOutputChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productData.labels,
            datasets: [{
                label: 'Sản lượng đã sản xuất (Cái)',
                data: productData.data,
                backgroundColor: '#17a2b8',
                borderColor: '#138496',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#343a40',
                    titleColor: '#ffffff',
                    bodyColor: '#e9ecef'
                }
            },
            scales: {
                x: {
                    grid: { color: '#e9ecef' },
                    ticks: { color: '#6c757d' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#495057', font: { size: 12, weight: '500' } }
                }
            }
        }
    });
}
