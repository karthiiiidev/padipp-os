/**
 * PADIPP.OS — Attendance Calculation Engine
 * Precise discrete mathematics for academic compliance
 */

class AttendanceEngine {
  constructor() {
    this.subjects = [];
    this.globalMinRequired = 75;
  }

  async load() {
    this.subjects = await window.db.getAll('subjects');
    const minSetting = await window.db.getSetting('minAttendancePercentage', 75);
    this.globalMinRequired = Number(minSetting) || 75;
    return this.subjects;
  }

  /**
   * Calculates metrics for a single subject
   */
  calculateSubjectMetrics(conducted, attended, minRequired = this.globalMinRequired) {
    const c = Math.max(0, parseInt(conducted, 10) || 0);
    const a = Math.max(0, parseInt(attended, 10) || 0);
    const reqRatio = Math.min(0.999, Math.max(0.01, (parseFloat(minRequired) || 75) / 100));

    if (c === 0) {
      return {
        percentage: 100,
        percentageDisplay: '100.0%',
        status: 'safe',
        canMiss: 0,
        needToAttend: 0,
        message: 'No classes conducted yet.',
        isSafe: true
      };
    }

    const currentRatio = a / c;
    const percentage = Math.round((currentRatio * 100) * 10) / 10;
    const percentageDisplay = `${percentage.toFixed(1)}%`;

    let status = 'critical';
    let isSafe = false;
    let canMiss = 0;
    let needToAttend = 0;
    let message = '';

    const reqPct = reqRatio * 100;

    if (percentage >= reqPct) {
      isSafe = true;
      if (percentage >= reqPct + 5) {
        status = 'safe';
      } else {
        status = 'warning';
      }

      // Exact integer classes that can be missed:
      // a / (c + M) >= reqRatio => M <= (a / reqRatio) - c
      canMiss = Math.floor((a / reqRatio) - c);
      if (canMiss < 0) canMiss = 0;

      if (canMiss === 0) {
        message = 'On the threshold. Do not miss the next class.';
      } else if (canMiss === 1) {
        message = 'You can safely miss 1 class.';
      } else {
        message = `You can safely miss ${canMiss} classes.`;
      }
    } else {
      status = 'critical';
      isSafe = false;

      // Exact integer consecutive classes to attend to reach requirement:
      // (a + C) / (c + C) >= reqRatio => C >= (reqRatio * c - a) / (1 - reqRatio)
      const exactNeed = (reqRatio * c - a) / (1 - reqRatio);
      needToAttend = Math.max(1, Math.ceil(exactNeed));

      if (needToAttend === 1) {
        message = `Need to attend 1 consecutive class to reach ${reqPct}%.`;
      } else {
        message = `Need to attend ${needToAttend} consecutive classes to reach ${reqPct}%.`;
      }
    }

    return {
      percentage,
      percentageDisplay,
      status,
      canMiss,
      needToAttend,
      message,
      isSafe,
      conducted: c,
      attended: a,
      minRequired: reqPct
    };
  }

  /**
   * Aggregate overall attendance calculation
   */
  calculateOverallMetrics() {
    if (!this.subjects || this.subjects.length === 0) {
      return {
        percentage: 0,
        percentageDisplay: '0.0%',
        totalConducted: 0,
        totalAttended: 0,
        status: 'safe',
        canMiss: 0,
        needToAttend: 0,
        message: 'No subjects added yet.'
      };
    }

    let totalConducted = 0;
    let totalAttended = 0;

    this.subjects.forEach((s) => {
      totalConducted += parseInt(s.conducted, 10) || 0;
      totalAttended += parseInt(s.attended, 10) || 0;
    });

    return this.calculateSubjectMetrics(totalConducted, totalAttended, this.globalMinRequired);
  }

  async addSubject(subjectData) {
    const id = 'sub_' + Date.now();
    const newSubject = {
      id,
      name: subjectData.name.trim(),
      code: (subjectData.code || '').trim(),
      conducted: parseInt(subjectData.conducted, 10) || 0,
      attended: parseInt(subjectData.attended, 10) || 0,
      minAttendancePercentage: parseInt(subjectData.minAttendancePercentage, 10) || this.globalMinRequired,
      color: subjectData.color || '#0284c7',
      createdAt: Date.now()
    };

    if (newSubject.attended > newSubject.conducted) {
      newSubject.conducted = newSubject.attended;
    }

    await window.db.put('subjects', newSubject);
    await this.load();
    return newSubject;
  }

  async updateSubject(id, updates) {
    const existing = await window.db.get('subjects', id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    if (updated.attended > updated.conducted) {
      updated.conducted = updated.attended;
    }

    await window.db.put('subjects', updated);
    await this.load();
    return updated;
  }

  async deleteSubject(id) {
    await window.db.delete('subjects', id);
    await this.load();
  }

  /**
   * Mark attendance event (+1 attended & +1 conducted, or +1 missed & +1 conducted)
   */
  async recordAttendance(subjectId, type) {
    const sub = await window.db.get('subjects', subjectId);
    if (!sub) return;

    if (type === 'attended') {
      sub.attended = (sub.attended || 0) + 1;
      sub.conducted = (sub.conducted || 0) + 1;
    } else if (type === 'missed') {
      sub.conducted = (sub.conducted || 0) + 1;
    }

    await window.db.put('subjects', sub);

    // Record in history log for undo
    const historyId = 'hist_' + Date.now();
    await window.db.put('attendance_history', {
      id: historyId,
      subjectId,
      type,
      timestamp: Date.now()
    });

    await this.load();
  }

  /**
   * Undo last attendance event
   */
  async undoLastAction(subjectId) {
    const history = await window.db.getAll('attendance_history');
    const subjectHistory = history
      .filter((h) => h.subjectId === subjectId)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (subjectHistory.length === 0) {
      window.toast.show('No recent attendance action to undo', 'warning');
      return;
    }

    const last = subjectHistory[0];
    const sub = await window.db.get('subjects', subjectId);
    if (!sub) return;

    if (last.type === 'attended') {
      sub.attended = Math.max(0, (sub.attended || 1) - 1);
      sub.conducted = Math.max(0, (sub.conducted || 1) - 1);
    } else if (last.type === 'missed') {
      sub.conducted = Math.max(0, (sub.conducted || 1) - 1);
    }

    await window.db.put('subjects', sub);
    await window.db.delete('attendance_history', last.id);
    await this.load();
    window.toast.show('Last attendance action undone', 'info');
  }

  renderCards() {
    const container = document.getElementById('subjects-grid');
    if (!container) return;

    if (!this.subjects || this.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <h3 class="empty-title">Start building your academic dashboard</h3>
          <p class="empty-desc">Add your subjects with current attended and conducted classes to track safe margins and recovery targets.</p>
          <button class="btn btn-primary" id="btn-add-first-subject">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add your first subject →
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.subjects.map((sub) => {
      const m = this.calculateSubjectMetrics(sub.conducted, sub.attended, sub.minAttendancePercentage);
      const statusClass = m.status === 'safe' ? 'safe' : m.status === 'warning' ? 'warning' : 'critical';

      return `
        <div class="subject-card" data-id="${sub.id}">
          <div class="subject-card-header">
            <div>
              <h3 class="subject-card-title">${this.escapeHtml(sub.name)}</h3>
              <div class="subject-card-code">${sub.code ? this.escapeHtml(sub.code) : 'REQ: ' + m.minRequired + '%'}</div>
            </div>
            <span class="badge badge-${statusClass}">
              ${statusClass.toUpperCase()}
            </span>
          </div>

          <div class="subject-attendance-stat">
            <div class="attendance-percentage" style="color: var(--${statusClass === 'critical' ? 'danger' : statusClass === 'warning' ? 'warning' : 'success'});">
              ${m.percentageDisplay}
            </div>
            <div class="attendance-ratio">
              ${m.attended} / ${m.conducted} classes
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar-fill progress-fill-${statusClass}" style="width: ${Math.min(100, Math.max(4, m.percentage))}%;"></div>
          </div>

          <div class="attendance-status-message status-msg-${statusClass}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              ${statusClass === 'safe' 
                ? '<polyline points="20 6 9 17 4 12"></polyline>' 
                : statusClass === 'warning' 
                  ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line>' 
                  : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
              }
            </svg>
            <span>${m.message}</span>
          </div>

          <div class="subject-card-actions">
            <button class="btn btn-secondary btn-sm action-btn-present" data-id="${sub.id}" title="Mark Present (+1 Attended, +1 Conducted)">
              + Attended
            </button>
            <button class="btn btn-secondary btn-sm action-btn-absent" data-id="${sub.id}" title="Mark Absent (+1 Conducted)">
              + Missed
            </button>
            <button class="btn btn-ghost btn-sm action-btn-undo" data-id="${sub.id}" title="Undo last action">
              ↺ Undo
            </button>
            <div style="flex:1;"></div>
            <button class="btn btn-ghost btn-sm btn-icon action-btn-edit" data-id="${sub.id}" title="Edit Subject">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon action-btn-delete text-danger" data-id="${sub.id}" title="Delete Subject">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
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

window.attendanceEngine = new AttendanceEngine();
