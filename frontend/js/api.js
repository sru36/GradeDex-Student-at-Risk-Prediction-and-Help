/**
 * api.js — All API calls to the GradeDex FastAPI backend.
 * Base URL is relative so it works when served from FastAPI on any port.
 */

const API_BASE = '/api';

const Api = (() => {

  async function _request(method, path, body = null, isFile = false) {
    const opts = {
      method,
      headers: isFile ? {} : { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = isFile ? body : JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    return res;
  }

  /** GET /api/health */
  async function health() {
    const res = await _request('GET', '/health');
    return res.json();
  }

  /** GET /api/model/info */
  async function modelInfo() {
    const res = await _request('GET', '/model/info');
    return res.json();
  }

  /** POST /api/train  (triggers full re-training) */
  async function trainModel() {
    const res = await _request('POST', '/train');
    return res.json();
  }

  /** POST /api/predict/single  body: StudentInput dict */
  async function predictSingle(studentData) {
    const res = await _request('POST', '/predict/single', studentData);
    return res.json();
  }

  /**
   * POST /api/predict/batch  — multipart file upload
   * Returns the raw Response (we need to handle blob download).
   */
  async function predictBatch(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await _request('POST', '/predict/batch', form, true);
    return res; // caller handles blob / JSON
  }

  /** GET /api/model/feature-importance */
  async function featureImportance() {
    const res = await _request('GET', '/model/feature-importance');
    return res.json();
  }

  /** GET /api/model/metrics */
  async function metrics() {
    const res = await _request('GET', '/model/metrics');
    return res.json();
  }

  /** GET /api/model/confusion-matrix */
  async function confusionMatrix() {
    const res = await _request('GET', '/model/confusion-matrix');
    return res.json();
  }

  return { health, modelInfo, trainModel, predictSingle, predictBatch,
           featureImportance, metrics, confusionMatrix };
})();
