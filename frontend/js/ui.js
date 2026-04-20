/**
 * ui.js — DOM update helpers, table renderers, toast system, and pagination.
 */

const UI = (() => {

  function formatModelName(name) {
    if (!name) return '—';
    if (name === 'Ordinal Hybrid') return 'XGboost TUNED';
    return name;
  }

  // ── Toast notifications ────────────────────────────────────────────────────
  function toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '✅',
      error:   '❌',
      info:    'ℹ️',
      warning: '⚠️',
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(32px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ── Loading overlay ────────────────────────────────────────────────────────
  function showLoading(text = 'Training model…') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').style.display = 'flex';
  }
  function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  }

  function bindHorizontalScroller(container) {
    if (!container || container.dataset.dragScrollBound === 'true') return;
    container.dataset.dragScrollBound = 'true';
    if (!container.hasAttribute('tabindex')) container.tabIndex = 0;

    let isPointerDown = false;
    let startX = 0;
    let startLeft = 0;

    const hasHorizontalOverflow = () => container.scrollWidth > container.clientWidth + 4;

    const syncScrollState = () => {
      container.classList.toggle('can-scroll-x', hasHorizontalOverflow());
    };

    const stopDrag = event => {
      if (!isPointerDown) return;
      isPointerDown = false;
      container.classList.remove('is-dragging-x');
      if (container.releasePointerCapture && event?.pointerId != null) {
        try { container.releasePointerCapture(event.pointerId); } catch (err) {}
      }
    };

    container.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!hasHorizontalOverflow()) return;
      isPointerDown = true;
      startX = event.clientX;
      startLeft = container.scrollLeft;
      container.classList.add('is-dragging-x');
      if (container.setPointerCapture && event.pointerId != null) {
        try { container.setPointerCapture(event.pointerId); } catch (err) {}
      }
    });

    container.addEventListener('pointermove', event => {
      if (!isPointerDown) return;
      const delta = event.clientX - startX;
      container.scrollLeft = startLeft - delta;
      event.preventDefault();
    });

    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);
    container.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') stopDrag(event);
    });

    container.addEventListener('wheel', event => {
      if (!hasHorizontalOverflow()) return;
      const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (!dominantDelta) return;
      container.scrollLeft += dominantDelta;
      event.preventDefault();
    }, { passive: false });

    container.addEventListener('keydown', event => {
      if (!hasHorizontalOverflow()) return;
      const STEP = 120;
      if (event.key === 'ArrowRight') {
        container.scrollLeft += STEP;
        event.preventDefault();
      } else if (event.key === 'ArrowLeft') {
        container.scrollLeft -= STEP;
        event.preventDefault();
      } else if (event.key === 'Home') {
        container.scrollLeft = 0;
        event.preventDefault();
      } else if (event.key === 'End') {
        container.scrollLeft = container.scrollWidth;
        event.preventDefault();
      }
    });

    window.addEventListener('resize', syncScrollState);
    syncScrollState();
  }

  function refreshHorizontalScrollers() {
    document.querySelectorAll('.table-wrap, .intervention-scroll').forEach(bindHorizontalScroller);
  }

  // ── Sidebar status indicator ───────────────────────────────────────────────
  function setStatus(state, text) {
    const dot  = document.getElementById('status-dot');
    const span = document.getElementById('status-text');
    dot.className = `status-dot ${state}`;
    span.textContent = text;
  }

  // ── Dashboard stat cards ───────────────────────────────────────────────────
  function updateStats(info) {
    const acc = info.accuracy != null ? `${info.accuracy}%` : '—';
    const f1  = info.f1_score  != null ? `${info.f1_score}%`  : '—';
    const tot = info.total_samples != null ? info.total_samples.toLocaleString() : '—';
    const bestModel = formatModelName(info.best_model);

    animateValue('stat-accuracy', acc);
    animateValue('stat-total',    tot);
    animateValue('stat-f1',       f1);
    animateValue('stat-best-model', bestModel);

    const hint = document.getElementById('hint-banner');
    if (hint) hint.style.display = 'none';
  }

  function animateValue(id, finalVal) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all 0.4s ease';
    requestAnimationFrame(() => {
      el.textContent = finalVal;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }

  // ── SMOTE info block ───────────────────────────────────────────────────────
  function renderSmoteInfo(smoteDetails) {
    const badge = document.getElementById('smote-badge');
    const info  = document.getElementById('smote-info');
    if (!info || !badge) return;
    if (!smoteDetails) {
      badge.style.display = 'none';
      info.style.display = 'none';
      info.innerHTML = '';
      return;
    }

    badge.style.display = 'inline-flex';
    info.style.display  = 'grid';

    const orig  = smoteDetails.original    || {};
    const after = smoteDetails.after_smote || {};
    const grades = orderedGradeLabels([
      ...Object.keys(orig),
      ...Object.keys(after),
    ]);

    info.innerHTML = grades.map(g => `
      <div class="smote-row">
        <span>${g} before</span>
        <strong style="color:${gradeColor(g)}">${orig[g] ?? '—'}</strong>
      </div>
      <div class="smote-row">
        <span>${g} after</span>
        <strong style="color:${gradeColor(g)}">${after[g] ?? '—'}</strong>
      </div>
    `).join('');
  }

  function gradeColor(grade) {
    const MAP = {
      'Low':  '#ef4444',
      'Medium': '#f59e0b',
      'High': '#10b981',
      'F':   '#ef4444',
      'D':   '#f97316',
      'C':   '#f59e0b',
      'B':   '#eab308',
      'B+':  '#84cc16',
      'A':   '#22c55e',
      'AA':  '#10b981',
      'AAA': '#14b8a6',
    };
    return MAP[grade] || '#9898c8';
  }

  function orderedGradeLabels(labels) {
    const preferred = ['Low', 'Medium', 'High', 'F', 'D', 'C', 'B', 'B+', 'A', 'AA', 'AAA'];
    const present = new Set(labels || []);
    return [
      ...preferred.filter(label => present.has(label)),
      ...Array.from(present).filter(label => !preferred.includes(label)).sort(),
    ];
  }

  // ── Prediction result panel (8 grades) ───────────────────────────────────
  function showPredictionResult(data) {
    const panel = document.getElementById('predict-result');
    if (!panel) return;
    panel.style.display = 'block';

    const grade = data.predicted_grade || '?';
    const color = gradeColor(grade);
    const DESC = {
      'Low':'Needs Support','Medium':'On Track','High':'High Performer',
      'F':'Fail','D':'Below Average','C':'Average','B':'Above Average',
      'B+':'Good','A':'Very Good','AA':'Excellent','AAA':'Exceptional'
    };

    const badge = document.getElementById('result-badge');
    badge.textContent = grade;
    badge.className   = 'result-grade-badge';
    badge.style.cssText = [
      `background:linear-gradient(135deg,${color},${color}88)`,
      '-webkit-background-clip:text',
      '-webkit-text-fill-color:transparent',
      'background-clip:text',
    ].join(';');

    const descEl = document.getElementById('result-grade-desc');
    if (descEl) descEl.textContent = DESC[grade] || '';

    document.getElementById('result-confidence-val').textContent =
      `${data.confidence}%`;

    const probs = data.probabilities || {};
    const ORDER = orderedGradeLabels(Object.keys(probs));
    const bars  = document.getElementById('prob-bars');
    bars.innerHTML = ORDER.map(g => {
      const pct = (probs[g] ?? 0).toFixed(1);
      const hex = gradeColor(g);
      return `<div class="prob-bar-item">
        <div class="prob-bar-label">
          <span style="color:${hex};font-weight:600">${g}</span>
          <span>${pct}%</span>
        </div>
        <div class="prob-bar-track">
          <div class="prob-bar-fill"
               style="width:${pct}%;background:linear-gradient(90deg,${hex}99,${hex})"></div>
        </div>
      </div>`;
    }).join('');
  }


  // ── Metrics table (Model Insights) ────────────────────────────────────────
  function renderMetricsTable(allMetrics) {
    const tbody = document.getElementById('metrics-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const bestName = Object.entries(allMetrics || {}).sort(
      (a, b) => (b[1]?.accuracy ?? 0) - (a[1]?.accuracy ?? 0)
    )[0]?.[0];
    Object.entries(allMetrics).forEach(([name, m]) => {
      const isBest = name === bestName;
      const tr = document.createElement('tr');
      tr.className = isBest ? 'metrics-best' : '';
      tr.innerHTML = `
        <td>${isBest ? '⭐ ' : ''}${name}</td>
        <td>${m.accuracy ?? '—'}%</td>
        <td>${m.precision ?? '—'}%</td>
        <td>${m.recall ?? '—'}%</td>
        <td>${m.f1_score ?? '—'}%</td>
        <td>${m.cv_f1_mean != null ? `${m.cv_f1_mean}% ± ${m.cv_f1_std ?? 0}%` : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Best params panel ──────────────────────────────────────────────────────
  function renderParams(bestParams, smoteDetails) {
    const pList = document.getElementById('params-list');
    if (pList && bestParams) {
      pList.innerHTML = Object.entries(bestParams).map(([k, v]) => `
        <div class="param-item">
          <span class="param-key">${k}</span>
          <span class="param-val">${Array.isArray(v) ? v.join(', ') : v}</span>
        </div>
      `).join('');
    }

    const sList = document.getElementById('smote-detail-list');
    if (sList && smoteDetails) {
      const orig  = smoteDetails.original    || {};
      const after = smoteDetails.after_smote || {};
      const grades = orderedGradeLabels([
        ...Object.keys(orig),
        ...Object.keys(after),
      ]);
      sList.innerHTML = grades.map(g => `
        <div class="param-item">
          <span class="param-key" style="color:${gradeColor(g)}">${g}</span>
          <span class="param-val">${orig[g] ?? '?'} → ${after[g] ?? '?'}</span>
        </div>
      `).join('');
    } else if (sList) {
      sList.innerHTML = `
        <div class="param-item">
          <span class="param-key">resampling</span>
          <span class="param-val">Not used</span>
        </div>
      `;
    }
  }

  // ── Classification report table ────────────────────────────────────────────
  function renderClassificationReport(report) {
    const tbody = document.getElementById('clf-report-body');
    if (!tbody || !report) return;
    const rows = orderedGradeLabels(
      Object.keys(report).filter(k => !['accuracy', 'macro avg', 'weighted avg'].includes(k))
    );
    tbody.innerHTML = rows.map(g => {
      const r   = report[g];
      const col = gradeColor(g);
      const f1p = parseFloat(r['f1-score'] || 0);
      return `<tr>
        <td style="color:${col};font-weight:700">${g}</td>
        <td>${(r.precision*100).toFixed(1)}%</td>
        <td>${(r.recall*100).toFixed(1)}%</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span>${(f1p*100).toFixed(1)}%</span>
            <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px">
              <div style="width:${(f1p*100).toFixed(0)}%;height:100%;background:${col};border-radius:2px"></div>
            </div>
          </div>
        </td>
        <td>${r.support}</td>
      </tr>`;
    }).join('');
    // Summary rows
    ['macro avg','weighted avg'].forEach(key => {
      if (report[key]) {
        const r = report[key];
        tbody.innerHTML += `<tr style="border-top:1px solid rgba(255,255,255,0.08);color:#9898c8;font-style:italic">
          <td>${key}</td>
          <td>${(r.precision*100).toFixed(1)}%</td>
          <td>${(r.recall*100).toFixed(1)}%</td>
          <td>${(r['f1-score']*100).toFixed(1)}%</td>
          <td>${Math.round(r.support||0)}</td>
        </tr>`;
      }
    });
  }

  // ── Bulk upload results table (paginated) ──────────────────────────────────
  const PAGE_SIZE = 15;
  let _bulkData = [];
  let _currentPage = 1;
  let _interventionReports = [];
  let _singleInterventionReport = null;

  const NAME_FIELD_CANDIDATES = [
    'Name', 'Student_Name', 'Student Name', 'Full_Name', 'Full Name', 'Student'
  ];
  const HIDDEN_BULK_COLUMNS = new Set(['Predicted_Score']);

  function normaliseFieldName(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function findFieldValue(row, candidates) {
    const normalisedCandidates = new Set(candidates.map(normaliseFieldName));
    const key = Object.keys(row || {}).find(field => normalisedCandidates.has(normaliseFieldName(field)));
    return key ? row[key] : '';
  }

  function toNumber(value) {
    const parsed = parseFloat(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pushUnique(items, value) {
    if (value && !items.includes(value)) items.push(value);
  }

  function humanJoin(items) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  function isNegativeChoice(value) {
    const normalised = String(value || '').trim().toLowerCase();
    return ['no', 'low', 'negative'].includes(normalised);
  }

  function buildRiskAnalysis(row) {
    const reasons = [];
    const summaryClauses = [];
    const suggestions = [];

    const attendance = toNumber(findFieldValue(row, ['Attendance']));
    if (attendance !== null && attendance < 75) {
      pushUnique(reasons, 'Attendance is below 75%, which suggests inconsistent classroom participation.');
      pushUnique(summaryClauses, 'consistently low attendance');
      pushUnique(suggestions, 'Set a weekly attendance target and follow up on missed classes immediately.');
    }

    const previousScores = toNumber(findFieldValue(row, ['Previous_Scores', 'Previous Scores']));
    if (previousScores !== null && previousScores < 65) {
      pushUnique(reasons, 'Previous scores indicate weak academic foundations in recent assessments.');
      pushUnique(summaryClauses, 'below-average academic performance');
      pushUnique(suggestions, 'Provide remedial practice in weak subjects and review assessment gaps weekly.');
    }

    const tutoringSessions = toNumber(findFieldValue(row, ['Tutoring_Sessions', 'Tutoring Sessions']));
    if (tutoringSessions !== null && tutoringSessions < 1) {
      pushUnique(reasons, 'There is little or no tutoring support recorded for this student.');
      pushUnique(summaryClauses, 'limited tutoring support');
      pushUnique(suggestions, 'Arrange tutoring support or a faculty mentoring session this week.');
    }

    const hoursStudied = toNumber(findFieldValue(row, ['Hours_Studied', 'Hours Studied']));
    if (hoursStudied !== null && hoursStudied < 10) {
      pushUnique(reasons, 'Study time is low for sustained academic recovery.');
      pushUnique(summaryClauses, 'insufficient study time');
      pushUnique(suggestions, 'Create a structured study schedule with short daily revision blocks.');
    }

    const extracurricular = findFieldValue(row, ['Extracurricular_Activities', 'Extracurricular Activities']);
    if (isNegativeChoice(extracurricular)) {
      pushUnique(reasons, 'Low extracurricular engagement may indicate reduced school connection and support.');
      pushUnique(summaryClauses, 'low extracurricular engagement');
      pushUnique(suggestions, 'Encourage participation in at least one structured school activity for engagement.');
    }

    const motivation = findFieldValue(row, ['Motivation_Level', 'Motivation Level']);
    if (String(motivation || '').trim().toLowerCase() === 'low') {
      pushUnique(reasons, 'Motivation level is low, which may affect consistency and follow-through.');
      pushUnique(summaryClauses, 'low learning motivation');
      pushUnique(suggestions, 'Set short-term achievable goals and review progress with the student regularly.');
    }

    const accessToResources = findFieldValue(row, ['Access_to_Resources', 'Access to Resources']);
    if (String(accessToResources || '').trim().toLowerCase() === 'low') {
      pushUnique(reasons, 'Access to academic resources is limited, which can restrict preparation quality.');
      pushUnique(summaryClauses, 'limited access to resources');
      pushUnique(suggestions, 'Provide access to study materials, lab time, or shared academic resources.');
    }

    const predictedScore = toNumber(row.Predicted_Score);
    if (predictedScore !== null && predictedScore < 55) {
      pushUnique(reasons, 'The predicted score is well below the passing range, indicating immediate academic risk.');
      pushUnique(summaryClauses, 'a predicted score far below the passing range');
      pushUnique(suggestions, 'Initiate an intensive intervention plan with weekly checkpoints until improvement is visible.');
    }

    if (!reasons.length) {
      pushUnique(reasons, 'Overall academic consistency appears weak, and the student requires close monitoring.');
      pushUnique(summaryClauses, 'overall weak academic consistency');
      pushUnique(suggestions, 'Schedule a faculty review meeting and monitor progress at least once per week.');
    }

    const summary = `This student is at risk due to ${humanJoin(summaryClauses.slice(0, 3))}.`;
    return { reasons, suggestions, summary };
  }

  function formatMetricValue(value, suffix = '', decimals = null) {
    const num = toNumber(value);
    if (num === null) return 'Not available';
    const formatted = decimals != null
      ? num.toFixed(decimals)
      : (Number.isInteger(num) ? String(num) : num.toFixed(2));
    return `${formatted}${suffix}`;
  }

  function buildStatMetrics(row) {
    const configs = [
      { label: 'Attendance', value: findFieldValue(row, ['Attendance']), max: 100, suffix: '%', decimals: 0, color: '#ef4444' },
      { label: 'Previous Scores', value: findFieldValue(row, ['Previous_Scores', 'Previous Scores']), max: 100, suffix: '%', decimals: 0, color: '#f97316' },
      { label: 'Study Hours', value: findFieldValue(row, ['Hours_Studied', 'Hours Studied']), max: 30, suffix: ' hrs', decimals: 0, color: '#6366f1' },
      { label: 'Tutoring Sessions', value: findFieldValue(row, ['Tutoring_Sessions', 'Tutoring Sessions']), max: 6, suffix: ' sessions', decimals: 0, color: '#8b5cf6' },
      { label: 'Predicted Score', value: row.Predicted_Score, max: 100, suffix: '%', decimals: 2, color: '#14b8a6' },
    ];

    return configs.map(config => {
      const raw = toNumber(config.value);
      if (raw === null) return null;
      return {
        label: config.label,
        raw,
        display: formatMetricValue(raw, config.suffix, config.decimals),
        normalized: Math.max(0, Math.min(100, (raw / config.max) * 100)),
        color: config.color,
      };
    }).filter(Boolean);
  }

  function hexToRgb(hex) {
    const normalized = String(hex || '').replace('#', '').trim();
    if (normalized.length !== 6) return [99, 102, 241];
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  }

  function safeFileName(name, fallback) {
    return String(name || '')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || fallback;
  }

  function createInterventionReport(row, index, overrides = {}) {
    const name = String(overrides.name || findFieldValue(row, NAME_FIELD_CANDIDATES) || `Student ${index + 1}`).trim();
    const grade = String(row.Predicted_Grade || '').trim() || 'F';
    const predictedScore = row.Predicted_Score !== undefined && row.Predicted_Score !== ''
      ? row.Predicted_Score
      : 'Not available';
    const analysis = buildRiskAnalysis(row);
    const report = {
      index,
      name,
      grade,
      predictedScore,
      riskStatus: 'At Risk',
      reasons: analysis.reasons,
      suggestions: analysis.suggestions,
      summary: analysis.summary,
      metrics: buildStatMetrics(row),
      sourceRow: row,
    };

    return report;
  }

  function downloadInterventionPdf(report) {
    const PdfConstructor = window.jspdf?.jsPDF;
    if (!PdfConstructor) {
      toast('PDF export is not available right now.', 'error', 5000);
      return;
    }

    const doc = new PdfConstructor({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const usableWidth = pageWidth - (margin * 2);
    let y = margin;

    const ensureSpace = needed => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    const addParagraph = (text, options = {}) => {
      const fontSize = options.fontSize || 10.5;
      const indent = options.indent || 0;
      const color = options.color || [51, 65, 85];
      doc.setFont('helvetica', options.fontStyle || 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text || ''), usableWidth - indent);
      const lineHeight = fontSize * 1.45;
      ensureSpace((lines.length * lineHeight) + 6);
      lines.forEach(line => {
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
      y += options.after || 4;
    };

    const addBulletList = items => {
      (items || []).forEach(item => addParagraph(`• ${item}`, { indent: 10 }));
      y += 4;
    };

    const addSectionTitle = title => {
      ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(127, 29, 29);
      doc.text(title, margin, y);
      y += 20;
    };

    const metrics = report.metrics?.length ? report.metrics : buildStatMetrics(report.sourceRow || {});

    ensureSpace(104);
    doc.setFillColor(255, 245, 245);
    doc.setDrawColor(248, 113, 113);
    doc.roundedRect(margin, y, usableWidth, 86, 12, 12, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(153, 27, 27);
    doc.text('F-Grade Student Intervention Report', margin + 18, y + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated for ${report.name}`, margin + 18, y + 48);
    doc.text(`Risk status: ${report.riskStatus}`, margin + 18, y + 64);
    doc.text(`Predicted grade: ${report.grade}   •   Predicted score: ${report.predictedScore}`, margin + 18, y + 80);
    y += 108;

    addSectionTitle('Student Information');
    addParagraph(`Name: ${report.name}`, { fontStyle: 'bold', color: [30, 41, 59] });
    addParagraph(`Report generated from GradeDex intervention analysis.`, { color: [71, 85, 105], after: 10 });

    addSectionTitle('Statistical Snapshot');
    const chartHeight = 56 + (metrics.length * 28);
    ensureSpace(chartHeight);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, usableWidth, chartHeight, 12, 12, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Key academic indicators (scaled for comparison)', margin + 16, y + 22);

    let chartY = y + 38;
    const labelX = margin + 16;
    const barX = margin + 160;
    const valueX = pageWidth - margin - 18;
    const barWidth = valueX - barX - 76;

    metrics.forEach(metric => {
      const [r, g, b] = hexToRgb(metric.color);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(metric.label, labelX, chartY + 8);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(barX, chartY, barWidth, 10, 5, 5, 'F');
      doc.setFillColor(r, g, b);
      doc.roundedRect(barX, chartY, Math.max(8, barWidth * (metric.normalized / 100)), 10, 5, 5, 'F');
      doc.setTextColor(71, 85, 105);
      doc.text(metric.display, valueX, chartY + 8, { align: 'right' });
      chartY += 28;
    });
    y += chartHeight + 14;

    addSectionTitle('Performance Analysis');
    addBulletList(report.reasons);

    addSectionTitle('Recommended Actions');
    addBulletList(report.suggestions);

    addSectionTitle('Summary');
    addParagraph(report.summary, { color: [51, 65, 85] });

    doc.save(`${safeFileName(report.name, `student_${report.index + 1}`)}_intervention_report.pdf`);
  }

  function clearSingleIntervention() {
    _singleInterventionReport = null;
    const card = document.getElementById('single-intervention');
    const content = document.getElementById('single-intervention-content');
    const name = document.getElementById('single-risk-name');
    if (content) content.innerHTML = '';
    if (name) name.textContent = 'Current Student';
    if (card) card.style.display = 'none';
  }

  function renderSingleIntervention(inputData, prediction) {
    const card = document.getElementById('single-intervention');
    const content = document.getElementById('single-intervention-content');
    const name = document.getElementById('single-risk-name');
    const downloadButton = document.getElementById('single-download-report');
    if (!card || !content || !downloadButton) return;

    const grade = String(prediction?.predicted_grade || '').trim().toUpperCase();
    if (grade !== 'F') {
      clearSingleIntervention();
      return;
    }

    const row = {
      ...(inputData || {}),
      Predicted_Grade: prediction.predicted_grade,
      Predicted_Score: prediction.predicted_score,
    };
    _singleInterventionReport = createInterventionReport(row, 0, {
      name: 'Current Student',
    });

    if (name) name.textContent = _singleInterventionReport.name;

    content.innerHTML = `
      <div class="intervention-grid">
        <section class="intervention-block">
          <h4>Prediction</h4>
          <div class="intervention-metrics">
            <div class="intervention-metric"><span>Predicted Score</span><strong>${escapeHtml(_singleInterventionReport.predictedScore)}</strong></div>
            <div class="intervention-metric"><span>Predicted Grade</span><strong>${escapeHtml(_singleInterventionReport.grade)}</strong></div>
            <div class="intervention-metric"><span>Risk Status</span><strong>${escapeHtml(_singleInterventionReport.riskStatus)}</strong></div>
          </div>
        </section>
        <section class="intervention-block">
          <h4>Performance Analysis</h4>
          <ul class="intervention-reasons">
            ${_singleInterventionReport.reasons.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </section>
        <section class="intervention-block">
          <h4>Summary</h4>
          <p>${escapeHtml(_singleInterventionReport.summary)}</p>
        </section>
        <section class="intervention-block">
          <h4>Report</h4>
          <p>Download the intervention report to keep a copy of this student's risk summary and recommended actions.</p>
        </section>
      </div>
    `;

    downloadButton.onclick = () => downloadInterventionPdf(_singleInterventionReport);

    card.style.display = 'block';
    refreshHorizontalScrollers();
  }

  function clearInterventionReports() {
    _interventionReports = [];
    const panel = document.getElementById('bulk-interventions');
    const list = document.getElementById('bulk-intervention-list');
    const count = document.getElementById('bulk-risk-count');
    if (list) list.innerHTML = '';
    if (count) count.textContent = '';
    if (panel) panel.style.display = 'none';
  }

  function renderInterventionReports(data) {
    const panel = document.getElementById('bulk-interventions');
    const list = document.getElementById('bulk-intervention-list');
    const count = document.getElementById('bulk-risk-count');
    if (!panel || !list || !count) return;

    _interventionReports = (data || [])
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => String(row.Predicted_Grade || '').trim().toUpperCase() === 'F')
      .map(({ row, index }) => createInterventionReport(row, index));

    if (!_interventionReports.length) {
      clearInterventionReports();
      return;
    }

    count.textContent = `${_interventionReports.length} At Risk`;
    list.innerHTML = _interventionReports.map((report, index) => `
      <article class="intervention-card">
        <div class="intervention-head">
          <div class="intervention-title-group">
            <span class="intervention-name">${escapeHtml(report.name)}</span>
          </div>
          <span class="badge badge-low">${escapeHtml(report.riskStatus)}</span>
        </div>
        <div class="intervention-scroll">
          <div class="intervention-grid">
            <section class="intervention-block">
              <h4>Prediction</h4>
              <div class="intervention-metrics">
                <div class="intervention-metric"><span>Predicted Score</span><strong>${escapeHtml(report.predictedScore)}</strong></div>
                <div class="intervention-metric"><span>Predicted Grade</span><strong>${escapeHtml(report.grade)}</strong></div>
                <div class="intervention-metric"><span>Risk Status</span><strong>${escapeHtml(report.riskStatus)}</strong></div>
              </div>
            </section>
            <section class="intervention-block">
              <h4>Performance Analysis</h4>
              <ul class="intervention-reasons">
                ${report.reasons.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </section>
            <section class="intervention-block">
              <h4>Summary</h4>
              <p>${escapeHtml(report.summary)}</p>
            </section>
            <section class="intervention-block">
              <h4>Report</h4>
              <p>Download the intervention report to keep a copy of this student's risk summary and recommended actions.</p>
            </section>
          </div>
        </div>
        <div class="intervention-actions">
          <button class="btn btn-primary btn-sm" type="button" data-report-index="${index}">Download Report</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-report-index]').forEach(button => {
      button.addEventListener('click', () => {
        const report = _interventionReports[Number(button.dataset.reportIndex)];
        if (report) downloadInterventionPdf(report);
      });
    });

    panel.style.display = 'block';
    refreshHorizontalScrollers();
  }

  function renderBulkResults(data, filename) {
    if (!data || data.length === 0) return;
    _bulkData = data;
    _currentPage = 1;

    const card  = document.getElementById('bulk-results');
    const title = document.getElementById('bulk-result-title');
    card.style.display = 'block';
    title.textContent  = `Predictions — ${data.length} students`;

    // Build header from keys (show Predicted_Grade + Confidence first)
    const keys = Object.keys(data[0]).filter(key => !HIDDEN_BULK_COLUMNS.has(key));
    const priorityKeys = ['Predicted_Grade', 'Confidence_%'];
    const orderedKeys  = [
      ...priorityKeys.filter(k => keys.includes(k)),
      ...keys.filter(k => !priorityKeys.includes(k)),
    ];

    const thead = document.getElementById('bulk-table-head');
    thead.innerHTML = `<tr>${orderedKeys.map(k => `<th>${k.replace(/_/g, ' ')}</th>`).join('')}</tr>`;

    _renderBulkPage(orderedKeys);
    _renderPagination(orderedKeys);

    // Store for download
    card.dataset.keys = JSON.stringify(orderedKeys);
    renderInterventionReports(data);
    refreshHorizontalScrollers();
  }

  function _renderBulkPage(keys) {
    const tbody = document.getElementById('bulk-table-body');
    const start = (_currentPage - 1) * PAGE_SIZE;
    const slice = _bulkData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = slice.map(row => {
      const isRiskRow = String(row.Predicted_Grade || '').trim().toUpperCase() === 'F';
      return `<tr class="${isRiskRow ? 'risk-row' : ''}">${keys.map(k => {
        const val = row[k] ?? '';
        const cls = k === 'Predicted_Grade' ? 'grade-cell' : '';
        const style = k === 'Predicted_Grade'
          ? ` style="color:${gradeColor(val)};font-weight:700"` : '';
        return `<td class="${cls}"${style}>${val}</td>`;
      }).join('')}</tr>`;
    }).join('');
  }

  function _renderPagination(keys) {
    const total = Math.ceil(_bulkData.length / PAGE_SIZE);
    const container = document.getElementById('bulk-pagination');
    if (total <= 1) { container.innerHTML = ''; return; }

    container.innerHTML = Array.from({ length: total }, (_, i) => i + 1)
      .map(p => `<button class="page-btn ${p === _currentPage ? 'active' : ''}"
                         data-page="${p}">${p}</button>`)
      .join('');

    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentPage = +btn.dataset.page;
        _renderBulkPage(keys);
        _renderPagination(keys);
      });
    });
  }

  // ── CSV download trigger ───────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  refreshHorizontalScrollers();

  return {
    toast,
    showLoading,
    hideLoading,
    setStatus,
    updateStats,
    renderSmoteInfo,
    showPredictionResult,
    renderMetricsTable,
    renderParams,
    renderClassificationReport,
    renderBulkResults,
    renderSingleIntervention,
    clearSingleIntervention,
    renderInterventionReports,
    clearInterventionReports,
    downloadBlob,
    gradeColor,
    get bulkData() { return _bulkData; },
  };
})();
