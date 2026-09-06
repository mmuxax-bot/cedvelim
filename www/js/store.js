/* store.js
 * Bütün məlumatların saxlanması: localStorage üzərində, tam offline.
 * Data strukturu:
 * {
 *   activeScheduleId: "sch_xxx",
 *   schedules: [
 *     { id, name, lessons: [ {id, day, subject, start, end, teacher, room, notes, color, reminder} ] }
 *   ],
 *   settings: { theme: "light"|"dark", premium: bool }
 * }
 */

const DB_KEY = "cedvelim_db_v1";

const DAYS = [
  "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə",
  "Cümə axşamı", "Cümə", "Şənbə", "Bazar"
];

const COLORS = [
  "#e0a458", "#4f9d8d", "#7b6ff0", "#c1503f",
  "#3f8fc1", "#8fa845", "#c15f9d", "#6b6f8a"
];

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultDb() {
  const schId = uid("sch");
  return {
    activeScheduleId: schId,
    schedules: [{ id: schId, name: "Əsas cədvəl", lessons: [] }],
    settings: { theme: "light", premium: false }
  };
}

const Store = {
  db: null,

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      this.db = raw ? JSON.parse(raw) : defaultDb();
      if (!this.db.schedules || !this.db.schedules.length) this.db = defaultDb();
    } catch (e) {
      console.warn("Cədvəl oxunarkən xəta, yeni baza yaradılır:", e);
      this.db = defaultDb();
    }
    return this.db;
  },

  save() {
    // Avtomatik yadda saxlama — hər dəyişiklikdən sonra çağırılır
    localStorage.setItem(DB_KEY, JSON.stringify(this.db));
  },

  activeSchedule() {
    return this.db.schedules.find(s => s.id === this.db.activeScheduleId) || this.db.schedules[0];
  },

  addSchedule(name) {
    const s = { id: uid("sch"), name: name || "Yeni cədvəl", lessons: [] };
    this.db.schedules.push(s);
    this.db.activeScheduleId = s.id;
    this.save();
    return s;
  },

  renameSchedule(id, name) {
    const s = this.db.schedules.find(x => x.id === id);
    if (s) { s.name = name; this.save(); }
  },

  removeSchedule(id) {
    if (this.db.schedules.length <= 1) return false;
    this.db.schedules = this.db.schedules.filter(s => s.id !== id);
    if (this.db.activeScheduleId === id) {
      this.db.activeScheduleId = this.db.schedules[0].id;
    }
    this.save();
    return true;
  },

  setActiveSchedule(id) {
    this.db.activeScheduleId = id;
    this.save();
  },

  addLesson(lesson) {
    const sch = this.activeSchedule();
    lesson.id = uid("les");
    sch.lessons.push(lesson);
    this.save();
    return lesson;
  },

  updateLesson(id, patch) {
    const sch = this.activeSchedule();
    const l = sch.lessons.find(x => x.id === id);
    if (l) { Object.assign(l, patch); this.save(); }
    return l;
  },

  deleteLesson(id) {
    const sch = this.activeSchedule();
    sch.lessons = sch.lessons.filter(x => x.id !== id);
    this.save();
  },

  lessonsForDay(dayIndex) {
    return this.activeSchedule().lessons
      .filter(l => l.day === dayIndex)
      .sort((a, b) => a.start.localeCompare(b.start));
  },

  allLessonsGrouped() {
    return DAYS.map((name, idx) => ({
      day: idx,
      name,
      lessons: this.lessonsForDay(idx)
    }));
  },

  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.activeSchedule().lessons
      .filter(l =>
        (l.subject || "").toLowerCase().includes(q) ||
        (l.teacher || "").toLowerCase().includes(q) ||
        (l.room || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  },

  setTheme(theme) {
    this.db.settings.theme = theme;
    this.save();
  },

  setPremium(val) {
    this.db.settings.premium = !!val;
    this.save();
  },

  isPremium() {
    return !!this.db.settings.premium;
  },

  // ---------- JSON backup / restore ----------
  exportJson() {
    return JSON.stringify(this.db, null, 2);
  },

  importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.schedules)) {
      throw new Error("Fayl formatı düzgün deyil");
    }
    this.db = parsed;
    this.save();
    return this.db;
  },

  // ---------- CSV export ----------
  exportCsv() {
    const header = ["Gün", "Başlanğıc", "Bitmə", "Fənn", "Müəllim", "Otaq", "Qeydlər"];
    const rows = [header];
    this.allLessonsGrouped().forEach(group => {
      group.lessons.forEach(l => {
        rows.push([
          group.name, l.start, l.end, l.subject || "",
          l.teacher || "", l.room || "", (l.notes || "").replace(/\n/g, " ")
        ]);
      });
    });
    return rows.map(r =>
      r.map(cell => {
        const v = String(cell ?? "");
        return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(";")
    ).join("\r\n");
  }
};
