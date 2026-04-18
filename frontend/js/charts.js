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
    emerald:  '#10b981',
    amber:    '#f59e0b',
    rose:     '#ef4444',
    sky:      '#3b82f6',
    muted:    'rgba(255,255,255,0.08)',
    grid:     'rgba(255,255,255,0.06)',
    text:     '#9898c8',
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

  // ── 1. Class Distribution Donut ─────────────────────────────────────────────
  function renderDistributionChart(classDistribution) {
    _destroy('distribution');
    const ctx = document.getElementById('chart-distribution');
    if (!ctx) return;

    const labels = Object.keys(classDistribution);
    const values = Object.values(classDistribution);
    const colors = labels.map(l => GRADE_COLORS[l] || PALETTE.primary);

    _instances['distribution'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, boxWidth: 12, color: PALETTE.text },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
        cutout: '65%',
        animation: { animateScale: true, duration: 700 },
      },
    });
  }

  // ── 2. Model Comparison Bar Chart ───────────────────────────────────────────
  function renderComparisonChart(allMetrics) {
    _destroy('comparison');
    const ctx = document.getElementById('chart-comparison');
    if (!ctx) return;

    const labels  = Object.keys(allMetrics);
    const accData = labels.map(k => allMetrics[k].accuracy);
    const f1Data  = labels.map(k => allMetrics[k].f1_score);
    const cvData  = labels.map(k => allMetrics[k].cv_f1_mean || 0);

    _instances['comparison'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Accuracy (%)',
            data: accData,
            backgroundColor: 'rgba(99,102,241,0.75)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'F1-Score (%)',
            data: f1Data,
            backgroundColor: 'rgba(139,92,246,0.75)',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'CV F1 (%)',
            data: cvData,
            backgroundColor: 'rgba(16,185,129,0.65)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          ..._baseScales,
          y: {
            ..._baseScales.y,
            min: 0,
            max: 100,
            ticks: { color: PALETTE.text, callback: v => v + '%' },
          },
        },
        plugins: {
          legend: {
            labels: { color: PALETTE.text, boxWidth: 12, padding: 14 },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`,
            },
          },
        },
        animation: { duration: 700 },
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
