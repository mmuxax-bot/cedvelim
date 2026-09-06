/* app.js — UI qatı */
(function () {
  "use strict";

  const FREE_SCHEDULE_LIMIT = 1; // Premium olmadan icazə verilən cədvəl sayı

  let state = {
    view: "week",       // "week" | "day"
    activeDay: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, // Bazar ertəsi=0
    editingLessonId: null,
    selectedColor: null
  };

  const el = (id) => document.getElementById(id);

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
    el("scheduleSubtitle").textContent = state.view === "week" ? "Bütün həftə" : DAYS[state.activeDay];
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
    card.innerHTML = `
      <div class="lesson-color" style="background:${l.color || "#4f9d8d"}"></div>
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
    list.innerHTML = "";

    const query = el("searchInput").value.trim();
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

  function dayHeading(dayIdx) {
    const h = document.createElement("div");
    h.className = "day-heading";
    h.dataset.day = dayIdx;
    h.textContent = DAYS[dayIdx];
    return h;
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

  // ---------- Lesson sheet ----------
  function openLessonSheet(lesson) {
    const daySel = el("fDay");
    daySel.innerHTML = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("");

    state.editingLessonId = lesson ? lesson.id : null;
    el("sheetTitle").textContent = lesson ? "Dərsi redaktə et" : "Yeni dərs";
    el("btnDelete").hidden = !lesson;

    el("fSubject").value = lesson ? lesson.subject : "";
    el("fDay").value = lesson ? lesson.day : state.activeDay;
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
    const payload = {
      subject: el("fSubject").value.trim(),
      day: Number(el("fDay").value),
      start, end,
      teacher: el("fTeacher").value.trim(),
      room: el("fRoom").value.trim(),
      notes: el("fNotes").value.trim(),
      color: state.selectedColor,
      reminder: el("fReminder").checked
    };
    let saved;
    if (state.editingLessonId) {
      saved = Store.updateLesson(state.editingLessonId, payload);
      toast("Dəyişikliklər yadda saxlanıldı");
    } else {
      saved = Store.addLesson(payload);
      toast("Dərs əlavə olundu");
    }
    scheduleReminder(saved);
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

  // ---------- Sheets / drawer helpers ----------
  function showSheet(id) {
    el(id === "lessonSheet" ? "sheetOverlay" : "sheetOverlay").hidden = false;
    el(id).hidden = false;
  }
  function closeSheet(id) {
    el("sheetOverlay").hidden = true;
    el(id).hidden = true;
  }

  function openDrawer() {
    renderScheduleList();
    el("drawerOverlay").hidden = false;
    el("drawer").hidden = false;
  }
  function closeDrawer() {
    el("drawerOverlay").hidden = true;
    el("drawer").hidden = true;
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

    document.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.view = chip.dataset.view;
        el("dayTabs").style.display = state.view === "day" ? "flex" : "flex";
        renderScheduleTitle();
        render();
      });
    });

    el("btnAdd").addEventListener("click", () => openLessonSheet(null));
    el("btnEmptyAdd").addEventListener("click", () => openLessonSheet(null));
    el("lessonForm").addEventListener("submit", saveLessonForm);
    el("btnCancel").addEventListener("click", () => closeSheet("lessonSheet"));
    el("btnDelete").addEventListener("click", deleteLesson);
    el("sheetOverlay").addEventListener("click", () => {
      closeSheet("lessonSheet");
      closeSheet("premiumSheet");
    });

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
