# PADIPP.OS — Student Academic Operating System

> **Your Academic Operating System**  
> *Track. Plan. Predict.*  
> **From Trivandrum, Kerala**

PADIPP.OS is a modern, production-grade, offline-first student academic operating system engineered for students, engineers, and researchers. It combines Kerala's cultural identity of *Padippu* (learning/education) with an Operating System philosophy to streamline academic planning, attendance compliance, internal assessment forecasting, class timetables, and deadline countdowns.

---

## ⚡ Core Modules & Architectural Features

### 1. Attendance Compliance Engine
- **Exact Discrete Math Formulas**:
  - **Current Attendance Percentage**:  
    $$\text{Percentage} = \frac{\text{Attended}}{\text{Conducted}} \times 100$$
  - **Safe Margin (Classes You Can Safely Miss)**:  
    $$\text{Buffer} = \left\lfloor \frac{\text{Attended}}{\text{Req\%}} - \text{Conducted} \right\rfloor$$
  - **Recovery Target (Consecutive Classes Required to Attend)**:  
    $$\text{Recovery} = \left\lceil \frac{\text{Req\%} \times \text{Conducted} - \text{Attended}}{1 - \text{Req\%}} \right\rceil$$
- Real-time compliance badges: **SAFE** ($\ge 80\%$), **WARNING** ($75\% - 79.9\%$), **CRITICAL** ($< 75\%$).
- Quick one-tap attendance toggles: `+ Attended`, `+ Missed`, and instant `Undo`.

### 2. Internal Assessment (IA) & Grade Predictor
- Fully customizable marking schemes (Midterms, Assignments, Attendance, Seminars/Viva).
- Configurable university grading scales (Default: S: 90+, A: 80+, B: 70+, C: 60+, D: 50+, E: 40+).
- **Target Exam Solver**: Computes the exact minimum marks required on the end-semester examination to secure the desired grade.
- **Interactive Scenario Simulator**: Dynamic slider simulating expected examination marks with instant real-time calculation of total marks and projected letter grade.

### 3. Weekly Timetable & Live Today View
- Weekly schedule manager supporting Monday through Saturday.
- Auto-detects the current day of the week.
- Detects currently active ongoing classes (`IN PROGRESS`) and counts down the exact hours, minutes, and seconds to the next lecture.

### 4. Exam & Deadline Countdown Manager
- Unified deadline tracking for Exams, Assignments, Project Milestones, and Lab Submissions.
- Live ticking countdown timers (Days, Hours, Minutes, Seconds) updated every second.
- Completion toggles and smart categorical filters.

### 5. Academic Intelligence & Analytics (Chart.js)
- **Subject Attendance Bar Chart** with target threshold compliance.
- **Health Distribution Doughnut Chart** showing safe vs warning vs critical subjects.
- **Internal Assessment Performance Breakdown** comparing scored marks against maximums.
- **Target vs Projected Exam Comparison** stacked chart.
- Automatic re-rendering when data mutations occur or theme switches.

### 6. Zero-Cloud Privacy & Offline-First PWA
- **Local IndexedDB**: All academic data, marks, and timetables remain 100% on the student's device.
- **Service Worker (`sw.js`)**: Caches static assets, stylesheets, scripts, and fonts for full offline operation.
- **PWA Manifest (`manifest.json`)**: Installable on Android, iOS, Windows, macOS, and Linux as a standalone web application.
- **Backup & Restore**: One-click JSON backup export (`PADIPP-OS-backup.json`) and schema-validated import.

---

## 🎨 Design System & Typography

- **Display Typography**: *Space Grotesk* (technical, editorial, modern display font).
- **Interface Typography**: *Plus Jakarta Sans* (high legibility, balanced weights).
- **Monospace Accent**: *JetBrains Mono* (precise timing and metrics).
- **Dual Themes**:
  - **Light Mode** (default): Warm off-white surfaces, crisp borders, slate/cyan accents.
  - **Dark Mode**: Deep charcoal-black background, elevated dark surfaces, high contrast, easy on the eyes during late-night study sessions.
  - Persistent preference in `localStorage`.

---

## 🚀 Deployment

PADIPP.OS is completely client-side with zero backend dependencies. It can be hosted on any static hosting platform:

### 1. Vercel
```bash
# Simply push repository or run:
vercel
```

### 2. GitHub Pages
1. Go to repository **Settings** $\rightarrow$ **Pages**.
2. Select branch `main` and root folder `/`.
3. Save.

### 3. Netlify
Drop the project folder directly into Netlify Drop or connect GitHub repository.

---

## 🧑‍💻 Developer & Origin

- **Location**: From Trivandrum, Kerala
- **Creator**: [KarthiiiDev](https://karthiiiidev.vercel.app/)
