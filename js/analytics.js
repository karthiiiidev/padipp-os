/**
 * PADIPP.OS — Analytics & Chart.js Intelligence
 * High-performance visual reporting for academic progress
 */

class AnalyticsEngine {
  constructor() {
    this.charts = {};
  }

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(226, 232, 240, 0.8)',
      accent: isDark ? '#38bdf8' : '#0284c7',
      success: isDark ? '#10b981' : '#059669',
      warning: isDark ? '#f59e0b' : '#d97706',
      danger: isDark ? '#ef4444' : '#dc2626',
      bgElevated: isDark ? '#1e293b' : '#f1f5f9'
    };
  }

  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  }

  destroyAll() {
    Object.keys(this.charts).forEach((id) => this.destroyChart(id));
  }

  async renderAll() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js library not loaded yet');
      return;
    }

    this.destroyAll();
    const colors = this.getThemeColors();

    const subjects = await window.db.getAll('subjects');
    const minReq = (await window.db.getSetting('minAttendancePercentage', 75)) || 75;

    this.renderSubjectAttendanceChart(subjects, minReq, colors);
    this.renderAttendanceHealthChart(subjects, minReq, colors);
    this.renderIAMarksChart(colors);
    this.renderTargetVsProjectedChart(colors);
  }

  renderSubjectAttendanceChart(subjects, minReq, colors) {
    const canvas = document.getElementById('chart-subject-attendance');
    if (!canvas) return;

    if (subjects.length === 0) {
      canvas.parentElement.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.85rem;">Add subjects to view attendance analytics</div>';
      return;
    }

    const labels = subjects.map((s) => s.name);
    const data = subjects.map((s) => {
      const c = s.conducted || 0;
      const a = s.attended || 0;
      return c > 0 ? Math.round((a / c) * 1000) / 10 : 100;
    });

    const barColors = data.map((val) => {
      if (val >= minReq + 5) return colors.success;
      if (val >= minReq) return colors.warning;
      return colors.danger;
    });

    this.charts['subject_att'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Attendance %',
            data,
            backgroundColor: barColors,
            borderRadius: 6,
            barThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Attendance: ${context.parsed.y}% (Required: ${minReq}%)`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (val) => `${val}%`
            }
          }
        }
      }
    });
  }

  renderAttendanceHealthChart(subjects, minReq, colors) {
    const canvas = document.getElementById('chart-attendance-health');
    if (!canvas) return;

    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    subjects.forEach((s) => {
      const c = s.conducted || 0;
      const a = s.attended || 0;
      const pct = c > 0 ? (a / c) * 100 : 100;
      if (pct >= minReq + 5) safeCount++;
      else if (pct >= minReq) warningCount++;
      else criticalCount++;
    });

    this.charts['att_health'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Safe Margin', 'Near Warning', 'Critical Shortage'],
        datasets: [
          {
            data: [safeCount, warningCount, criticalCount],
            backgroundColor: [colors.success, colors.warning, colors.danger],
            borderWidth: 0,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.textColor, boxWidth: 12, padding: 14 }
          }
        },
        cutout: '72%'
      }
    });
  }

  renderIAMarksChart(colors) {
    const canvas = document.getElementById('chart-ia-performance');
    if (!canvas) return;

    const components = window.iaPredictor ? window.iaPredictor.currentComponents : [];
    if (components.length === 0) return;

    const labels = components.map((c) => c.name);
    const scoredData = components.map((c) => c.scoredMarks);
    const maxData = components.map((c) => c.maxMarks);

    this.charts['ia_perf'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Scored Marks',
            data: scoredData,
            backgroundColor: colors.accent,
            borderRadius: 6,
            barThickness: 16
          },
          {
            label: 'Maximum Marks',
            data: maxData,
            backgroundColor: colors.bgElevated,
            borderRadius: 6,
            barThickness: 16
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textColor, boxWidth: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 11 } }
          }
        }
      }
    });
  }

  renderTargetVsProjectedChart(colors) {
    const canvas = document.getElementById('chart-target-vs-projected');
    if (!canvas) return;

    const req = window.iaPredictor ? window.iaPredictor.calculateRequiredExam() : null;
    const sim = window.iaPredictor ? window.iaPredictor.calculateProjectedGrade(window.iaPredictor.simulatedExamMarks) : null;

    if (!req || !sim) return;

    this.charts['target_proj'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Target Scenario', 'Current Projected'],
        datasets: [
          {
            label: 'Current Internal',
            data: [req.currentInternal, sim.currentInternal],
            backgroundColor: colors.accent,
            borderRadius: 4
          },
          {
            label: 'Exam Marks',
            data: [req.requiredExamScore, sim.expectedExam],
            backgroundColor: colors.warning,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textColor, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const total = items.reduce((acc, curr) => acc + curr.parsed.y, 0);
                return `Total: ${total.toFixed(1)} / 100`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            stacked: true,
            max: 100,
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { family: 'JetBrains Mono', size: 11 } }
          }
        }
      }
    });
  }
}

window.analyticsEngine = new AnalyticsEngine();

// Re-render charts on theme change
window.addEventListener('themeChanged', () => {
  if (window.analyticsEngine) {
    window.analyticsEngine.renderAll();
  }
});
