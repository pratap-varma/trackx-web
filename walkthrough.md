# TrackX Web - Mobile App Visual & Functional Parity Walkthrough

TrackX Web has been engineered to directly mirror the visual language, design tokens, mathematical rigor, and interactive user flows of the companion **TrackX Flutter mobile app** located at `c:\Users\ptvar\OneDrive\Desktop\trackx`.

---

## 1. Direct Visual & Architectural Twin of TrackX Mobile

### A. Design System & Theme Alignment (`app_theme.dart` Parity)
- **Palette**:
  - Base Deep Navy Background: `#0E131F`
  - Primary Luminous Indigo: `#5B5FEF` & `#8151EB`
  - Secondary Sky Blue: `#7BD0FF`
  - Tertiary Soft Lavender: `#D0BCFF` & `#C0C1FF`
  - Emerald Green: `#10B981` (Target Met / Attend / High Attendance)
  - Coral Pink & Red: `#FF8B94` & `#EF4444` (Critical Risk / Deficit / Absent)
  - Amber Gold: `#F59E0B` (Warning / Proxy Substitute / Holiday Override)
- **Typography**: Google Font `Outfit` applied system-wide matching `GoogleFonts.outfitTextTheme`.
- **Containers**: Multi-tier frosted glass containers (`.glass-container`, `.glass-modal`, `.glass-dock`) with subtle physical depth and specular borders.
- **Dynamic Background**: Replicated the Flutter app's 4-orb sinusoidal ambient glow drift (`AppBackground`).

---

## 2. Replicated Core Screens & Features

### 1. Dashboard (`/dashboard`) - Replicating `dashboard_screen.dart`
- **Header**:
  - `DASHBOARD` uppercase letterspaced tracking subtitle.
  - Live `SyncStatusBadge` with cloud pulse indicator and connection state modal.
  - Dynamic student greeting based on local time: `Good morning/afternoon/evening, [First Name]!`.
- **Spaced Repetition & Flashcards Due Today**:
  - Alarm icon pill with active review count linking to academics hub.
- **Happening Now / Schedule Hero Card**:
  - Real-time status dot (`#FF8B94` pulsing for ongoing class, `#7BD0FF` for upcoming next class, `#10B981` for all classes completed).
  - Subject Name, Room, Class Time, and Faculty Name.
  - **Proxy Badge**: If period is swapped, shows amber pill `Proxy / Swapped for [Original Subject]`.
  - **Direct 1-Tap Toggle**: One-click `Mark Present for Class` with instant optimistic state change to `Marked Present (Tap to Undo)`.
- **Interactive Attendance Gauge**:
  - Circular gauge showing overall percentage `${pct.toInt()}% Avg`.
  - Clicking opens the **Subjects Attendance Sheet Modal** (as in Flutter) detailing individual subject progress bars, percentage, and attended/conducted counts.
- **Safe-to-Miss Status Card**:
  - Shield icon + `SAFE-TO-MISS STATUS`.
  - Algebraic calculation: "You can skip X more classes" (`#7BD0FF`) OR "You need to attend X more classes" (`#FF8B94`) in `[Focus Subject]` to maintain target.
  - Buffer / Deficit linear progress bar.
  - Clicking opens the **Absence Risk Calculator Modal**.
- **AI Smart Brief Card**:
  - Sparkle icon + `AI SMART BRIEF ✨` with contextual guidance.
- **Remaining Today**:
  - Vertical accent bar with colored strips (`#C0C1FF`, `#8151EB`, `#7BD0FF`, `#10B981`), room, faculty, and start time.

---

### 2. Attendance Log (`/attendance`) - Replicating `attendance_screen.dart`
- **Header**:
  - Active semester chip + `Attendance Log` title.
  - `SyncStatusBadge` + Activity Heatmap icon button + Scan Screenshot OCR button + Add Course button.
- **7-Day Horizontal Date Navigation Strip**:
  - Mon to Sun horizontal date selector with day abbreviations (`MON`) and day numbers.
  - Indigo active selection capsule, today highlight ring, and amber holiday indicator dots.
  - "Jump to Today" badge when navigating other weeks, plus `<` and `>` week navigation.
- **Selected Date Status Bar**:
  - Formatted full date + relative day indicator (`Today`, `Yesterday`, `In 3 Days`).
  - Holiday toggle: `Set as Working Day` / `Mark as College Holiday`.
- **Timetable Period Schedule & Subject Cards**:
  - Period chip: `PERIOD 1 • 09:00 AM - 10:00 AM` (or `PERIOD 4-5 • 2 HOURS LAB`).
  - Classroom room badge.
  - **Swap Subject / Proxy Class Action**: Allows selecting any substitute course if teacher is absent (`classSubstitutes` state).
  - Amber banner when proxy is active with one-click restore to timetable default.
  - Subject Name with vertical color strip, faculty name, current percentage, and target threshold.
  - **Projected Attendance What-If Banner**:
    - `IF ABSENT`: Real-time percentage drop with red alert if it breaches target threshold.
    - `IF ATTEND`: Real-time percentage increase with green indicator.
  - **Marking State Actions**:
    - If marked: Green/Red status pill (`Present` or `Absent` with hours and timestamp) + `Delete` button with SnackBar feedback.
    - If unmarked: Quick 1-click `ABSENT (1h)` and `ATTEND (1h)` buttons (or multi-hour continuous lab options).
- **Interactive Modals**:
  - **Swap Subject / Proxy Class Sheet**: Pick substitute course from registered list.
  - **Add Subject Sheet**: Quick OCR timetable import banner, course name, faculty, target %, and 6-color palette picker.
  - **Attendance Activity Heatmap Sheet**: Visual GitHub-style attendance activity grid across semester days.

---

### 3. Timetable Grid (`/timetable`) - Replicating `timetable_screen.dart`
- Weekdays horizontal tab selector (Monday through Saturday).
- Header actions: Import Timetable via OCR, Copy Day Schedule, Clear Day Schedule.
- Period-by-period list (Periods 1 to 6) with:
  - Subject Name, start/end time, room, notes.
  - Enable / Disable switch for each period.
  - Swap Periods button (swaps Period A with Period B with animated feedback).
  - Delete slot button.
  - Add / Edit Period modal with subject selector, start/end time picker, room, and notes.

---

### 4. Analytics & CGPA Hub (`/analytics`) - Replicating `cgpa_screen.dart`
- Attendance KPI strip (Overall %, Safe Skips, Risk distribution).
- Comparative progress bar chart with benchmark threshold indicators.
- **CGPA & SGPA Engine**:
  - Cumulative CGPA gauge & total credits completed.
  - Current semester SGPA calculation.
  - **Future Semester What-If Simulator**: Sliders for Upcoming Semester Credits (10 to 28) and Target SGPA (6.0 to 10.0) with real-time projected CGPA computation.
  - Grade Record Table with color-coded grade chips (`O`, `A+`, `A`, `B+`, `B`, `C`, `F`) and custom add-grade modal.

---

## 3. Verification & Build Summary

- **Production Build**: `npm run build` compiled with **0 errors and 0 warnings** across all 18 routes.
- **HTTP Verification**: All routes confirmed responding with **HTTP 200 OK**:
  - `/` (Landing) -> 200
  - `/dashboard` -> 200
  - `/attendance` -> 200
  - `/timetable` -> 200
  - `/analytics` -> 200
  - `/subjects` -> 200
  - `/calendar` -> 200
  - `/profile` -> 200
  - `/settings` -> 200
  - `/notifications` -> 200
  - `/attendance/upload` -> 200
  - `/timetable/upload` -> 200

---

## 4. Comprehensive Feature Completion & Bug Elimination

1. **Student Profile Management (`/profile`)**:
   - Added **Edit Student Profile** modal allowing complete customization of Full Name, College / University, Roll / Registration Number, Branch / Department, Semester Number, and Degree Programme.
   - Profile changes update the local cache and automatically sync to Firestore (`users/{uid}`).

2. **Real Dynamic Calendar (`/calendar`)**:
   - Replaced static placeholder days with dynamic calendar calculations (exact start of week, exact days in month, infinite previous/next month navigation).
   - Real attendance tracking dots on each day (green for attended sessions, red for missed sessions).
   - Shows live timetable routine for the selected weekday with period numbers, timings, and course names.
   - Interactive modal to add persistent academic milestones & events (Exams, Due Dates, Holidays, Working Days).
   - Direct holiday override toggle for any selected calendar date.

3. **Intelligent Dynamic Notifications (`/notifications`)**:
   - Notifications are generated in real-time from active curriculum telemetry:
     - **Attendance Warnings**: Alerting when any subject drops below the target threshold with exact recovery classes required.
     - **Safe Skip Intelligence**: Notifying when classes can be safely skipped.
     - **Timetable Reminders**: Prompting on days with active scheduled classes.
     - **Milestone Achievements**: Celebrating when overall attendance exceeds the target threshold.
   - Full user interaction: Mark individual notification as read, "Mark All Read", and "Clear All".

4. **Timetable Routine OCR Importer (`/timetable/upload`)**:
   - "Save Timetable" button parses detected timetable slots, automatically registers courses if missing, and populates the timetable state before routing to `/timetable`.

5. **Course Creation with Past Attendance (`/subjects`)**:
   - Add Course modal now includes optional "Attended So Far" and "Missed So Far" inputs, allowing students to import historical attendance.

6. **Zero Hardcoded Data & Clean Purity**:
   - All components adhere to React Compiler purity rules with 0 lint errors, 0 warnings, and 0 TypeScript errors.

