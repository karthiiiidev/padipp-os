/**
 * PADIPP.OS — Main Application Controller & Router
 */

class AppController {
  constructor() {
    this.currentView = 'landing';
    this.currentTab = 'overview';
    this.deferredPrompt = null;
  }

  async init() {
    // Check if first time run and database is empty
    const subjects = await window.db.getAll('subjects');
    if (subjects.length === 0) {
      // Auto-seed sample academic data so the dashboard is immediately rich & usable
      await window.db.loadSampleData();
    }

    // Initialize core engines
    await window.attendanceEngine.load();
    await window.iaPredictor.init();
    await window.timetableEngine.load();
    await window.eventsManager.load();

    // Register Service Worker
    this.registerServiceWorker();

    // Listen to hash changes & routing
    window.addEventListener('hashchange', () => this.handleRouting());
    this.handleRouting();

    // Bind global navigation and modal controls
    this.bindGlobalEvents();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('PADIPP.OS Service Worker registered with scope:', reg.scope))
          .catch((err) => console.log('Service Worker registration failed:', err));
      });
    }

    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });
  }

  handleRouting() {
    const hash = window.location.hash || '';

    if (hash === '' || hash === '#landing' || hash === '#') {
      this.showLanding();
    } else {
      const route = hash.replace('#', '');
      const validTabs = ['overview', 'attendance', 'ia', 'timetable', 'events', 'analytics', 'settings'];
      const targetTab = validTabs.includes(route) ? route : 'overview';
      this.showDashboard(targetTab);
    }
  }

  showLanding() {
    this.currentView = 'landing';
    const landingView = document.getElementById('view-landing');
    const appWrapper = document.getElementById('app-wrapper');

    if (landingView) landingView.style.display = 'block';
    if (appWrapper) appWrapper.style.display = 'none';

    window.scrollTo(0, 0);
  }

  showDashboard(tab = 'overview') {
    this.currentView = 'dashboard';
    this.currentTab = tab;

    const landingView = document.getElementById('view-landing');
    const appWrapper = document.getElementById('app-wrapper');

    if (landingView) landingView.style.display = 'none';
    if (appWrapper) appWrapper.style.display = 'flex';

    // Update active tab buttons in desktop sidebar and mobile bottom nav
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach((item) => {
      if (item.getAttribute('data-tab') === tab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update view panels
    document.querySelectorAll('.view-panel').forEach((panel) => {
      if (panel.id === `tab-${tab}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update header title
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    const titles = {
      overview: { title: 'Academic Overview', sub: 'Status, next classes and active deadlines' },
      attendance: { title: 'Attendance Manager', sub: 'Buffer calculations and minimum requirements' },
      ia: { title: 'IA & Grade Predictor', sub: 'Internal marks solver and exam simulator' },
      timetable: { title: 'Class Timetable', sub: 'Weekly schedule and room locations' },
      events: { title: 'Exams & Deadlines', sub: 'Assignments, submissions and countdowns' },
      analytics: { title: 'Academic Intelligence', sub: 'Visual analytics and performance benchmarks' },
      settings: { title: 'System Settings', sub: 'Thresholds, theme and data backup' }
    };

    if (headerTitle && titles[tab]) {
      headerTitle.textContent = titles[tab].title;
      if (headerSubtitle) headerSubtitle.textContent = titles[tab].sub;
    }

    // Trigger tab specific renders
    this.renderTab(tab);
  }

  async renderTab(tab) {
    switch (tab) {
      case 'overview':
        await this.renderOverview();
        break;
      case 'attendance':
        window.attendanceEngine.renderCards();
        break;
      case 'ia':
        window.iaPredictor.renderUI();
        break;
      case 'timetable':
        window.timetableEngine.renderTimetableTab();
        break;
      case 'events':
        window.eventsManager.renderEventsTab();
        break;
      case 'analytics':
        setTimeout(() => window.analyticsEngine.renderAll(), 50);
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  async renderOverview() {
    // 1. Overall Attendance Metric Card
    const attMetrics = window.attendanceEngine.calculateOverallMetrics();
    const ovPct = document.getElementById('ov-att-percentage');
    const ovRatio = document.getElementById('ov-att-ratio');
    const ovBadge = document.getElementById('ov-att-badge');
    const ovFooter = document.getElementById('ov-att-footer');

    if (ovPct) ovPct.textContent = attMetrics.percentageDisplay;
    if (ovRatio) ovRatio.textContent = `${attMetrics.attended} / ${attMetrics.conducted} classes`;
    if (ovBadge) {
      ovBadge.className = `badge badge-${attMetrics.status}`;
      ovBadge.textContent = attMetrics.status.toUpperCase();
    }
    if (ovFooter) {
      ovFooter.textContent = attMetrics.message;
    }

    // 2. IA Performance Card
    const internal = window.iaPredictor.calculateCurrentInternal();
    const ovIaScore = document.getElementById('ov-ia-score');
    const ovIaSub = document.getElementById('ov-ia-sub');
    const ovIaFooter = document.getElementById('ov-ia-footer');

    if (ovIaScore) ovIaScore.textContent = `${internal.scored} / ${internal.max}`;
    if (ovIaSub) ovIaSub.textContent = `${internal.percentage}% internal efficiency`;
    if (ovIaFooter) ovIaFooter.textContent = `Target: Grade ${window.iaPredictor.selectedTargetGrade} (${window.iaPredictor.gradeThresholds[window.iaPredictor.selectedTargetGrade] || 80}+ pts)`;

    // 3. Next Class & Timetable Today
    window.timetableEngine.updateNextClassDisplays();
    window.timetableEngine.renderOverviewTimeline();

    // 4. Upcoming Exam
    window.eventsManager.updateOverviewExamCard();
  }

  async renderSettings() {
    const minAttInput = document.getElementById('settings-min-attendance');
    const semNameInput = document.getElementById('settings-semester-name');
    const maxIntInput = document.getElementById('settings-max-internal');
    const maxExamInput = document.getElementById('settings-max-exam');

    if (minAttInput) {
      minAttInput.value = (await window.db.getSetting('minAttendancePercentage', 75)) || 75;
    }
    if (semNameInput) {
      semNameInput.value = (await window.db.getSetting('semesterName', 'Semester VI')) || 'Semester VI';
    }
    if (maxIntInput) {
      maxIntInput.value = (await window.db.getSetting('maxInternalMarks', 40)) || 40;
    }
    if (maxExamInput) {
      maxExamInput.value = (await window.db.getSetting('maxExamMarks', 60)) || 60;
    }
  }

  async refreshAll() {
    await window.attendanceEngine.load();
    await window.iaPredictor.init();
    await window.timetableEngine.load();
    await window.eventsManager.load();
    await this.renderTab(this.currentTab);
  }

  bindGlobalEvents() {
    // Mobile sidebar toggle
    const hamburgerBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (hamburgerBtn && sidebar) {
      hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (backdrop) backdrop.classList.toggle('active');
      });
    }

    if (backdrop && sidebar) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
      });
    }

    // Modal dismiss listeners
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          this.closeAllModals();
        }
      });
    });

    // PWA install button
    const pwaBtn = document.getElementById('btn-pwa-install');
    if (pwaBtn) {
      pwaBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            window.toast.show('PADIPP.OS installed successfully', 'success');
          }
          this.deferredPrompt = null;
          pwaBtn.style.display = 'none';
        }
      });
    }

    // Attendance buttons delegation (Present / Absent / Undo / Edit / Delete)
    const subGrid = document.getElementById('subjects-grid');
    if (subGrid) {
      subGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const subId = btn.getAttribute('data-id');

        if (btn.classList.contains('action-btn-present')) {
          await window.attendanceEngine.recordAttendance(subId, 'attended');
          window.attendanceEngine.renderCards();
          window.toast.show('Attendance marked: Present', 'success', 1500);
        } else if (btn.classList.contains('action-btn-absent')) {
          await window.attendanceEngine.recordAttendance(subId, 'missed');
          window.attendanceEngine.renderCards();
          window.toast.show('Attendance marked: Missed', 'warning', 1500);
        } else if (btn.classList.contains('action-btn-undo')) {
          await window.attendanceEngine.undoLastAction(subId);
          window.attendanceEngine.renderCards();
        } else if (btn.classList.contains('action-btn-edit')) {
          const s = window.attendanceEngine.subjects.find((item) => item.id === subId);
          if (s) this.openSubjectModal(s);
        } else if (btn.classList.contains('action-btn-delete')) {
          if (confirm('Delete this subject and its attendance records?')) {
            await window.attendanceEngine.deleteSubject(subId);
            window.attendanceEngine.renderCards();
            window.toast.show('Subject deleted', 'info');
          }
        }
      });
    }

    // Add Subject Button
    const btnAddSub = document.getElementById('btn-add-subject');
    if (btnAddSub) {
      btnAddSub.addEventListener('click', () => this.openSubjectModal());
    }

    // First subject button click (empty state)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-add-first-subject') {
        this.openSubjectModal();
      }
    });

    // Subject Form Submit
    const subjectForm = document.getElementById('form-subject');
    if (subjectForm) {
      subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('subject-id').value;
        const name = document.getElementById('subject-name').value;
        const code = document.getElementById('subject-code').value;
        const conducted = document.getElementById('subject-conducted').value;
        const attended = document.getElementById('subject-attended').value;
        const minReq = document.getElementById('subject-min-req').value;

        if (parseInt(attended, 10) > parseInt(conducted, 10)) {
          window.toast.show('Attended classes cannot exceed conducted classes', 'error');
          return;
        }

        if (id) {
          await window.attendanceEngine.updateSubject(id, {
            name,
            code,
            conducted: parseInt(conducted, 10) || 0,
            attended: parseInt(attended, 10) || 0,
            minAttendancePercentage: parseInt(minReq, 10) || 75
          });
          window.toast.show('Subject updated successfully', 'success');
        } else {
          await window.attendanceEngine.addSubject({
            name,
            code,
            conducted,
            attended,
            minAttendancePercentage: minReq
          });
          window.toast.show('Subject added successfully', 'success');
        }

        this.closeAllModals();
        window.attendanceEngine.renderCards();
        this.renderOverview();
      });
    }

    // Class Form Submit
    const classForm = document.getElementById('form-class');
    if (classForm) {
      classForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('class-id').value;
        const day = document.getElementById('class-day').value;
        const subjectName = document.getElementById('class-subject-name').value;
        const startTime = document.getElementById('class-start-time').value;
        const endTime = document.getElementById('class-end-time').value;
        const room = document.getElementById('class-room').value;
        const teacher = document.getElementById('class-teacher').value;

        if (startTime >= endTime) {
          window.toast.show('End time must be later than start time', 'error');
          return;
        }

        if (id) {
          await window.timetableEngine.updateClass(id, { day, subjectName, startTime, endTime, room, teacher });
          window.toast.show('Class updated in schedule', 'success');
        } else {
          await window.timetableEngine.addClass({ day, subjectName, startTime, endTime, room, teacher });
          window.toast.show('Class added to schedule', 'success');
        }

        this.closeAllModals();
        window.timetableEngine.renderTimetableTab();
        this.renderOverview();
      });
    }

    // Event Form Submit
    const eventForm = document.getElementById('form-event');
    if (eventForm) {
      eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('event-id').value;
        const title = document.getElementById('event-title').value;
        const type = document.getElementById('event-type').value;
        const date = document.getElementById('event-date').value;
        const time = document.getElementById('event-time').value;
        const notes = document.getElementById('event-notes').value;

        if (id) {
          await window.eventsManager.updateEvent(id, { title, type, date, time, notes });
          window.toast.show('Deadline updated', 'success');
        } else {
          await window.eventsManager.addEvent({ title, type, date, time, notes });
          window.toast.show('Deadline added', 'success');
        }

        this.closeAllModals();
        window.eventsManager.renderEventsTab();
        this.renderOverview();
      });
    }

    // Settings Save Button
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', async () => {
        const minAtt = parseInt(document.getElementById('settings-min-attendance').value, 10) || 75;
        const semName = document.getElementById('settings-semester-name').value.trim() || 'Semester';
        const maxInt = parseInt(document.getElementById('settings-max-internal').value, 10) || 40;
        const maxExam = parseInt(document.getElementById('settings-max-exam').value, 10) || 60;

        await window.db.setSetting('minAttendancePercentage', minAtt);
        await window.db.setSetting('semesterName', semName);
        await window.db.setSetting('maxInternalMarks', maxInt);
        await window.db.setSetting('maxExamMarks', maxExam);

        window.attendanceEngine.globalMinRequired = minAtt;
        window.iaPredictor.maxInternalMarks = maxInt;
        window.iaPredictor.maxExamMarks = maxExam;

        window.toast.show('Settings saved successfully', 'success');
        this.refreshAll();
      });
    }

    // Data Management Buttons (Export / Import / Reset / Load Demo)
    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) btnExport.addEventListener('click', () => window.dataManager.exportData());

    const btnImport = document.getElementById('btn-import-data');
    const importInput = document.getElementById('import-file-input');
    if (btnImport && importInput) {
      btnImport.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          window.dataManager.importData(e.target.files[0]);
          importInput.value = '';
        }
      });
    }

    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) btnReset.addEventListener('click', () => window.dataManager.resetData());

    const btnLoadDemo = document.getElementById('btn-load-demo-data');
    if (btnLoadDemo) {
      btnLoadDemo.addEventListener('click', async () => {
        if (confirm('Load sample academic data? This will populate subjects, timetable and exam deadlines.')) {
          await window.db.loadSampleData();
          await this.refreshAll();
          window.toast.show('Sample academic data loaded', 'success');
        }
      });
    }
  }

  openSubjectModal(subject = null) {
    const modal = document.getElementById('modal-subject');
    const title = document.getElementById('modal-subject-title');
    const form = document.getElementById('form-subject');

    if (!modal || !form) return;

    form.reset();
    if (subject) {
      title.textContent = 'Edit Subject';
      document.getElementById('subject-id').value = subject.id;
      document.getElementById('subject-name').value = subject.name;
      document.getElementById('subject-code').value = subject.code || '';
      document.getElementById('subject-conducted').value = subject.conducted;
      document.getElementById('subject-attended').value = subject.attended;
      document.getElementById('subject-min-req').value = subject.minAttendancePercentage || 75;
    } else {
      title.textContent = 'Add Academic Subject';
      document.getElementById('subject-id').value = '';
      document.getElementById('subject-min-req').value = window.attendanceEngine.globalMinRequired || 75;
    }

    modal.classList.add('active');
  }

  openClassModal(classItem = null, defaultDay = 1) {
    const modal = document.getElementById('modal-class');
    const title = document.getElementById('modal-class-title');
    const form = document.getElementById('form-class');

    if (!modal || !form) return;

    form.reset();
    if (classItem) {
      title.textContent = 'Edit Timetable Class';
      document.getElementById('class-id').value = classItem.id;
      document.getElementById('class-day').value = classItem.day;
      document.getElementById('class-subject-name').value = classItem.subjectName;
      document.getElementById('class-start-time').value = classItem.startTime;
      document.getElementById('class-end-time').value = classItem.endTime;
      document.getElementById('class-room').value = classItem.room || '';
      document.getElementById('class-teacher').value = classItem.teacher || '';
    } else {
      title.textContent = 'Add Timetable Class';
      document.getElementById('class-id').value = '';
      document.getElementById('class-day').value = defaultDay;
      document.getElementById('class-start-time').value = '09:00';
      document.getElementById('class-end-time').value = '10:00';
    }

    modal.classList.add('active');
  }

  openEventModal(eventItem = null) {
    const modal = document.getElementById('modal-event');
    const title = document.getElementById('modal-event-title');
    const form = document.getElementById('form-event');

    if (!modal || !form) return;

    form.reset();
    if (eventItem) {
      title.textContent = 'Edit Academic Deadline';
      document.getElementById('event-id').value = eventItem.id;
      document.getElementById('event-title').value = eventItem.title;
      document.getElementById('event-type').value = eventItem.type;
      document.getElementById('event-date').value = eventItem.date;
      document.getElementById('event-time').value = eventItem.time || '10:00';
      document.getElementById('event-notes').value = eventItem.notes || '';
    } else {
      title.textContent = 'Add Academic Deadline';
      document.getElementById('event-id').value = '';
      const tomorrow = new Date(Date.now() + 86400000);
      const pad = (n) => String(n).padStart(2, '0');
      document.getElementById('event-date').value = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      document.getElementById('event-time').value = '10:00';
    }

    modal.classList.add('active');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('active'));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
