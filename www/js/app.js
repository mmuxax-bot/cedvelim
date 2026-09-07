/* app.js — UI qatı */
(function () {
  "use strict";

  const FREE_SCHEDULE_LIMIT = 1; // Premium olmadan icazə verilən cədvəl sayı

  let state = {
    mainTab: "home",       // "home" | "schedule" | "tasks" | "stats"
    view: "week",          // "week" | "day" | "grid"
    activeDay: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, // Bazar ertəsi=0
    homeDay: null,
    editingLessonId: null,
    selectedColor: null,
    selectedDays: [],
    taskFilter: "all",
    editingTaskId: null,
    selectedTaskType: "tapşırıq"
  };

  const el = (id) => document.getElementById(id);
  const SUBJECT_ICON_COLORS = COLORS; // eyni palitra ikon nişanları üçün də istifadə olunur

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    Store.load();
    applyTheme(Store.db.settings.theme);
    await Billing.init().catch(() => {});
    if (window.LocalNotifications) {
      window.LocalNotifications.requestPermissions().catch(() => {});
    }

    renderDayTabs();
    renderColorPicker();
    renderScheduleTitle();
    render();
    bindEvents();
    renderHome();
  });

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }

  function toggleTheme() {
    const next = Store.db.settings.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    Store.setTheme(next);
  }

  // ---------- Rendering ----------
  function renderScheduleTitle() {
    const sch = Store.activeSchedule();
    el("scheduleTitle").textContent = sch.name;
    el("scheduleSubtitle").textContent = state.view === "day" ? DAYS[state.activeDay] : "Bütün həftə";
  }

  function renderDayTabs() {
    const tabs = el("dayTabs");
    tabs.innerHTML = "";
    DAYS.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.className = "daytab" + (idx === state.activeDay ? " active" : "");
      btn.textContent = name.split(" ")[0];
      btn.title = name;
      btn.dataset.day = idx;
      btn.addEventListener("click", () => {
        state.activeDay = idx;
        if (state.view === "day") { renderDayTabs(); render(); renderScheduleTitle(); }
        else { renderDayTabs(); scrollToDay(idx); }
      });
      tabs.appendChild(btn);
    });
    tabs.hidden = false;
  }

  function scrollToDay(idx) {
    const target = document.querySelector('.day-heading[data-day="' + idx + '"]');
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function lessonCard(l) {
    const card = document.createElement("div");
    card.className = "lesson-card";
    const initial = (l.subject || "?").trim().charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="lesson-icon" style="background:${l.color || "#4f9d8d"}">${initial}</div>
      <div class="lesson-main">
        <div class="lesson-time">${l.start} – ${l.end}${l.reminder ? " · 🔔" : ""}</div>
        <div class="lesson-subject"></div>
        <div class="lesson-meta"></div>
        ${l.notes ? `<div class="lesson-notes"></div>` : ""}
      </div>`;
    card.querySelector(".lesson-subject").textContent = l.subject;
    const meta = [];
    if (l.teacher) meta.push("👨‍🏫 " + l.teacher);
    if (l.room) meta.push("🏫 " + l.room);
    card.querySelector(".lesson-meta").textContent = meta.join("   ");
    if (l.notes) card.querySelector(".lesson-notes").textContent = l.notes;
    card.addEventListener("click", () => openLessonSheet(l));
    return card;
  }

  function render() {
    const list = el("lessonList");
    const empty = el("emptyState");
    const gridView = el("gridView");

    const query = el("searchInput").value.trim();

    if (state.view === "grid" && !query) {
      list.hidden = true;
      empty.hidden = true;
      gridView.hidden = false;
      el("dayTabs").hidden = true;
      renderGrid();
      return;
    }
    list.hidden = false;
    gridView.hidden = true;
    el("dayTabs").hidden = false;

    list.innerHTML = "";

    if (query) {
      const results = Store.search(query);
      if (!results.length) {
        empty.hidden = false;
        el("emptyState").querySelector("p").textContent = "Heç nə tapılmadı.";
        el("btnEmptyAdd").hidden = true;
        return;
      }
      empty.hidden = true;
      let lastDay = null;
      results.forEach(l => {
        if (l.day !== lastDay) {
          list.appendChild(dayHeading(l.day));
          lastDay = l.day;
        }
        list.appendChild(lessonCard(l));
      });
      return;
    }

    el("btnEmptyAdd").hidden = false;

    if (state.view === "day") {
      const lessons = Store.lessonsForDay(state.activeDay);
      if (!lessons.length) {
        empty.hidden = false;
        empty.querySelector("p").textContent = "Bu gün üçün dərs yoxdur.";
      } else {
        empty.hidden = true;
        lessons.forEach(l => list.appendChild(lessonCard(l)));
      }
    } else {
      const groups = Store.allLessonsGrouped();
      const any = groups.some(g => g.lessons.length);
      if (!any) {
        empty.hidden = false;
        empty.querySelector("p").textContent = "Hələ heç bir dərs əlavə etməmisən.";
      } else {
        empty.hidden = true;
        groups.forEach(g => {
          if (!g.lessons.length) return;
          list.appendChild(dayHeading(g.day));
          g.lessons.forEach(l => list.appendChild(lessonCard(l)));
        });
      }
    }
  }

  const COLUMN_PX = 84; // px, hər sütunun eni (sütun sayından asılı olmayaraq sabit)

  function renderGrid() {
    const gs = Store.activeSchedule().gridSettings || { days: [0, 1, 2, 3, 4, 5, 6], startHour: null, endHour: null, columns: null };
    const allGroups = Store.allLessonsGrouped();
    const groups = allGroups.filter(g => gs.days.includes(g.day));
    const visibleLessons = groups.flatMap(g => g.lessons);

    let minH = gs.startHour != null ? gs.startHour : 8;
    let maxH = gs.endHour != null ? gs.endHour : 18;
    if (gs.startHour == null || gs.endHour == null) {
      if (visibleLessons.length) {
        if (gs.startHour == null) minH = Math.max(0, Math.min(...visibleLessons.map(l => parseInt(l.start))) - 1);
        if (gs.endHour == null) maxH = Math.min(24, Math.max(...visibleLessons.map(l => Math.ceil(toMinutes(l.end) / 60))) + 1);
      }
      if (maxH - minH < 2) maxH = Math.min(24, minH + 2);
    }
    const totalMinutes = Math.max(60, (maxH - minH) * 60);
    const columns = gs.columns && gs.columns > 0 ? gs.columns : (maxH - minH);
    const trackWidth = columns * COLUMN_PX;
    const minutesPerColumn = totalMinutes / columns;

    if (!groups.length) {
      el("gridScroll").innerHTML = `<p class="muted-hint" style="padding:16px 4px;">Seçilmiş günlərdə göstəriləcək gün yoxdur — "⚙️ Düzənlə"dən gün əlavə et.</p>`;
      return;
    }

    let html = '<div class="grid-table">';

    // Baş sətir — sütun etiketləri (vaxt)
    html += '<div class="grid-headrow"><div class="grid-daylabel"></div>';
    html += `<div class="grid-track" style="width:${trackWidth}px">`;
    for (let c = 0; c <= columns; c++) {
      const mins = minH * 60 + c * minutesPerColumn;
      const hh = Math.floor(mins / 60), mm = Math.round(mins % 60);
      html += `<div class="grid-headcell" style="position:absolute; left:${c * COLUMN_PX}px;">${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}</div>`;
    }
    html += '</div></div>';

    groups.forEach(g => {
      html += `<div class="grid-row"><div class="grid-daylabel">${g.name.split(" ")[0]}</div>`;
      html += `<div class="grid-track" style="width:${trackWidth}px">`;
      for (let c = 0; c <= columns; c++) {
        html += `<div class="grid-hourline" style="left:${c * COLUMN_PX}px"></div>`;
      }
      g.lessons.forEach(l => {
        const startMin = toMinutes(l.start) - minH * 60;
        const endMin = toMinutes(l.end) - minH * 60;
        const left = (startMin / totalMinutes) * trackWidth;
        const width = Math.max((Math.max(endMin - startMin, 0) / totalMinutes) * trackWidth - 3, 30);
        html += `<div class="grid-block" data-id="${l.id}" style="left:${left}px; width:${width}px; background:${l.color || "#4f9d8d"}">
          <b>${escapeHtml(l.subject)}</b>${l.room ? escapeHtml(l.room) : ""}
        </div>`;
      });
      html += '</div></div>';
    });

    html += '</div>';
    const scroll = el("gridScroll");
    scroll.innerHTML = html;
    scroll.querySelectorAll(".grid-block").forEach(b => {
      b.addEventListener("click", () => {
        const lesson = Store.activeSchedule().lessons.find(x => x.id === b.dataset.id);
        if (lesson) openLessonSheet(lesson);
      });
    });
  }

  // ---------- Grid düzənləmə paneli ----------
  function populateHourSelect(select, selectedVal) {
    select.innerHTML = "";
    for (let h = 0; h <= 24; h++) {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = String(h).padStart(2, "0") + ":00";
      select.appendChild(opt);
    }
    select.value = selectedVal != null ? selectedVal : "";
  }

  function openGridSettings() {
    const gs = Store.activeSchedule().gridSettings || { days: [0, 1, 2, 3, 4, 5, 6], startHour: null, endHour: null, columns: null };
    state.gridDaysDraft = [...gs.days];

    const wrap = el("gridDayChecks");
    wrap.innerHTML = "";
    DAYS.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-check-btn" + (state.gridDaysDraft.includes(idx) ? " selected" : "");
      btn.textContent = name.split(" ")[0];
      btn.dataset.day = idx;
      btn.addEventListener("click", () => {
        const i = state.gridDaysDraft.indexOf(idx);
        if (i === -1) state.gridDaysDraft.push(idx);
        else if (state.gridDaysDraft.length > 1) state.gridDaysDraft.splice(i, 1);
        btn.classList.toggle("selected");
      });
      wrap.appendChild(btn);
    });

    populateHourSelect(el("gStartHour"), gs.startHour != null ? gs.startHour : 8);
    populateHourSelect(el("gEndHour"), gs.endHour != null ? gs.endHour : 18);
    el("gColumns").value = gs.columns != null ? gs.columns : "";

    showSheet("gridSettingsSheet");
  }

  function saveGridSettings() {
    const startHour = Number(el("gStartHour").value);
    const endHour = Number(el("gEndHour").value);
    if (endHour <= startHour) {
      toast("Bitiş saatı başlanğıcdan sonra olmalıdır");
      return;
    }
    const colsRaw = el("gColumns").value.trim();
    const columns = colsRaw ? Math.max(1, Math.min(24, Number(colsRaw))) : null;
    Store.setGridSettings({
      days: state.gridDaysDraft && state.gridDaysDraft.length ? state.gridDaysDraft : [0, 1, 2, 3, 4, 5, 6],
      startHour, endHour, columns
    });
    closeSheet("gridSettingsSheet");
    toast("Cədvəl düzəni yadda saxlanıldı");
    renderGrid();
  }

  function resetGridSettingsAuto() {
    Store.setGridSettings({ days: [0, 1, 2, 3, 4, 5, 6], startHour: null, endHour: null, columns: null });
    closeSheet("gridSettingsSheet");
    toast("Avtomatik düzənə qaytarıldı");
    renderGrid();
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function dayHeading(dayIdx) {
    const h = document.createElement("div");
    h.className = "day-heading";
    h.dataset.day = dayIdx;
    h.textContent = DAYS[dayIdx];
    return h;
  }

  // ---------- Tab switching ----------
  function switchTab(tab) {
    state.mainTab = tab;
    document.querySelectorAll(".bn-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    el("tabHome").hidden = tab !== "home";
    el("tabSchedule").hidden = tab !== "schedule";
    el("tabTasks").hidden = tab !== "tasks";
    el("tabStats").hidden = tab !== "stats";
    el("btnSearch").hidden = tab !== "schedule";
    el("btnAdd").hidden = tab === "stats";
    el("btnAdd").setAttribute("aria-label", tab === "tasks" ? "Tapşırıq əlavə et" : "Dərs əlavə et");
    if (tab === "home") renderHome();
    else if (tab === "schedule") render();
    else if (tab === "tasks") renderTasks();
    else if (tab === "stats") renderStats();
  }


  // ---------- Ana səhifə (Dashboard) ----------
  function todayIndex() {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }

  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function findNextLesson() {
    const today = todayIndex();
    const now = nowHHMM();
    const todays = Store.lessonsForDay(today).filter(l => l.start > now);
    if (todays.length) return { lesson: todays[0], daysAhead: 0 };
    for (let offset = 1; offset <= 7; offset++) {
      const dayIdx = (today + offset) % 7;
      const lessons = Store.lessonsForDay(dayIdx);
      if (lessons.length) return { lesson: lessons[0], daysAhead: offset };
    }
    return null;
  }

  function renderHome() {
    const today = todayIndex();
    const d = new Date();
    el("homeDate").textContent = d.toLocaleDateString("az-AZ", { day: "numeric", month: "long" }) + " · " + DAYS[today];

    // Növbəti dərs kartı
    const next = findNextLesson();
    const nextWrap = el("homeNextCard");
    if (next) {
      const l = next.lesson;
      let when;
      if (next.daysAhead === 0) {
        const diffMin = toMinutes(l.start) - toMinutes(nowHHMM());
        when = diffMin < 60 ? `${diffMin} dəq sonra` : `${Math.floor(diffMin / 60)} saat ${diffMin % 60} dəq sonra`;
      } else if (next.daysAhead === 1) {
        when = "Sabah";
      } else {
        when = DAYS[(today + next.daysAhead) % 7];
      }
      nextWrap.innerHTML = `
        <div class="home-next-card">
          <span class="hn-countdown">${when}</span>
          <div class="hn-tag">Növbəti dərs</div>
          <div class="hn-subject">${escapeHtml(l.subject)}</div>
          <div class="hn-meta">
            <span>⏰ ${l.start} – ${l.end}</span>
            ${l.room ? `<span>🏫 ${escapeHtml(l.room)}</span>` : ""}
          </div>
        </div>`;
    } else {
      nextWrap.innerHTML = `<div class="home-next-empty">Planlaşdırılan dərs yoxdur — "+" ilə əlavə et.</div>`;
    }

    // Bugünkü irəliləyiş (bugünə aid tapşırıqlar üzrə)
    const todayIso = new Date().toISOString().slice(0, 10);
    const todaysTasks = Store.activeSchedule().tasks.filter(t => t.dueDate === todayIso);
    const doneCount = todaysTasks.filter(t => t.done).length;
    const progWrap = el("homeProgress");
    if (todaysTasks.length) {
      const pct = Math.round((doneCount / todaysTasks.length) * 100);
      progWrap.hidden = false;
      progWrap.innerHTML = `
        <div class="hp-row"><span>Bugünkü tapşırıqlar</span><span>${doneCount}/${todaysTasks.length}</span></div>
        <div class="hp-track"><div class="hp-fill" style="width:${pct}%"></div></div>`;
    } else {
      progWrap.hidden = true;
      progWrap.innerHTML = "";
    }

    // Mini gün seçimi (Ana səhifədə "bugünkü dərslər" üçün)
    if (state.homeDay == null) state.homeDay = today;
    const tabs = el("homeDayTabs");
    tabs.innerHTML = "";
    DAYS.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.className = "daytab" + (idx === state.homeDay ? " active" : "");
      btn.textContent = name.split(" ")[0];
      btn.addEventListener("click", () => { state.homeDay = idx; renderHome(); });
      tabs.appendChild(btn);
    });

    // Seçilmiş günün dərsləri
    const list = el("homeTodayList");
    const empty = el("homeEmptyState");
    list.innerHTML = "";
    const lessons = Store.lessonsForDay(state.homeDay);
    if (!lessons.length) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      lessons.forEach(l => list.appendChild(lessonCard(l)));
    }
  }

  // ---------- Tasks / Exams ----------
  function taskCard(t) {
    const card = document.createElement("div");
    card.className = "task-card" + (t.overdue ? " overdue" : "") + (t.done ? " done" : "");
    card.innerHTML = `
      <button type="button" class="task-check" aria-label="Tamamlandı"></button>
      <div class="task-main">
        <div class="task-title"></div>
        <div class="task-meta"></div>
      </div>
      <span class="type-pill ${t.type === "imtahan" ? "exam" : "assignment"}">${t.type === "imtahan" ? "🎯 İmtahan" : "📝 Tapşırıq"}</span>
    `;
    card.querySelector(".task-title").textContent = t.title;
    const meta = [];
    if (t.subject) meta.push(t.subject);
    if (t.dueDate) meta.push((t.overdue ? "⚠️ Gecikib · " : "📅 ") + formatDate(t.dueDate));
    card.querySelector(".task-meta").textContent = meta.join(" · ");
    card.querySelector(".task-check").addEventListener("click", (ev) => {
      ev.stopPropagation();
      Store.toggleTask(t.id);
      renderTasks();
    });
    card.addEventListener("click", () => openTaskSheet(t));
    return card;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function renderTasks() {
    const list = el("taskList");
    const empty = el("taskEmptyState");
    list.innerHTML = "";
    const tasks = Store.tasksSorted(state.taskFilter);
    const stats = Store.taskStats();
    el("taskSummary").innerHTML = `
      <span>${stats.pending} aktiv</span>
      ${stats.overdue ? `<span class="summary-danger">${stats.overdue} gecikmiş</span>` : ""}
      <span>${stats.done} tamamlanıb</span>
    `;
    if (!tasks.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    tasks.forEach(t => list.appendChild(taskCard(t)));
  }

  function openTaskSheet(task) {
    state.editingTaskId = task ? task.id : null;
    el("taskSheetTitle").textContent = task ? "Tapşırığı redaktə et" : "Yeni tapşırıq";
    el("btnTaskDelete").hidden = !task;

    el("tTitle").value = task ? task.title : "";
    el("tSubject").value = task ? (task.subject || "") : "";
    el("tDueDate").value = task ? (task.dueDate || "") : new Date().toISOString().slice(0, 10);
    el("tNotes").value = task ? (task.notes || "") : "";

    state.selectedTaskType = task ? task.type : "tapşırıq";
    document.querySelectorAll("#taskTypeSeg .seg-btn").forEach(b =>
      b.classList.toggle("selected", b.dataset.type === state.selectedTaskType));

    showSheet("taskSheet");
  }

  function saveTaskForm(e) {
    e.preventDefault();
    const payload = {
      type: state.selectedTaskType,
      title: el("tTitle").value.trim(),
      subject: el("tSubject").value.trim(),
      dueDate: el("tDueDate").value,
      notes: el("tNotes").value.trim()
    };
    if (state.editingTaskId) {
      Store.updateTask(state.editingTaskId, payload);
      toast("Dəyişikliklər yadda saxlanıldı");
    } else {
      Store.addTask(payload);
      toast(payload.type === "imtahan" ? "İmtahan əlavə olundu" : "Tapşırıq əlavə olundu");
    }
    closeSheet("taskSheet");
    renderTasks();
  }

  function deleteTask() {
    if (!state.editingTaskId) return;
    if (!confirm("Bu qeydi silmək istədiyinə əminsən?")) return;
    Store.deleteTask(state.editingTaskId);
    toast("Silindi");
    closeSheet("taskSheet");
    renderTasks();
  }

  // ---------- Statistika ----------
  function renderStats() {
    const s = Store.scheduleStats();
    const t = Store.taskStats();

    el("statCards").innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:#7b6ff0">📘</div>
        <div class="stat-number">${s.totalLessons}</div>
        <div class="stat-label">Dərs</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#4f9d8d">⏱️</div>
        <div class="stat-number">${s.totalHours}</div>
        <div class="stat-label">Saat / həftə</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#e0a458">✅</div>
        <div class="stat-number">${t.done}</div>
        <div class="stat-label">Tamamlanmış</div>
      </div>
    `;

    const maxMin = Math.max(1, ...s.subjectBreakdown.map(x => x.minutes));
    el("subjectBars").innerHTML = s.subjectBreakdown.length
      ? s.subjectBreakdown.map((x, i) => `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(x.subject)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(x.minutes / maxMin) * 100}%; background:${COLORS[i % COLORS.length]}"></div></div>
          <span class="bar-value">${Math.round(x.minutes / 6) / 10}s</span>
        </div>`).join("")
      : `<p class="muted-hint">Hələ dərs əlavə etməmisən.</p>`;

    const maxCount = Math.max(1, ...s.perDayCount);
    el("dayBars").innerHTML = DAYS.map((name, idx) => `
      <div class="bar-row">
        <span class="bar-label">${name.split(" ")[0]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(s.perDayCount[idx] / maxCount) * 100}%; background:var(--teal)"></div></div>
        <span class="bar-value">${s.perDayCount[idx]}</span>
      </div>`).join("");
  }

  function renderColorPicker() {
    const wrap = el("colorPicker");
    wrap.innerHTML = "";
    COLORS.forEach(c => {
      const dot = document.createElement("div");
      dot.className = "color-dot";
      dot.style.background = c;
      dot.dataset.color = c;
      dot.addEventListener("click", () => {
        state.selectedColor = c;
        [...wrap.children].forEach(d => d.classList.toggle("selected", d.dataset.color === c));
      });
      wrap.appendChild(dot);
    });
  }

  function renderDayChecks(preselected) {
    const wrap = el("dayChecks");
    wrap.innerHTML = "";
    state.selectedDays = [...preselected];
    DAYS.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-check-btn" + (state.selectedDays.includes(idx) ? " selected" : "");
      btn.textContent = name.split(" ")[0];
      btn.dataset.day = idx;
      btn.addEventListener("click", () => {
        const i = state.selectedDays.indexOf(idx);
        if (i === -1) state.selectedDays.push(idx);
        else state.selectedDays.splice(i, 1);
        btn.classList.toggle("selected");
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- Lesson sheet ----------
  function openLessonSheet(lesson) {
    const daySel = el("fDay");
    daySel.innerHTML = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("");

    state.editingLessonId = lesson ? lesson.id : null;
    el("sheetTitle").textContent = lesson ? "Dərsi redaktə et" : "Yeni dərs";
    el("btnDelete").hidden = !lesson;

    if (lesson) {
      el("dayFieldSingle").hidden = false;
      el("dayFieldMulti").hidden = true;
      daySel.value = lesson.day;
    } else {
      el("dayFieldSingle").hidden = true;
      el("dayFieldMulti").hidden = false;
      renderDayChecks([state.activeDay]);
    }

    el("fSubject").value = lesson ? lesson.subject : "";
    el("fStart").value = lesson ? lesson.start : "09:00";
    el("fEnd").value = lesson ? lesson.end : "10:00";
    el("fTeacher").value = lesson ? (lesson.teacher || "") : "";
    el("fRoom").value = lesson ? (lesson.room || "") : "";
    el("fNotes").value = lesson ? (lesson.notes || "") : "";
    el("fReminder").checked = lesson ? !!lesson.reminder : false;

    state.selectedColor = lesson ? (lesson.color || COLORS[0]) : COLORS[Math.floor(Math.random() * COLORS.length)];
    [...el("colorPicker").children].forEach(d =>
      d.classList.toggle("selected", d.dataset.color === state.selectedColor));

    showSheet("lessonSheet");
  }

  function saveLessonForm(e) {
    e.preventDefault();
    const start = el("fStart").value;
    const end = el("fEnd").value;
    if (end <= start) {
      toast("Bitmə saatı başlanğıcdan sonra olmalıdır");
      return;
    }
    const base = {
      subject: el("fSubject").value.trim(),
      start, end,
      teacher: el("fTeacher").value.trim(),
      room: el("fRoom").value.trim(),
      notes: el("fNotes").value.trim(),
      color: state.selectedColor,
      reminder: el("fReminder").checked
    };

    if (state.editingLessonId) {
      const saved = Store.updateLesson(state.editingLessonId, { ...base, day: Number(el("fDay").value) });
      scheduleReminder(saved);
      toast("Dəyişikliklər yadda saxlanıldı");
    } else {
      const days = state.selectedDays && state.selectedDays.length ? state.selectedDays : [state.activeDay];
      days.forEach(d => {
        const saved = Store.addLesson({ ...base, day: d });
        scheduleReminder(saved);
      });
      toast(days.length > 1 ? `Dərs ${days.length} günə əlavə olundu` : "Dərs əlavə olundu");
    }
    closeSheet("lessonSheet");
    render();
  }

  function deleteLesson() {
    if (!state.editingLessonId) return;
    if (!confirm("Bu dərsi silmək istədiyinə əminsən?")) return;
    Store.deleteLesson(state.editingLessonId);
    toast("Dərs silindi");
    closeSheet("lessonSheet");
    render();
  }

  // ---------- Reminders ----------
  function scheduleReminder(lesson) {
    if (!window.LocalNotifications || !lesson.reminder) return;
    const [h, m] = lesson.start.split(":").map(Number);
    // Capacitor LocalNotifications: hər dərs günü üçün təkrarlanan bildiriş
    // (day: 1=Bazar ... cavab olaraq JS Date "getDay" ilə uyğunlaşdırılır)
    const jsWeekday = ((lesson.day + 1) % 7) + 1; // Store: 0=B.e -> Capacitor "weekday": 1=Bazar
    let minute = m - 15, hour = h;
    if (minute < 0) { minute += 60; hour = (hour + 23) % 24; }
    window.LocalNotifications.schedule({
      notifications: [{
        id: hashId(lesson.id),
        title: "Dərs xatırlatması",
        body: `${lesson.subject} — ${lesson.start} (${lesson.room || "otaq qeyd olunmayıb"})`,
        schedule: { on: { weekday: jsWeekday, hour, minute }, allowWhileIdle: true }
      }]
    }).catch(console.warn);
  }

  function hashId(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 2147483647;
  }

  // ---------- Sheets / drawer helpers (animated) ----------
  const TRANSITION_MS = 220;

  function showSheet(id) {
    const overlay = el("sheetOverlay");
    const sheet = el(id);
    overlay.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
      sheet.classList.add("open");
    });
  }
  function closeSheet(id) {
    const overlay = el("sheetOverlay");
    const sheet = el(id);
    sheet.classList.remove("open");
    overlay.classList.remove("visible");
    setTimeout(() => { sheet.hidden = true; overlay.hidden = true; }, TRANSITION_MS);
  }

  function openDrawer() {
    renderScheduleList();
    const overlay = el("drawerOverlay");
    const drawer = el("drawer");
    overlay.hidden = false;
    drawer.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
      drawer.classList.add("open");
    });
  }
  function closeDrawer() {
    const overlay = el("drawerOverlay");
    const drawer = el("drawer");
    drawer.classList.remove("open");
    overlay.classList.remove("visible");
    setTimeout(() => { drawer.hidden = true; overlay.hidden = true; }, TRANSITION_MS);
  }

  function renderScheduleList() {
    const list = el("scheduleList");
    list.innerHTML = "";
    Store.db.schedules.forEach(s => {
      const li = document.createElement("li");
      li.className = s.id === Store.db.activeScheduleId ? "active" : "";
      const label = document.createElement("span");
      label.textContent = s.name;
      label.style.flex = "1";
      label.addEventListener("click", () => {
        Store.setActiveSchedule(s.id);
        renderScheduleTitle();
        closeDrawer();
        render();
      });
      li.appendChild(label);

      const rename = document.createElement("button");
      rename.className = "rename";
      rename.textContent = "✏️";
      rename.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const name = prompt("Yeni ad:", s.name);
        if (name && name.trim()) {
          Store.renameSchedule(s.id, name.trim());
          renderScheduleList();
          renderScheduleTitle();
        }
      });
      li.appendChild(rename);

      if (Store.db.schedules.length > 1) {
        const del = document.createElement("button");
        del.className = "remove";
        del.textContent = "🗑️";
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (confirm(`"${s.name}" cədvəlini silmək istəyirsən?`)) {
            Store.removeSchedule(s.id);
            renderScheduleList();
            renderScheduleTitle();
            render();
          }
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    });
  }

  function addSchedulePrompt() {
    if (!Store.isPremium() && Store.db.schedules.length >= FREE_SCHEDULE_LIMIT + 1) {
      closeDrawer();
      showSheet("premiumSheet");
      renderPremiumStatus();
      toast("Əlavə cədvəllər üçün Premium lazımdır");
      return;
    }
    const name = prompt("Yeni cədvəlin adı:", "Yeni cədvəl");
    if (name && name.trim()) {
      Store.addSchedule(name.trim());
      renderScheduleList();
      renderScheduleTitle();
      render();
    }
  }

  // ---------- Export / Import ----------
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportJson() {
    downloadFile("cedvelim-ehtiyat.json", Store.exportJson(), "application/json");
    toast("JSON ehtiyat nüsxəsi endirildi");
  }

  function exportCsv() {
    downloadFile("cedvelim.csv", "\uFEFF" + Store.exportCsv(), "text/csv;charset=utf-8");
    toast("CSV faylı endirildi");
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJson(reader.result);
        applyTheme(Store.db.settings.theme);
        renderScheduleTitle();
        render();
        toast("Cədvəl bərpa olundu");
      } catch (e) {
        toast("Fayl oxuna bilmədi: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---------- Premium ----------
  function renderPremiumStatus() {
    el("premiumStatus").textContent = Store.isPremium()
      ? "✅ Premium aktivdir"
      : "Hazırda pulsuz versiyadasan.";
    el("btnBuyPremium").hidden = Store.isPremium();
  }

  async function buyPremium() {
    await Billing.buy();
    renderPremiumStatus();
    render();
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const t = el("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- Events ----------
  function bindEvents() {
    el("btnMenu").addEventListener("click", openDrawer);
    el("drawerOverlay").addEventListener("click", closeDrawer);
    el("btnNewSchedule").addEventListener("click", addSchedulePrompt);

    el("btnTheme").addEventListener("click", toggleTheme);

    el("btnSearch").addEventListener("click", () => {
      el("searchBar").hidden = false;
      el("searchInput").focus();
    });
    el("btnCloseSearch").addEventListener("click", () => {
      el("searchBar").hidden = true;
      el("searchInput").value = "";
      render();
    });
    el("searchInput").addEventListener("input", render);

    // Cədvəl görünüş çipləri (Həftəlik/Günlük/Cədvəl)
    document.querySelectorAll("#tabSchedule .viewswitch .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#tabSchedule .viewswitch .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.view = chip.dataset.view;
        renderScheduleTitle();
        render();
      });
    });

    // Tapşırıq filtri çipləri
    document.querySelectorAll("#tabTasks .viewswitch .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#tabTasks .viewswitch .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.taskFilter = chip.dataset.taskfilter;
        renderTasks();
      });
    });

    // Alt naviqasiya (Cədvəl / Tapşırıqlar / Statistika)
    document.querySelectorAll(".bn-item").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    el("btnAdd").addEventListener("click", () => {
      if (state.mainTab === "tasks") openTaskSheet(null);
      else openLessonSheet(null);
    });
    el("btnEmptyAdd").addEventListener("click", () => openLessonSheet(null));
    el("btnTaskEmptyAdd").addEventListener("click", () => openTaskSheet(null));

    el("lessonForm").addEventListener("submit", saveLessonForm);
    el("btnCancel").addEventListener("click", () => closeSheet("lessonSheet"));
    el("btnDelete").addEventListener("click", deleteLesson);

    el("taskForm").addEventListener("submit", saveTaskForm);
    el("btnTaskCancel").addEventListener("click", () => closeSheet("taskSheet"));
    el("btnTaskDelete").addEventListener("click", deleteTask);
    document.querySelectorAll("#taskTypeSeg .seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedTaskType = btn.dataset.type;
        document.querySelectorAll("#taskTypeSeg .seg-btn").forEach(b => b.classList.toggle("selected", b === btn));
      });
    });

    el("sheetOverlay").addEventListener("click", () => {
      closeSheet("lessonSheet");
      closeSheet("taskSheet");
      closeSheet("premiumSheet");
      closeSheet("gridSettingsSheet");
    });

    el("btnGridSettings").addEventListener("click", openGridSettings);
    el("btnGridSave").addEventListener("click", saveGridSettings);
    el("btnGridCancel").addEventListener("click", () => closeSheet("gridSettingsSheet"));
    el("btnGridAuto").addEventListener("click", resetGridSettingsAuto);

    el("btnExportJson").addEventListener("click", exportJson);
    el("btnExportCsv").addEventListener("click", exportCsv);
    el("btnImportJson").addEventListener("click", () => el("fileImport").click());
    el("fileImport").addEventListener("change", (e) => {
      if (e.target.files[0]) importJsonFile(e.target.files[0]);
      e.target.value = "";
    });

    el("btnPremium").addEventListener("click", () => {
      closeDrawer();
      renderPremiumStatus();
      showSheet("premiumSheet");
    });
    el("btnClosePremium").addEventListener("click", () => closeSheet("premiumSheet"));
    el("btnBuyPremium").addEventListener("click", buyPremium);
    el("btnRestorePremium").addEventListener("click", async () => {
      await Billing.restore();
      renderPremiumStatus();
    });
  }
})();
