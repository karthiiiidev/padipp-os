/**
 * PADIPP.OS — Internal Assessment & Grade Prediction Engine
 * Configurable schemes, exact examination solver, and interactive simulator
 */

class IAPredictor {
  constructor() {
    this.maxInternalMarks = 40;
    this.maxExamMarks = 60;
    this.gradeThresholds = {
      S: 90,
      A: 80,
      B: 70,
      C: 60,
      D: 50,
      E: 40
    };
    this.currentComponents = [
      { name: 'Midterm 1', maxMarks: 20, scoredMarks: 18 },
      { name: 'Assignments', maxMarks: 10, scoredMarks: 8 },
      { name: 'Attendance', maxMarks: 5, scoredMarks: 5 },
      { name: 'Seminar / Viva', maxMarks: 5, scoredMarks: 4 }
    ];
    this.selectedTargetGrade = 'A';
    this.simulatedExamMarks = 42;
  }

  async init() {
    const maxInt = await window.db.getSetting('maxInternalMarks', 40);
    const maxEx = await window.db.getSetting('maxExamMarks', 60);
    const thresholds = await window.db.getSetting('gradeThresholds', null);

    this.maxInternalMarks = Number(maxInt) || 40;
    this.maxExamMarks = Number(maxEx) || 60;
    if (thresholds && typeof thresholds === 'object') {
      this.gradeThresholds = thresholds;
    }

    const savedEntry = await window.db.get('ia_entries', 'active_calculator');
    if (savedEntry) {
      if (Array.isArray(savedEntry.components) && savedEntry.components.length > 0) {
        this.currentComponents = savedEntry.components;
      }
      if (savedEntry.targetGrade) {
        this.selectedTargetGrade = savedEntry.targetGrade;
      }
      if (typeof savedEntry.expectedExamMarks === 'number') {
        this.simulatedExamMarks = savedEntry.expectedExamMarks;
      }
    }
  }

  calculateCurrentInternal() {
    let totalScored = 0;
    let totalMax = 0;

    this.currentComponents.forEach((c) => {
      const scored = Math.max(0, Math.min(Number(c.maxMarks) || 0, Number(c.scoredMarks) || 0));
      totalScored += scored;
      totalMax += Number(c.maxMarks) || 0;
    });

    return {
      scored: Math.round(totalScored * 10) / 10,
      max: totalMax || this.maxInternalMarks,
      percentage: totalMax > 0 ? Math.round((totalScored / totalMax) * 1000) / 10 : 0
    };
  }

  calculateRequiredExam(targetGrade = this.selectedTargetGrade) {
    const internal = this.calculateCurrentInternal();
    const threshold = this.gradeThresholds[targetGrade] !== undefined 
      ? this.gradeThresholds[targetGrade] 
      : 80;

    const requiredTotal = threshold;
    const requiredExam = Math.max(0, Math.round((requiredTotal - internal.scored) * 10) / 10);
    const requiredExamPercentage = this.maxExamMarks > 0 
      ? Math.round((requiredExam / this.maxExamMarks) * 1000) / 10 
      : 0;

    let status = 'achievable';
    let statusLabel = 'Easily Achievable';
    let statusClass = 'safe';

    if (internal.scored >= requiredTotal) {
      status = 'secured';
      statusLabel = 'Already Secured! Current internals meet target.';
      statusClass = 'safe';
    } else if (requiredExam > this.maxExamMarks) {
      status = 'impossible';
      statusLabel = 'Mathematically Impossible (> Maximum Exam Marks)';
      statusClass = 'critical';
    } else if (requiredExamPercentage > 85) {
      status = 'demanding';
      statusLabel = 'Demanding Target (Requires > 85% in Exam)';
      statusClass = 'critical';
    } else if (requiredExamPercentage > 70) {
      status = 'challenging';
      statusLabel = 'Challenging but Feasible';
      statusClass = 'warning';
    }

    return {
      targetGrade,
      targetThreshold: threshold,
      currentInternal: internal.scored,
      maxInternal: internal.max,
      maxExamMarks: this.maxExamMarks,
      requiredExamScore: requiredExam,
      requiredExamPercentage,
      status,
      statusLabel,
      statusClass
    };
  }

  calculateProjectedGrade(expectedExam) {
    const internal = this.calculateCurrentInternal();
    const examScore = Math.max(0, Math.min(this.maxExamMarks, Number(expectedExam) || 0));
    const projectedTotal = Math.round((internal.scored + examScore) * 10) / 10;

    let projectedGrade = 'F';
    const sortedGrades = Object.entries(this.gradeThresholds)
      .sort((a, b) => b[1] - a[1]);

    for (const [grade, minScore] of sortedGrades) {
      if (projectedTotal >= minScore) {
        projectedGrade = grade;
        break;
      }
    }

    return {
      expectedExam: examScore,
      currentInternal: internal.scored,
      projectedTotal,
      projectedGrade
    };
  }

  async saveState() {
    await window.db.put('ia_entries', {
      id: 'active_calculator',
      components: this.currentComponents,
      targetGrade: this.selectedTargetGrade,
      expectedExamMarks: this.simulatedExamMarks,
      updatedAt: Date.now()
    });
  }

  renderUI() {
    const container = document.getElementById('ia-container');
    if (!container) return;

    const internal = this.calculateCurrentInternal();
    const req = this.calculateRequiredExam(this.selectedTargetGrade);
    const sim = this.calculateProjectedGrade(this.simulatedExamMarks);

    const grades = ['S', 'A', 'B', 'C', 'D', 'E'];

    container.innerHTML = `
      <div class="ia-calculator-container">
        <!-- Left: IA Components & Target Selector -->
        <div class="ia-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:1.15rem; font-weight:700;">Internal Assessment Marks</h3>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-add-ia-component">
              + Add Component
            </button>
          </div>

          <div class="ia-components-list" id="ia-components-list">
            ${this.currentComponents.map((comp, idx) => `
              <div class="ia-component-row" data-index="${idx}">
                <input type="text" class="form-input ia-comp-name" value="${this.escapeHtml(comp.name)}" placeholder="Component name" />
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="number" step="0.5" min="0" max="${comp.maxMarks}" class="form-input ia-comp-scored" value="${comp.scoredMarks}" placeholder="Scored" />
                  <span style="color:var(--text-muted); font-size:0.85rem;">/</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <input type="number" step="0.5" min="1" class="form-input ia-comp-max" value="${comp.maxMarks}" placeholder="Max" />
                  <button class="btn btn-ghost btn-sm btn-icon btn-remove-ia-comp text-danger" title="Remove component">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="ia-total-bar">
            <div>
              <div class="ia-total-label">Total Internal Score</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${internal.percentage}% internal efficiency</div>
            </div>
            <div class="ia-total-score">${internal.scored} <span style="font-size:1rem; color:var(--text-muted); font-weight:500;">/ ${internal.max}</span></div>
          </div>

          <div style="margin-bottom:12px;">
            <label class="form-label" style="font-size:0.85rem; font-weight:700; margin-bottom:8px; display:block;">
              Choose Target Final Grade:
            </label>
            <div class="grade-selector-chips">
              ${grades.map((g) => `
                <button class="grade-chip ${this.selectedTargetGrade === g ? 'active' : ''}" data-grade="${g}">
                  ${g}
                  <span style="display:block; font-size:0.65rem; font-family:var(--font-mono); font-weight:600; opacity:0.75;">
                    ${this.gradeThresholds[g] || 0}+
                  </span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="target-result-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
              <span class="badge badge-accent">EXAM TARGET ANALYSIS</span>
              <span class="badge badge-${req.statusClass}">${req.statusLabel}</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:6px;">
              <div class="target-result-number" style="color:var(--${req.statusClass === 'critical' ? 'danger' : req.statusClass === 'warning' ? 'warning' : 'accent'});">
                ${req.requiredExamScore}
              </div>
              <div style="font-size:1.1rem; font-weight:700; color:var(--text-secondary);">
                / ${this.maxExamMarks} marks (${req.requiredExamPercentage}%)
              </div>
            </div>
            <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
              To secure <strong>Grade ${req.targetGrade}</strong> (minimum ${req.targetThreshold}/100 total marks), you must score at least <strong>${req.requiredExamScore} marks</strong> on the ${this.maxExamMarks}-mark end-semester examination.
            </p>
          </div>
        </div>

        <!-- Right: Interactive Exam Scenario Simulator -->
        <div class="ia-card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="margin-bottom:16px;">
              <h3 style="font-size:1.15rem; font-weight:700;">Grade Scenario Simulator</h3>
            </div>

            <div class="simulator-box">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.9rem;">Expected Exam Marks</span>
                <span style="font-family:var(--font-mono); font-weight:800; font-size:1.1rem; color:var(--accent);" id="sim-slider-val">
                  ${sim.expectedExam} / ${this.maxExamMarks}
                </span>
              </div>

              <div class="simulator-slider-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="${this.maxExamMarks}" 
                  step="0.5" 
                  value="${sim.expectedExam}" 
                  class="slider-range" 
                  id="ia-exam-slider" 
                />
              </div>

              <div class="simulator-output-row">
                <div class="sim-metric-box">
                  <div class="sim-label">Internal</div>
                  <div class="sim-val">${sim.currentInternal}</div>
                </div>
                <div class="sim-metric-box">
                  <div class="sim-label">Projected Total</div>
                  <div class="sim-val" style="color:var(--accent);">${sim.projectedTotal} / 100</div>
                </div>
                <div class="sim-metric-box">
                  <div class="sim-label">Projected Grade</div>
                  <div class="sim-val" style="color:var(--${sim.projectedGrade === 'S' || sim.projectedGrade === 'A' ? 'success' : sim.projectedGrade === 'F' ? 'danger' : 'warning'});">
                    Grade ${sim.projectedGrade}
                  </div>
                </div>
              </div>
            </div>

            <!-- Grade threshold reference table -->
            <div style="margin-top:20px;">
              <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px; letter-spacing:0.05em;">
                Active Grade Thresholds
              </h4>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                ${Object.entries(this.gradeThresholds).map(([gr, pts]) => `
                  <div style="padding:8px 10px; background:var(--bg-surface-elevated); border-radius:var(--radius-xs); border:1px solid var(--border-color); display:flex; justify-content:space-between; font-size:0.8rem;">
                    <span style="font-weight:700;">${gr}</span>
                    <span style="font-family:var(--font-mono); color:var(--text-muted);">${pts}–${gr === 'S' ? '100' : (pts + 9)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end;">
            <button class="btn btn-primary btn-sm" id="btn-save-ia-state">
              Save IA Assessment
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const container = document.getElementById('ia-container');
    if (!container) return;

    // Target grade chip click
    container.querySelectorAll('.grade-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const grade = chip.getAttribute('data-grade');
        this.selectedTargetGrade = grade;
        this.renderUI();
        this.saveState();
      });
    });

    // Slider input change
    const slider = document.getElementById('ia-exam-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.simulatedExamMarks = parseFloat(e.target.value) || 0;
        const sim = this.calculateProjectedGrade(this.simulatedExamMarks);
        const valEl = document.getElementById('sim-slider-val');
        if (valEl) {
          valEl.textContent = `${sim.expectedExam} / ${this.maxExamMarks}`;
        }
        this.renderUI();
      });
    }

    // Component mark input updates
    container.querySelectorAll('.ia-comp-scored, .ia-comp-max, .ia-comp-name').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.syncComponentsFromDOM();
      });
    });

    // Add component button
    const btnAdd = document.getElementById('btn-add-ia-component');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.currentComponents.push({
          name: `Component ${this.currentComponents.length + 1}`,
          maxMarks: 10,
          scoredMarks: 8
        });
        this.renderUI();
        this.saveState();
      });
    }

    // Remove component
    container.querySelectorAll('.btn-remove-ia-comp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.ia-component-row');
        const idx = parseInt(row.getAttribute('data-index'), 10);
        if (this.currentComponents.length <= 1) {
          window.toast.show('Keep at least one assessment component', 'warning');
          return;
        }
        this.currentComponents.splice(idx, 1);
        this.renderUI();
        this.saveState();
      });
    });

    // Save button
    const btnSave = document.getElementById('btn-save-ia-state');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        this.syncComponentsFromDOM();
        await this.saveState();
        window.toast.show('IA assessment calculations saved', 'success');
      });
    }
  }

  syncComponentsFromDOM() {
    const container = document.getElementById('ia-container');
    if (!container) return;

    const rows = container.querySelectorAll('.ia-component-row');
    const updated = [];

    rows.forEach((row) => {
      const name = row.querySelector('.ia-comp-name').value.trim() || 'Component';
      const scored = parseFloat(row.querySelector('.ia-comp-scored').value) || 0;
      const max = Math.max(1, parseFloat(row.querySelector('.ia-comp-max').value) || 10);
      updated.push({ name, maxMarks: max, scoredMarks: Math.min(max, scored) });
    });

    this.currentComponents = updated;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.iaPredictor = new IAPredictor();
