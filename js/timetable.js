/**
 * PADIPP.OS — Timetable & Next-Class Live Engine
 * Day management, live timetable viewer, and precision countdowns
 */

class TimetableEngine {
  constructor() {
    this.classes = [];
    this.days = [
      { id: 1, name: 'Monday', short: 'Mon' },
      { id: 2, name: 'Tuesday', short: 'Tue' },
      { id: 3, name: 'Wednesday', short: 'Wed' },
      { id: 4, name: 'Thursday', short: 'Thu' },
      { id: 5, name: 'Friday', short: 'Fri' },
      { id: 6, name: 'Saturday', short: 'Sat' }
    ];
    this.activeDay = this.getTodayDayNumber();
    this.timerInterval = null;
  }

  getTodayDayNumber() {
    const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    return day === 0 ? 1 : day; // Default to Monday on Sundays
  }

  async load() {
    this.classes = await window.db.getAll('timetable');
    this.classes.sort((a, b) => a.startTime.localeCompare(b.startTime));
    this.startCountdownLoop();
    return this.classes;
  }

  getClassesForDay(dayNumber) {
    return this.classes
      .filter((c) => parseInt(c.day, 10) === parseInt(dayNumber, 10))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  /**
   * Identifies current ongoing class and the very next class
   */
  getNextClassInfo() {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 1 : now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    const todayClasses = this.getClassesForDay(currentDay);

    let ongoingClass = null;
    let nextClass = null;
    let nextClassDate = null;

    for (const item of todayClasses) {
      const [sh, sm] = item.startTime.split(':').map(Number);
      const [eh, em] = item.endTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      if (currentMinutes >= startMin && currentMinutes < endMin) {
        ongoingClass = item;
      } else if (currentMinutes < startMin && !nextClass) {
        nextClass = item;
        nextClassDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);
        break;
      }
    }

    // If no more classes today, look ahead to tomorrow or Monday
    if (!nextClass) {
      let lookAheadDays = 1;
      while (lookAheadDays <= 7) {
        let checkDay = (currentDay + lookAheadDays - 1) % 7 + 1;
        if (checkDay === 7) checkDay = 1; // Skip Sunday

        const dayClasses = this.getClassesForDay(checkDay);
        if (dayClasses.length > 0) {
          nextClass = dayClasses[0];
          const [sh, sm] = nextClass.startTime.split(':').map(Number);
          nextClassDate = new Date(now.getTime() + lookAheadDays * 86400000);
          nextClassDate.setHours(sh, sm, 0, 0);
          break;
        }
        lookAheadDays++;
      }
    }

    let countdownFormatted = '00:00:00';
    let secondsDiff = 0;

    if (nextClassDate) {
      secondsDiff = Math.max(0, Math.floor((nextClassDate.getTime() - now.getTime()) / 1000));
      const hours = Math.floor(secondsDiff / 3600);
      const minutes = Math.floor((secondsDiff % 3600) / 60);
      const seconds = secondsDiff % 60;
      const pad = (n) => String(n).padStart(2, '0');
      countdownFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    return {
      ongoingClass,
      nextClass,
      countdownFormatted,
      secondsDiff
    };
  }

  startCountdownLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.updateNextClassDisplays();
    }, 1000);
  }

  updateNextClassDisplays() {
    const info = this.getNextClassInfo();

    // Update Overview Card
    const titleEl = document.getElementById('overview-next-class-name');
    const timeEl = document.getElementById('overview-next-class-time');
    const roomEl = document.getElementById('overview-next-class-room');
    const countEl = document.getElementById('overview-next-class-countdown');
    const badgeEl = document.getElementById('overview-class-status-badge');

    if (titleEl) {
      if (info.ongoingClass) {
        titleEl.textContent = info.ongoingClass.subjectName;
        if (timeEl) timeEl.textContent = `${info.ongoingClass.startTime} — ${info.ongoingClass.endTime}`;
        if (roomEl) roomEl.textContent = info.ongoingClass.room ? `Room ${info.ongoingClass.room}` : 'Classroom';
        if (badgeEl) {
          badgeEl.className = 'badge badge-safe';
          badgeEl.textContent = 'IN PROGRESS';
        }
        if (countEl) countEl.textContent = 'Active now';
      } else if (info.nextClass) {
        titleEl.textContent = info.nextClass.subjectName;
        if (timeEl) timeEl.textContent = `${info.nextClass.startTime} — ${info.nextClass.endTime}`;
        if (roomEl) roomEl.textContent = info.nextClass.room ? `Room ${info.nextClass.room}` : 'Classroom';
        if (badgeEl) {
          badgeEl.className = 'badge badge-neutral';
          badgeEl.textContent = 'UPCOMING';
        }
        if (countEl) countEl.textContent = info.countdownFormatted;
      } else {
        titleEl.textContent = 'No upcoming classes';
        if (timeEl) timeEl.textContent = 'Schedule is free';
        if (roomEl) roomEl.textContent = '—';
        if (countEl) countEl.textContent = '00:00:00';
        if (badgeEl) {
          badgeEl.className = 'badge badge-neutral';
          badgeEl.textContent = 'OFF';
        }
      }
    }
  }

  async addClass(classData) {
    const id = 'tt_' + Date.now();
    const newClass = {
      id,
      day: parseInt(classData.day, 10) || 1,
      subjectId: classData.subjectId || '',
      subjectName: classData.subjectName.trim(),
      startTime: classData.startTime,
      endTime: classData.endTime,
      room: (classData.room || '').trim(),
      teacher: (classData.teacher || '').trim(),
      color: classData.color || '#0284c7'
    };

    await window.db.put('timetable', newClass);
    await this.load();
    return newClass;
  }

  async updateClass(id, updates) {
    const existing = await window.db.get('timetable', id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    await window.db.put('timetable', updated);
    await this.load();
    return updated;
  }

  async deleteClass(id) {
    await window.db.delete('timetable', id);
    await this.load();
  }

  renderTimetableTab() {
    const container = document.getElementById('timetable-container');
    if (!container) return;

    const currentClasses = this.getClassesForDay(this.activeDay);
    const dayName = this.days.find((d) => d.id === this.activeDay)?.name || 'Today';

    container.innerHTML = `
      <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div class="timetable-days-nav">
          ${this.days.map((d) => `
            <button class="day-pill ${this.activeDay === d.id ? 'active' : ''}" data-day="${d.id}">
              ${d.name}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-class">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Class
        </button>
      </div>

      <div class="timetable-classes-list">
        ${currentClasses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 class="empty-title">Your schedule for ${dayName} is empty</h3>
            <p class="empty-desc">Add recurring periods and lectures for this day with start and end times.</p>
            <button class="btn btn-secondary btn-sm" id="btn-empty-add-class" data-day="${this.activeDay}">
              Add a class →
            </button>
          </div>
        ` : currentClasses.map((c) => `
          <div class="timetable-class-card" data-id="${c.id}">
            <div class="class-time-block">
              <span style="display:inline-flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${c.startTime} — ${c.endTime}
              </span>
            </div>
            <div class="class-details-block">
              <div class="class-title">${this.escapeHtml(c.subjectName)}</div>
              <div class="class-subtext">
                ${c.room ? `<span>Room: <strong>${this.escapeHtml(c.room)}</strong></span>` : ''}
                ${c.room && c.teacher ? ' • ' : ''}
                ${c.teacher ? `<span>Faculty: ${this.escapeHtml(c.teacher)}</span>` : ''}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn btn-ghost btn-sm btn-icon btn-edit-class" data-id="${c.id}" title="Edit Class">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon btn-delete-class text-danger" data-id="${c.id}" title="Delete Class">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.bindTimetableTabEvents();
  }

  bindTimetableTabEvents() {
    const container = document.getElementById('timetable-container');
    if (!container) return;

    // Day pill tabs
    container.querySelectorAll('.day-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.activeDay = parseInt(pill.getAttribute('data-day'), 10);
        this.renderTimetableTab();
      });
    });

    // Add class button
    const btnAdd = document.getElementById('btn-add-class');
    const btnEmptyAdd = document.getElementById('btn-empty-add-class');
    const openAddModal = (day) => {
      window.app.openClassModal(null, day || this.activeDay);
    };

    if (btnAdd) btnAdd.addEventListener('click', () => openAddModal());
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', () => openAddModal());

    // Edit & Delete buttons
    container.querySelectorAll('.btn-edit-class').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const c = this.classes.find((item) => item.id === id);
        if (c) window.app.openClassModal(c);
      });
    });

    container.querySelectorAll('.btn-delete-class').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this class from the schedule?')) {
          await this.deleteClass(id);
          this.renderTimetableTab();
          window.app.renderOverview();
          window.toast.show('Class removed from schedule', 'info');
        }
      });
    });
  }

  renderOverviewTimeline() {
    const container = document.getElementById('overview-today-timeline');
    if (!container) return;

    const today = this.getTodayDayNumber();
    const todayClasses = this.getClassesForDay(today);
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    if (todayClasses.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:28px 16px;">
          <p style="font-size:0.875rem; color:var(--text-muted);">No classes scheduled for today.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = todayClasses.map((c) => {
      const [sh, sm] = c.startTime.split(':').map(Number);
      const [eh, em] = c.endTime.split(':').map(Number);
      const sMin = sh * 60 + sm;
      const eMin = eh * 60 + em;

      const isOngoing = currentMin >= sMin && currentMin < eMin;
      const isPast = currentMin >= eMin;

      return `
        <div class="timeline-item ${isOngoing ? 'active-class' : ''}" style="${isPast ? 'opacity:0.6;' : ''}">
          <div class="timeline-time">${c.startTime} — ${c.endTime}</div>
          <div class="timeline-info">
            <div class="timeline-subject">${this.escapeHtml(c.subjectName)}</div>
            <div class="timeline-room">${c.room ? `Room ${this.escapeHtml(c.room)}` : 'Classroom'}${c.teacher ? ` • ${this.escapeHtml(c.teacher)}` : ''}</div>
          </div>
          <div class="timeline-badge">
            ${isOngoing ? '<span class="badge badge-safe">ACTIVE</span>' : isPast ? '<span class="badge badge-neutral">DONE</span>' : '<span class="badge badge-accent">NEXT</span>'}
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

window.timetableEngine = new TimetableEngine();
