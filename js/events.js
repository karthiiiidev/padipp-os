/**
 * PADIPP.OS — Exam & Deadline Manager
 * Dynamic countdowns, event classification, and deadline intelligence
 */

class EventsManager {
  constructor() {
    this.events = [];
    this.activeFilter = 'all';
    this.countdownInterval = null;
  }

  async load() {
    this.events = await window.db.getAll('events');
    this.sortEvents();
    this.startCountdownLoop();
    return this.events;
  }

  sortEvents() {
    this.events.sort((a, b) => {
      const dtA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dtB = new Date(`${b.date}T${b.time || '00:00'}`);
      return dtA - dtB;
    });
  }

  startCountdownLoop() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.tickCountdowns();
      this.updateOverviewExamCard();
    }, 1000);
  }

  calculateCountdown(dateStr, timeStr = '00:00') {
    const target = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (isNaN(diffMs)) {
      return { isExpired: true, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'Invalid date' };
    }

    if (diffMs <= 0) {
      return { isExpired: true, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'Due / Expired' };
    }

    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let formatted = '';
    if (days > 0) {
      formatted = `${days}d ${hours}h`;
    } else {
      formatted = `${hours}h ${minutes}m ${seconds}s`;
    }

    return {
      isExpired: false,
      days,
      hours,
      minutes,
      seconds,
      formatted,
      diffMs
    };
  }

  getNearestUpcomingExam() {
    const now = new Date();
    const upcoming = this.events.filter((e) => {
      if (e.completed) return false;
      const target = new Date(`${e.date}T${e.time || '00:00'}`);
      return target.getTime() > now.getTime();
    });

    if (upcoming.length === 0) return null;
    return upcoming[0];
  }

  updateOverviewExamCard() {
    const nearest = this.getNearestUpcomingExam();
    const nameEl = document.getElementById('overview-exam-name');
    const timeEl = document.getElementById('overview-exam-time');
    const badgeEl = document.getElementById('overview-exam-badge');

    if (nameEl) {
      if (nearest) {
        const cd = this.calculateCountdown(nearest.date, nearest.time);
        nameEl.textContent = nearest.title;
        if (timeEl) {
          timeEl.textContent = cd.days > 0 
            ? `${cd.days} day${cd.days > 1 ? 's' : ''}, ${cd.hours}h remaining`
            : `${cd.hours}h ${cd.minutes}m remaining`;
        }
        if (badgeEl) {
          badgeEl.className = 'badge badge-warning';
          badgeEl.textContent = nearest.type.toUpperCase();
        }
      } else {
        nameEl.textContent = 'No upcoming deadlines';
        if (timeEl) timeEl.textContent = 'All clear';
        if (badgeEl) {
          badgeEl.className = 'badge badge-neutral';
          badgeEl.textContent = 'CLEAR';
        }
      }
    }
  }

  tickCountdowns() {
    const blocks = document.querySelectorAll('.event-countdown-unit-box');
    blocks.forEach((block) => {
      const dateStr = block.getAttribute('data-date');
      const timeStr = block.getAttribute('data-time') || '00:00';
      if (!dateStr) return;

      const cd = this.calculateCountdown(dateStr, timeStr);
      const pad = (n) => String(n).padStart(2, '0');

      const dEl = block.querySelector('.cd-days');
      const hEl = block.querySelector('.cd-hours');
      const mEl = block.querySelector('.cd-mins');
      const sEl = block.querySelector('.cd-secs');

      if (cd.isExpired) {
        block.innerHTML = '<span class="badge badge-critical">DUE / EXPIRED</span>';
      } else {
        if (dEl) dEl.textContent = pad(cd.days);
        if (hEl) hEl.textContent = pad(cd.hours);
        if (mEl) mEl.textContent = pad(cd.minutes);
        if (sEl) sEl.textContent = pad(cd.seconds);
      }
    });
  }

  async addEvent(eventData) {
    const id = 'ev_' + Date.now();
    const newEvent = {
      id,
      title: eventData.title.trim(),
      type: eventData.type || 'exam',
      date: eventData.date,
      time: eventData.time || '10:00',
      subjectId: eventData.subjectId || '',
      notes: (eventData.notes || '').trim(),
      completed: false
    };

    await window.db.put('events', newEvent);
    await this.load();
    return newEvent;
  }

  async updateEvent(id, updates) {
    const existing = await window.db.get('events', id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    await window.db.put('events', updated);
    await this.load();
    return updated;
  }

  async deleteEvent(id) {
    await window.db.delete('events', id);
    await this.load();
  }

  async toggleComplete(id) {
    const existing = await window.db.get('events', id);
    if (!existing) return;
    existing.completed = !existing.completed;
    await window.db.put('events', existing);
    await this.load();
    window.toast.show(
      existing.completed ? 'Marked as completed' : 'Marked as pending',
      'info'
    );
  }

  renderEventsTab() {
    const container = document.getElementById('events-container');
    if (!container) return;

    let filtered = this.events;
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'completed') {
        filtered = this.events.filter((e) => e.completed);
      } else {
        filtered = this.events.filter((e) => e.type === this.activeFilter && !e.completed);
      }
    }

    const filterOptions = [
      { id: 'all', label: 'All Events' },
      { id: 'exam', label: 'Exams' },
      { id: 'assignment', label: 'Assignments' },
      { id: 'project', label: 'Projects' },
      { id: 'submission', label: 'Submissions' },
      { id: 'completed', label: 'Completed' }
    ];

    container.innerHTML = `
      <div class="events-filter-bar">
        <div class="event-filters">
          ${filterOptions.map((f) => `
            <button class="day-pill ${this.activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
              ${f.label}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-event">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Deadline
        </button>
      </div>

      <div class="events-list">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h3 class="empty-title">No upcoming deadlines found</h3>
            <p class="empty-desc">Stay on schedule by tracking midterms, assignments, lab submissions and finals.</p>
            <button class="btn btn-secondary btn-sm" id="btn-empty-add-event">
              Add an exam →
            </button>
          </div>
        ` : filtered.map((e) => {
          const cd = this.calculateCountdown(e.date, e.time);
          const pad = (n) => String(n).padStart(2, '0');

          return `
            <div class="event-card ${e.completed ? 'completed' : ''}" data-id="${e.id}">
              <div class="event-left">
                <input 
                  type="checkbox" 
                  class="event-checkbox" 
                  data-id="${e.id}" 
                  ${e.completed ? 'checked' : ''} 
                  title="Mark Completed"
                  style="width:18px; height:18px; cursor:pointer; accent-color:var(--accent);"
                />
                <div>
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="badge badge-accent">${e.type.toUpperCase()}</span>
                    <span style="font-size:0.775rem; font-family:var(--font-mono); color:var(--text-muted);">${e.date} • ${e.time || '10:00'}</span>
                  </div>
                  <h4 style="font-size:1.05rem; font-weight:700; ${e.completed ? 'text-decoration:line-through;' : ''}">${this.escapeHtml(e.title)}</h4>
                  ${e.notes ? `<p style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${this.escapeHtml(e.notes)}</p>` : ''}
                </div>
              </div>

              <div class="event-card-right">
                ${e.completed ? `
                  <span class="badge badge-safe">COMPLETED</span>
                ` : cd.isExpired ? `
                  <span class="badge badge-critical">DUE / EXPIRED</span>
                ` : `
                  <div class="event-countdown-unit-box" data-date="${e.date}" data-time="${e.time}">
                    <span class="countdown-digits cd-days">${pad(cd.days)}</span><span class="countdown-unit">d</span>
                    <span class="countdown-digits cd-hours">${pad(cd.hours)}</span><span class="countdown-unit">h</span>
                    <span class="countdown-digits cd-mins">${pad(cd.minutes)}</span><span class="countdown-unit">m</span>
                    <span class="countdown-digits cd-secs">${pad(cd.seconds)}</span><span class="countdown-unit">s</span>
                  </div>
                `}

                <div style="display:flex; align-items:center; gap:8px; margin-left:12px;">
                  <button class="btn btn-ghost btn-sm btn-icon btn-edit-event" data-id="${e.id}" title="Edit Event">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon btn-delete-event text-danger" data-id="${e.id}" title="Delete Event">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.bindEventsTabEvents();
  }

  bindEventsTabEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;

    // Filter pills
    container.querySelectorAll('.day-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.getAttribute('data-filter');
        this.renderEventsTab();
      });
    });

    // Add buttons
    const btnAdd = document.getElementById('btn-add-event');
    const btnEmptyAdd = document.getElementById('btn-empty-add-event');
    if (btnAdd) btnAdd.addEventListener('click', () => window.app.openEventModal());
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', () => window.app.openEventModal());

    // Checkbox toggle
    container.querySelectorAll('.event-checkbox').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-id');
        await this.toggleComplete(id);
        this.renderEventsTab();
        this.updateOverviewExamCard();
      });
    });

    // Edit button
    container.querySelectorAll('.btn-edit-event').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ev = this.events.find((e) => e.id === id);
        if (ev) window.app.openEventModal(ev);
      });
    });

    // Delete button
    container.querySelectorAll('.btn-delete-event').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this event?')) {
          await this.deleteEvent(id);
          this.renderEventsTab();
          this.updateOverviewExamCard();
          window.toast.show('Event deleted', 'info');
        }
      });
    });
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

window.eventsManager = new EventsManager();
