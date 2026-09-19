/**
 * PADIPP.OS — Backup, Export & Import System
 * Local JSON serialization, data validation, and offline recovery
 */

class DataManager {
  async exportData() {
    try {
      const [subjects, attendanceHistory, iaEntries, timetable, events, settings] = await Promise.all([
        window.db.getAll('subjects'),
        window.db.getAll('attendance_history'),
        window.db.getAll('ia_entries'),
        window.db.getAll('timetable'),
        window.db.getAll('events'),
        window.db.getAll('settings')
      ]);

      const payload = {
        app: 'PADIPP.OS',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          subjects,
          attendanceHistory,
          iaEntries,
          timetable,
          events,
          settings
        }
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `PADIPP-OS-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.toast.show('Academic backup exported successfully', 'success');
    } catch (err) {
      console.error('Export error:', err);
      window.toast.show('Failed to export data', 'error');
    }
  }

  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        window.toast.show('Invalid backup file: Not valid JSON', 'error');
        return;
      }

      if (!parsed.data || typeof parsed.data !== 'object') {
        window.toast.show('Invalid backup format: Missing data schema', 'error');
        return;
      }

      const { subjects = [], attendanceHistory = [], iaEntries = [], timetable = [], events = [], settings = [] } = parsed.data;

      const confirmMsg = `Restore backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : 'file'}?\n\n` +
        `• Subjects: ${subjects.length}\n` +
        `• Timetable periods: ${timetable.length}\n` +
        `• Deadlines & Exams: ${events.length}\n\n` +
        `WARNING: This will replace your current data.`;

      if (!confirm(confirmMsg)) {
        return;
      }

      // Clear current stores
      await Promise.all([
        window.db.clear('subjects'),
        window.db.clear('attendance_history'),
        window.db.clear('ia_entries'),
        window.db.clear('timetable'),
        window.db.clear('events'),
        window.db.clear('settings')
      ]);

      // Restore
      for (const s of subjects) await window.db.put('subjects', s);
      for (const ah of attendanceHistory) await window.db.put('attendance_history', ah);
      for (const ia of iaEntries) await window.db.put('ia_entries', ia);
      for (const tt of timetable) await window.db.put('timetable', tt);
      for (const ev of events) await window.db.put('events', ev);
      for (const set of settings) await window.db.put('settings', set);

      window.toast.show('Data imported successfully!', 'success');

      // Reload app state
      if (window.app) {
        await window.app.refreshAll();
      }
    } catch (err) {
      console.error('Import error:', err);
      window.toast.show('Failed to import backup file', 'error');
    }
  }

  async resetData() {
    const confirm1 = confirm('Are you sure you want to reset all PADIPP.OS data? This action cannot be undone.');
    if (!confirm1) return;

    const confirm2 = confirm('Confirm once more: Erase all subjects, marks, timetable, and exams?');
    if (!confirm2) return;

    await Promise.all([
      window.db.clear('subjects'),
      window.db.clear('attendance_history'),
      window.db.clear('ia_entries'),
      window.db.clear('timetable'),
      window.db.clear('events'),
      window.db.clear('settings')
    ]);

    window.toast.show('All academic data has been reset', 'info');
    if (window.app) {
      await window.app.refreshAll();
    }
  }
}

window.dataManager = new DataManager();
