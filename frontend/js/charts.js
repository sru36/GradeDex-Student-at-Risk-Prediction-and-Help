/**
 * charts.js — Chart.js wrappers for GradeDex visualisations.
 * All charts use a consistent dark palette matching the CSS design system.
 */

const Charts = (() => {

  // ── Shared colour palette ──────────────────────────────────────────────────
  const PALETTE = {
    primary:  '#6366f1',
    violet:   '#8b5cf6',
    accent:   '#a78bfa',
    lavender: '#a8a6f3',
    mint:     '#a8ddc0',
    emerald:  '#10b981',
    amber:    '#f59e0b',
    rose:     '#ef4444',
    sky:      '#3b82f6',
    muted:    'rgba(255,255,255,0.08)',
    grid:     'rgba(152,152,200,0.18)',
    text:     '#7e86a0',
  };

  const GRADE_COLORS = {
    F:   '#ef4444',
    D:   '#f97316',
    C:   '#f59e0b',
    B:   '#eab308',
    'B+': '#84cc16',
    A:   '#22c55e',
    AA:  '#10b981',
    AAA: '#14b8a6',
  };

  const MODEL_COLORS = [
    'rgba(99,102,241,0.8)',
    'rgba(139,92,246,0.8)',
    'rgba(59,130,246,0.8)',
    'rgba(16,185,129,0.8)',
    'rgba(245,158,11,0.8)',
    'rgba(167,139,250,0.8)',
  ];

  const DASHBOARD_COMPARISON_REFERENCE = [
    {
      label: 'Logistic Regression',
      accuracy: 66,
      cv_f1: 65,
      f1_score: 76,
    },
    {
      label: 'Random Forest',
      accuracy: 90,
      cv_f1: 96,
      f1_score: 89,
    },
    {
      label: 'SVM',
      accuracy: 93,
      cv_f1: 97,
      f1_score: 93,
    },
    {
      label: 'Gradient Boosting',
      accuracy: 93,
      cv_f1: 96,
      f1_score: 93,
    },
    {
      label: 'XGBoost (default)',
      accuracy: 93,
      cv_f1: 97,
      f1_score: 93,
    },
    {
      label: 'XGBoost (Tuned)',
      accuracy: 94.5,
      cv_f1: 97.5,
      f1_score: 94,
    },
  ];

  // Shared Chart.js defaults
  Chart.defaults.color = PALETTE.text;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;

  const _baseScales = {
    x: {
      grid: { color: PALETTE.grid },
      ticks: { color: PALETTE.text },
    },
    y: {
      grid: { color: PALETTE.grid },
      ticks: { color: PALETTE.text },
    },
  };

  const _instances = {};

  function _destroy(id) {
    if (_instances[id]) {
      _instances[id].destroy();
      delete _instances[id];
    }
  }

  function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  // ── 1. Class Distribution Donut ─────────────────────────────────────────────
  function renderDistributionChart(classDistribution) {
    _destroy('distribution');
    const ctx = document.getElementById('chart-distribution');
    if (!ctx) return;

    const lightTheme = isLightTheme();
    const distributionMap = classDistribution || {};
    const requestedOrder = ['Medium', 'Low', 'High'];
    const isRiskDistribution = requestedOrder.every(label => Object.prototype.hasOwnProperty.call(distributionMap, label));
    const labels = isRiskDistribution ? requestedOrder : Object.keys(distributionMap);
    const values = labels.map(label => distributionMap[label]);
    const colors = labels.map(label => {
      if (label === 'Medium') return '#FFD8BE';
      if (label === 'Low') return '#FFB3B3';
      if (label === 'High') return '#B3E6CB';
      return GRADE_COLORS[label] || PALETTE.primary;
    });

    _instances['distribution'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          spacing: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 18,
              boxWidth: 10,
              boxHeight: 10,
              color: lightTheme ? '#5f6d85' : PALETTE.text,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 11,
                weight: '500',
              },
            },
          },
          tooltip: {
            backgroundColor: lightTheme ? 'rgba(255,255,255,0.96)' : 'rgba(15,15,34,0.96)',
            titleColor: lightTheme ? '#253045' : '#f5f3ff',
            bodyColor: lightTheme ? '#4f5d75' : '#ddd6fe',
            borderColor: lightTheme ? 'rgba(147,129,255,0.16)' : 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
        cutout: '58%',
        animation: { animateScale: true, duration: 700 },
      },
    });
  }

  // ── 2. Model Comparison Bar Chart ───────────────────────────────────────────
  function renderComparisonChart(allMetrics) {
    _destroy('comparison');
    const ctx = document.getElementById('chart-comparison');
    if (!ctx) return;

    const lightTheme = isLightTheme();
    const chartRows = DASHBOARD_COMPARISON_REFERENCE;
    const labels  = chartRows.map(row => row.label);
    const accData = chartRows.map(row => row.accuracy);
    const f1Data  = chartRows.map(row => row.f1_score);
    const cvData  = chartRows.map(row => row.cv_f1);
    const legendOrder = ['Accuracy (%)', 'CV F1 (%)', 'F1-Score (%)'];

    _instances['comparison'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Accuracy (%)',
            data: accData,
            backgroundColor: 'rgba(129,116,234,0.92)',
            borderColor: 'rgba(129,116,234,0.92)',
            borderWidth: 0,
            borderRadius: 5,
            borderSkipped: false,
            categoryPercentage: 0.82,
            barPercentage: 0.9,
            maxBarThickness: 38,
          },
          {
            label: 'F1-Score (%)',
            data: f1Data,
            backgroundColor: 'rgba(168,166,243,0.96)',
            borderColor: 'rgba(168,166,243,0.96)',
            borderWidth: 0,
            borderRadius: 5,
            borderSkipped: false,
            categoryPercentage: 0.82,
            barPercentage: 0.9,
            maxBarThickness: 38,
          },
          {
            label: 'CV F1 (%)',
            data: cvData,
            backgroundColor: 'rgba(168,221,192,0.96)',
            borderColor: 'rgba(168,221,192,0.96)',
            borderWidth: 0,
            borderRadius: 5,
            borderSkipped: false,
            categoryPercentage: 0.82,
            barPercentage: 0.9,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 16, right: 10, bottom: 0, left: 0 },
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            border: { display: false },
            ticks: {
              color: lightTheme ? '#6b7280' : '#8c89aa',
              padding: 12,
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 11,
                weight: '500',
              },
            },
          },
          y: {
            grid: {
              color: lightTheme ? 'rgba(147,129,255,0.12)' : 'rgba(201,197,236,0.14)',
              drawBorder: false,
              drawTicks: false,
              borderDash: [3, 3],
            },
            border: { display: false },
            min: 0,
            max: 100,
            ticks: {
              color: lightTheme ? '#6b7280' : '#8f8cae',
              stepSize: 10,
              padding: 10,
              font: {
                size: 11,
                weight: '500',
              },
              callback: v => `${v}%`,
            },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: lightTheme ? '#9381FF' : '#9b97c7',
              boxWidth: 12,
              boxHeight: 12,
              padding: 18,
              usePointStyle: true,
              pointStyle: 'rect',
              generateLabels: chart => {
                const generated = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                return legendOrder
                  .map(label => {
                    const match = generated.find(item => item.text === label);
                    if (!match) return null;
                    return {
                      ...match,
                      fontColor: match.fillStyle,
                      strokeStyle: match.fillStyle,
                    };
                  })
                  .filter(Boolean);
              },
            },
          },
          tooltip: {
            backgroundColor: lightTheme ? 'rgba(255,255,255,0.96)' : 'rgba(15,15,34,0.96)',
            titleColor: lightTheme ? '#253045' : '#f5f3ff',
            bodyColor: lightTheme ? '#4f5d75' : '#ddd6fe',
            borderColor: lightTheme ? 'rgba(147,129,255,0.16)' : 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`,
            },
          },
        },
        animation: { duration: 850 },
      },
    });
  }

  // ── 3. Feature Importance Horizontal Bar ────────────────────────────────────
  function renderImportanceChart(featureImportance) {
    _destroy('importance');
    const ctx = document.getElementById('chart-importance');
    if (!ctx) return;

    const sorted = Object.entries(featureImportance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sorted.map(([k]) => k.replace(/_/g, ' '));
    const values = sorted.map(([, v]) => +(v * 100).toFixed(3));

    // Gradient colours: top features are more vivid
    const bgColors = labels.map((_, i) => {
      const alpha = 0.9 - i * 0.06;
      return `rgba(99,102,241,${alpha})`;
    });

    _instances['importance'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Importance (%)',
          data: values,
          backgroundColor: bgColors,
          borderColor: bgColors.map(c => c.replace('0.\d+', '1')),
          borderWidth: 0,
          borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: PALETTE.grid },
            ticks: { color: PALETTE.text, callback: v => v + '%' },
          },
          y: {
            grid: { color: 'transparent' },
            ticks: { color: PALETTE.text, font: { size: 11.5 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Importance: ${ctx.raw.toFixed(3)}%`,
            },
          },
        },
        animation: { duration: 700 },
      },
    });
  }

  // ── 4. Confusion Matrix Heatmap (Canvas 2D) ─────────────────────────────────
  function renderConfusionMatrix(matrix, labels) {
    const canvas = document.getElementById('chart-confusion');
    if (!canvas || !matrix || !matrix.length) return;

    const n      = labels.length;
    const dpr    = window.devicePixelRatio || 1;
    const PAD    = { top: 32, left: 56, right: 20, bottom: 56 };
    const CELL   = Math.min(Math.floor((canvas.offsetWidth - PAD.left - PAD.right) / n), 52);
    const W      = PAD.left + CELL * n + PAD.right;
    const H      = PAD.top  + CELL * n + PAD.bottom;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Row-normalise for colour intensity
    const rowMax = matrix.map(row => Math.max(...row, 1));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const val  = matrix[r][c];
        const norm = val / rowMax[r];
        const x    = PAD.left + c * CELL;
        const y    = PAD.top  + r * CELL;

        // Cell background
        if (r === c) {
          // Diagonal — correct predictions (indigo)
          ctx.fillStyle = `rgba(99,102,241,${0.15 + norm * 0.75})`;
        } else if (val > 0) {
          // Off-diagonal — errors (red)
          ctx.fillStyle = `rgba(239,68,68,${0.08 + norm * 0.55})`;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
        }
        ctx.fillRect(x, y, CELL - 1, CELL - 1);

        // Cell text
        if (val > 0) {
          ctx.fillStyle = norm > 0.5 ? '#fff' : '#c8c8e8';
          ctx.font = `${CELL > 42 ? 11 : 9}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, x + CELL / 2, y + CELL / 2);
        }
      }
    }

    // Column labels (top)
    ctx.fillStyle = '#9898c8';
    ctx.font = `bold ${CELL > 42 ? 10 : 8}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < n; c++) {
      ctx.fillText(labels[c], PAD.left + c * CELL + CELL / 2, PAD.top - 12);
    }

    // Row labels (left)
    ctx.textAlign = 'right';
    for (let r = 0; r < n; r++) {
      ctx.fillText(labels[r], PAD.left - 6, PAD.top + r * CELL + CELL / 2);
    }

    // Axis titles
    ctx.fillStyle = '#5a5a88';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Predicted', PAD.left + (CELL * n) / 2, H - 8);
    ctx.save();
    ctx.translate(10, PAD.top + (CELL * n) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Actual', 0, 0);
    ctx.restore();
  }

  return {
    renderDistributionChart,
    renderComparisonChart,
    renderImportanceChart,
    renderConfusionMatrix,
  };
})();
