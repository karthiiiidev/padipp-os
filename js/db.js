/**
 * PADIPP.OS — IndexedDB Local Storage Layer
 * Offline-first persistent storage without external server dependency
 */
const DB_NAME = 'padipp_os_db';
const DB_VERSION = 1;

class AppDatabase {
  constructor() {
    this.db = null;
    this.initPromise = this.open();
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Subjects store
        if (!db.objectStoreNames.contains('subjects')) {
          const subjectsStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subjectsStore.createIndex('name', 'name', { unique: false });
        }

        // Attendance action history log
        if (!db.objectStoreNames.contains('attendance_history')) {
          const historyStore = db.createObjectStore('attendance_history', { keyPath: 'id' });
          historyStore.createIndex('subjectId', 'subjectId', { unique: false });
        }

        // IA Predictor entries
        if (!db.objectStoreNames.contains('ia_entries')) {
          const iaStore = db.createObjectStore('ia_entries', { keyPath: 'id' });
          iaStore.createIndex('subjectId', 'subjectId', { unique: true });
        }

        // Timetable entries
        if (!db.objectStoreNames.contains('timetable')) {
          const ttStore = db.createObjectStore('timetable', { keyPath: 'id' });
          ttStore.createIndex('day', 'day', { unique: false });
        }

        // Deadlines & Exams
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('date', 'date', { unique: false });
          eventStore.createIndex('type', 'type', { unique: false });
        }

        // User & Academic Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getAll(storeName) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, item) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, item) {
    return this.put(storeName, item);
  }

  async delete(storeName, id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    try {
      const res = await this.get('settings', key);
      return res ? res.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }

  /**
   * Loads sample data seeded from St. Thomas Institute Semester I A2-CS timetable
   */
  async loadSampleData() {
    // Clear existing
    await Promise.all([
      this.clear('subjects'),
      this.clear('attendance_history'),
      this.clear('ia_entries'),
      this.clear('timetable'),
      this.clear('events')
    ]);

    // Subjects (no labs, no workshop)
    const subjects = [
      {
        id: 'sub_mat',
        name: 'Mathematics For Information Science-1',
        code: 'GAMAT101',
        conducted: 30,
        attended: 26,
        minAttendancePercentage: 75,
        color: '#0284c7',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_phy',
        name: 'Physics',
        code: 'GXCYT122',
        conducted: 28,
        attended: 22,
        minAttendancePercentage: 75,
        color: '#7c3aed',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_eg',
        name: 'Engineering Graphics and Computer Aided Drawing',
        code: 'GMEST103',
        conducted: 20,
        attended: 18,
        minAttendancePercentage: 75,
        color: '#059669',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_bee',
        name: 'Introduction to Electrical & Electronics Engineering (Part 1: Electrical)',
        code: 'GXEST104',
        conducted: 18,
        attended: 14,
        minAttendancePercentage: 75,
        color: '#d97706',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_bec',
        name: 'Introduction to Electrical & Electronics Engineering (Part 2: Electronics)',
        code: 'GXEST104',
        conducted: 22,
        attended: 19,
        minAttendancePercentage: 75,
        color: '#0891b2',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_atp',
        name: 'Algorithmic Thinking With Python',
        code: 'UCEST105',
        conducted: 26,
        attended: 24,
        minAttendancePercentage: 75,
        color: '#16a34a',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_ls',
        name: 'Life Skills and Professional Communication',
        code: 'UCHUT128',
        conducted: 14,
        attended: 12,
        minAttendancePercentage: 75,
        color: '#db2777',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_mooc',
        name: 'Skill Enhancement Course: Digital 101 (NASSCOM)',
        code: 'UCSEM129',
        conducted: 10,
        attended: 9,
        minAttendancePercentage: 75,
        color: '#ea580c',
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: 'sub_cgpu',
        name: 'CGPU',
        code: 'UCSEM129',
        conducted: 8,
        attended: 7,
        minAttendancePercentage: 75,
        color: '#6d28d9',
        createdAt: Date.now() - 30 * 86400000
      }
    ];

    for (const sub of subjects) {
      await this.put('subjects', sub);
    }

    // Sample IA Entries
    const iaEntries = [
      {
        id: 'ia_mat',
        subjectId: 'sub_mat',
        subjectName: 'Mathematics For Information Science-1',
        components: [
          { name: 'Series Test 1', maxMarks: 20, scoredMarks: 16 },
          { name: 'Series Test 2', maxMarks: 20, scoredMarks: 17 },
          { name: 'Assignment', maxMarks: 10, scoredMarks: 8 },
          { name: 'Attendance', maxMarks: 10, scoredMarks: 9 }
        ],
        targetGrade: 'A',
        expectedExamMarks: 44
      },
      {
        id: 'ia_phy',
        subjectId: 'sub_phy',
        subjectName: 'Physics',
        components: [
          { name: 'Series Test 1', maxMarks: 20, scoredMarks: 14 },
          { name: 'Series Test 2', maxMarks: 20, scoredMarks: 15 },
          { name: 'Assignment', maxMarks: 10, scoredMarks: 7 },
          { name: 'Attendance', maxMarks: 10, scoredMarks: 8 }
        ],
        targetGrade: 'B',
        expectedExamMarks: 40
      },
      {
        id: 'ia_atp',
        subjectId: 'sub_atp',
        subjectName: 'Algorithmic Thinking With Python',
        components: [
          { name: 'Series Test 1', maxMarks: 20, scoredMarks: 18 },
          { name: 'Series Test 2', maxMarks: 20, scoredMarks: 19 },
          { name: 'Assignment', maxMarks: 10, scoredMarks: 10 },
          { name: 'Attendance', maxMarks: 10, scoredMarks: 9 }
        ],
        targetGrade: 'S',
        expectedExamMarks: 54
      }
    ];

    for (const ia of iaEntries) {
      await this.put('ia_entries', ia);
    }

    // Timetable — based on uploaded timetable image (Mon–Fri, 1=Mon … 5=Fri)
    const timetable = [
      // Day 1 — Monday
      { id: 'tt_1',  day: 1, subjectId: 'sub_bec', subjectName: 'BEC', startTime: '09:00', endTime: '10:00', room: 'A2-CS' },
      { id: 'tt_2',  day: 1, subjectId: 'sub_phy', subjectName: 'PHY', startTime: '10:00', endTime: '10:50', room: 'A2-CS' },
      { id: 'tt_3',  day: 1, subjectId: 'sub_bee', subjectName: 'BEE', startTime: '11:00', endTime: '12:00', room: 'A2-CS' },
      { id: 'tt_4',  day: 1, subjectId: 'sub_atp', subjectName: 'ATP', startTime: '12:50', endTime: '13:40', room: 'A2-CS' },
      { id: 'tt_5',  day: 1, subjectId: 'sub_mat', subjectName: 'MAT', startTime: '13:40', endTime: '14:30', room: 'A2-CS' },
      { id: 'tt_6',  day: 1, subjectId: 'sub_atp', subjectName: 'ATP', startTime: '14:40', endTime: '15:30', room: 'A2-CS' },
      { id: 'tt_7',  day: 1, subjectId: 'sub_cgpu', subjectName: 'CGPU', startTime: '15:30', endTime: '16:20', room: 'A2-CS' },

      // Day 2 — Tuesday
      { id: 'tt_8',  day: 2, subjectId: 'sub_bec', subjectName: 'BEC', startTime: '09:00', endTime: '10:00', room: 'A2-CS' },
      { id: 'tt_9',  day: 2, subjectId: 'sub_mat', subjectName: 'MAT', startTime: '10:00', endTime: '10:50', room: 'A2-CS' },
      { id: 'tt_10', day: 2, subjectId: 'sub_eg',  subjectName: 'EG',  startTime: '11:00', endTime: '12:00', room: 'A2-CS' },
      { id: 'tt_11', day: 2, subjectId: 'sub_phy', subjectName: 'PHY', startTime: '12:50', endTime: '13:40', room: 'A2-CS' },
      { id: 'tt_12', day: 2, subjectId: 'sub_bee', subjectName: 'BEE', startTime: '13:40', endTime: '14:30', room: 'A2-CS' },

      // Day 3 — Wednesday
      { id: 'tt_13', day: 3, subjectId: 'sub_mat', subjectName: 'MAT', startTime: '09:00', endTime: '10:00', room: 'A2-CS' },
      { id: 'tt_14', day: 3, subjectId: 'sub_mooc', subjectName: 'MOOC', startTime: '10:00', endTime: '10:50', room: 'A2-CS' },
      { id: 'tt_15', day: 3, subjectId: 'sub_bec', subjectName: 'BEC', startTime: '11:00', endTime: '12:00', room: 'A2-CS' },
      { id: 'tt_16', day: 3, subjectId: 'sub_eg',  subjectName: 'EG',  startTime: '12:50', endTime: '13:40', room: 'A2-CS' },
      { id: 'tt_17', day: 3, subjectId: 'sub_eg',  subjectName: 'EG',  startTime: '13:40', endTime: '14:30', room: 'A2-CS' },
      { id: 'tt_18', day: 3, subjectId: 'sub_atp', subjectName: 'ATP', startTime: '14:40', endTime: '15:30', room: 'A2-CS' },

      // Day 4 — Thursday
      { id: 'tt_19', day: 4, subjectId: 'sub_phy', subjectName: 'PHY', startTime: '09:00', endTime: '10:00', room: 'A2-CS' },
      { id: 'tt_20', day: 4, subjectId: 'sub_mat', subjectName: 'MAT', startTime: '10:00', endTime: '10:50', room: 'A2-CS' },
      { id: 'tt_21', day: 4, subjectId: 'sub_mat', subjectName: 'MAT', startTime: '11:00', endTime: '12:00', room: 'A2-CS' },
      { id: 'tt_22', day: 4, subjectId: 'sub_phy', subjectName: 'PHY', startTime: '12:50', endTime: '13:40', room: 'A2-CS' },
      { id: 'tt_23', day: 4, subjectId: 'sub_cgpu', subjectName: 'CGPU', startTime: '13:40', endTime: '14:30', room: 'A2-CS' },
      { id: 'tt_24', day: 4, subjectId: 'sub_ls',  subjectName: 'LS',  startTime: '15:30', endTime: '16:20', room: 'A2-CS' },

      // Day 5 — Friday
      { id: 'tt_25', day: 5, subjectId: 'sub_bee', subjectName: 'BEE', startTime: '09:00', endTime: '10:00', room: 'A2-CS' },
      { id: 'tt_26', day: 5, subjectId: 'sub_eg',  subjectName: 'EG',  startTime: '12:50', endTime: '13:40', room: 'A2-CS' },
      { id: 'tt_27', day: 5, subjectId: 'sub_atp', subjectName: 'ATP', startTime: '14:40', endTime: '15:30', room: 'A2-CS' }
    ];

    for (const item of timetable) {
      await this.put('timetable', item);
    }

    // Deadlines / Events
    const now = new Date();
    const d3  = new Date(now.getTime() +  3 * 86400000);
    const d7  = new Date(now.getTime() +  7 * 86400000);
    const d14 = new Date(now.getTime() + 14 * 86400000);
    const d30 = new Date(now.getTime() + 30 * 86400000);

    const pad   = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const events = [
      {
        id: 'ev_1',
        title: 'Mathematics Series Test',
        type: 'exam',
        date: toYMD(d3),
        time: '10:00',
        subjectId: 'sub_mat',
        notes: 'Chapter 1–3: Matrices, Eigenvalues, Calculus basics.',
        completed: false
      },
      {
        id: 'ev_2',
        title: 'ATP Python Assignment Submission',
        type: 'assignment',
        date: toYMD(d7),
        time: '17:00',
        subjectId: 'sub_atp',
        notes: 'Python programs on sorting algorithms and file I/O.',
        completed: false
      },
      {
        id: 'ev_3',
        title: 'Engineering Graphics Drawing Submission',
        type: 'assignment',
        date: toYMD(d14),
        time: '09:00',
        subjectId: 'sub_eg',
        notes: 'Orthographic projection drawing sheets.',
        completed: false
      },
      {
        id: 'ev_4',
        title: 'End-Semester University Examinations',
        type: 'exam',
        date: toYMD(d30),
        time: '09:30',
        subjectId: '',
        notes: 'Semester I A2-CS final examinations.',
        completed: false
      }
    ];

    for (const ev of events) {
      await this.put('events', ev);
    }

    // Default settings
    await this.setSetting('minAttendancePercentage', 75);
    await this.setSetting('semesterName', 'Semester I A2 — CS (2026-27)');
    await this.setSetting('maxInternalMarks', 40);
    await this.setSetting('maxExamMarks', 60);
    await this.setSetting('gradeThresholds', {
      S: 90,
      A: 80,
      B: 70,
      C: 60,
      D: 50,
      E: 40
    });

    return true;
  }
}

window.db = new AppDatabase();
