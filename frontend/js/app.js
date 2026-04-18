/**
 * app.js — Main application logic for GradeDex.
 * Orchestrates tab navigation, event listeners, and API + UI integration.
 */

(async () => {

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════
  function switchSection(name) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === name);
    });
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${name}`);
    });
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchSection(item.dataset.section);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  STARTUP — check health & load model info
  // ══════════════════════════════════════════════════════════════════════════
  async function initialise() {
    UI.setStatus('loading', 'Connecting…');
    try {
      const health = await Api.health();
      if (!health.model_loaded) {
        UI.setStatus('', 'No model found');
        return;
      }
      await loadModelDashboard();
    } catch (err) {
      UI.setStatus('error', 'Server offline');
      UI.toast('Backend not reachable. Is uvicorn running?', 'error', 6000);
    }
  }

  async function loadModelDashboard() {
    try {
      const [info, metricsData, fiData, cmData] = await Promise.all([
        Api.modelInfo(),
        Api.metrics(),
        Api.featureImportance(),
        Api.confusionMatrix(),
      ]);

      // ── Status bar ─────────────────────────────────────────────────────
      UI.setStatus('ready', `Ready — ${info.accuracy}%`);

      // ── Dashboard stats ────────────────────────────────────────────────
      UI.updateStats(info);

      // ── Class distribution chart ───────────────────────────────────────
      if (info.class_distribution) {
        Charts.renderDistributionChart(info.class_distribution);
        UI.renderSmoteInfo(info.smote_details);
      }

      // ── Model comparison chart ─────────────────────────────────────────
      if (metricsData.all_metrics) {
        Charts.renderComparisonChart(metricsData.all_metrics);
      }

      // ── Model Insights tab ─────────────────────────────────────────────
      if (metricsData.all_metrics) {
        UI.renderMetricsTable(metricsData.all_metrics);
      }
      if (fiData.feature_importance) {
        Charts.renderImportanceChart(fiData.feature_importance);
      }
      UI.renderParams(info.best_params, info.smote_details);

      // ── Confusion matrix + classification report ───────────────────────
      if (cmData.matrix && cmData.labels) {
        setTimeout(() => {
          Charts.renderConfusionMatrix(cmData.matrix, cmData.labels);
          // Store for theme-toggle redraw
          const cmCanvas = document.getElementById('chart-confusion');
          if (cmCanvas) cmCanvas._cmData = { matrix: cmData.matrix, labels: cmData.labels };
        }, 200);
      }
      if (cmData.classification_report) {
        UI.renderClassificationReport(cmData.classification_report);
      }

    } catch (err) {
      console.error('loadModelDashboard error:', err);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TRAIN MODEL
  // ══════════════════════════════════════════════════════════════════════════
  document.getElementById('btn-train').addEventListener('click', async () => {
    const confirmed = confirm(
      'Train the model now?\n\nThis retrains the ordinal threshold ensemble and updates the saved model.\nThe UI will show a loading screen while training runs.'
    );
    if (!confirmed) return;

    UI.showLoading('Training ordinal threshold ensemble…');
    UI.setStatus('loading', 'Training…');

    try {
      const result = await Api.trainModel();
      UI.hideLoading();
      UI.toast(`✅ Model trained! Accuracy: ${result.accuracy}%`, 'success', 6000);
      await loadModelDashboard();
    } catch (err) {
      UI.hideLoading();
      UI.setStatus('error', 'Training failed');
      UI.toast(`Training failed: ${err.message}`, 'error', 8000);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  MANUAL PREDICTION FORM
  // ══════════════════════════════════════════════════════════════════════════
  const predictForm = document.getElementById('predict-form');

  predictForm.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = document.getElementById('btn-predict');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></span> Predicting…';

    // Collect form data — empty strings become null (model imputes them)
    const formData = new FormData(predictForm);
    const payload  = {};
    formData.forEach((val, key) => {
      payload[key] = val.trim() === '' ? null : val;
    });

    // Cast numeric fields
    const numericFields = [
      'Hours_Studied', 'Attendance', 'Sleep_Hours',
      'Previous_Scores', 'Tutoring_Sessions', 'Physical_Activity'
    ];
    numericFields.forEach(f => {
      if (payload[f] !== null) payload[f] = parseFloat(payload[f]);
    });

    try {
      const result = await Api.predictSingle(payload);
      UI.showPredictionResult(result);
      UI.renderSingleIntervention(payload, result);
      UI.toast(`Predicted: ${result.predicted_grade} (${result.confidence}% confidence)`, 'success');
    } catch (err) {
      UI.toast(`Prediction failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M5 3l14 9-14 9V3z"/></svg>
        Predict Grade`;
    }
  });

  document.getElementById('btn-clear-form').addEventListener('click', () => {
    predictForm.reset();
    document.getElementById('predict-result').style.display = 'none';
    UI.clearSingleIntervention();
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  BULK UPLOAD
  // ══════════════════════════════════════════════════════════════════════════
  const uploadZone    = document.getElementById('upload-zone');
  const fileInput     = document.getElementById('file-input');
  const fileInfo      = document.getElementById('file-info');
  const bulkActions   = document.getElementById('bulk-actions');
  const fileNameDisp  = document.getElementById('file-name-display');
  const fileRowsDisp  = document.getElementById('file-rows-display');
  const btnRemove     = document.getElementById('btn-remove-file');

  let selectedFile  = null;
  let resultBlob    = null;
  let resultFilename = '';

  function setSelectedFile(file) {
    selectedFile = file;
    fileNameDisp.textContent = file.name;

    // Count rows (approx) by reading first few KB
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').filter(l => l.trim()).length;
      fileRowsDisp.textContent = `~${lines - 1} students`;
    };
    reader.readAsText(file.slice(0, 50000)); // read first 50KB only

    fileInfo.style.display    = 'flex';
    bulkActions.style.display = 'flex';
    document.getElementById('bulk-results').style.display = 'none';
    UI.clearInterventionReports();
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.style.display    = 'none';
    bulkActions.style.display = 'none';
    document.getElementById('bulk-results').style.display = 'none';
    UI.clearInterventionReports();
  }

  // Click to browse
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) setSelectedFile(e.target.files[0]);
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) setSelectedFile(file);
    else UI.toast('Please drop a .csv file', 'warning');
  });

  btnRemove.addEventListener('click', clearFile);

  // Process button
  document.getElementById('btn-process').addEventListener('click', async () => {
    if (!selectedFile) return;

    const btn = document.getElementById('btn-process');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    UI.showLoading('Running batch predictions…');

    try {
      const res = await Api.predictBatch(selectedFile);

      // Store blob for download
      resultBlob     = await res.blob();
      resultFilename = `gradedex_predictions_${selectedFile.name}`;

      // Parse blob as text → JSON for table preview
      const text   = await resultBlob.text();
      const rows   = csvToJson(text);
      UI.renderBulkResults(rows, resultFilename);
      UI.toast(`✅ Predictions complete for ${rows.length} students`, 'success');

    } catch (err) {
      UI.toast(`Batch prediction failed: ${err.message}`, 'error');
    } finally {
      UI.hideLoading();
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M5 3l14 9-14 9V3z"/></svg>
        Process &amp; Predict All`;
    }
  });

  // Download result CSV
  document.getElementById('btn-download').addEventListener('click', () => {
    if (!resultBlob) return;
    UI.downloadBlob(resultBlob, resultFilename);
    UI.toast('CSV downloaded!', 'success', 2500);
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  CSV PARSER (client-side, for table preview)
  // ══════════════════════════════════════════════════════════════════════════
  function csvToJson(csvText) {
    const lines  = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  THEME TOGGLE  (sun ☀ / moon 🌙)
  // ══════════════════════════════════════════════════════════════════════════
  const THEME_KEY = 'gradedex-theme';
  const htmlEl    = document.documentElement;
  const btnTheme  = document.getElementById('btn-theme');
  const lblTheme  = document.getElementById('theme-label');

  function applyTheme(theme) {
    if (theme === 'light') {
      htmlEl.setAttribute('data-theme', 'light');
      lblTheme.textContent = 'Dark Mode';
    } else {
      htmlEl.removeAttribute('data-theme');
      lblTheme.textContent = 'Light Mode';
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  // Restore saved preference on load
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  btnTheme.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
    // Redraw confusion matrix — canvas needs size recalc after colour shift
    if (typeof Charts !== 'undefined' && Charts.renderConfusionMatrix) {
      setTimeout(() => {
        const cmCanvas = document.getElementById('chart-confusion');
        if (cmCanvas && cmCanvas._cmData) {
          Charts.renderConfusionMatrix(cmCanvas._cmData.matrix, cmCanvas._cmData.labels);
        }
      }, 80);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════════════════
  await initialise();

})();
