import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  NotebookText,
  Plus,
  Users
} from 'lucide-react';
import SectionHeader from './components/SectionHeader';
import EmptyState from './components/EmptyState';
import StatPill from './components/StatPill';
import { createClass, createEmptyData, createLesson, createSampleData, createStudent } from './dataModel';
import { ATTENDANCE_STATUS, getAttendanceStats, getLessonsForWeek, getProgressAverage, getWeekRange } from './calculations';
import { exportWeekAsCsv, exportWeekAsPdf } from './export';
import { storage } from './storage';

const ATTENDANCE_LABELS = {
  present: 'Aanwezig',
  absent: 'Afwezig',
  late: 'Te laat',
  excused: 'Vrij'
};

const TABS = [
  { key: 'overview', label: 'Deze week', icon: CalendarDays },
  { key: 'lessons', label: 'Lesplanner', icon: ClipboardList },
  { key: 'classes', label: 'Klassen', icon: Users },
  { key: 'settings', label: 'Instellingen', icon: NotebookText }
];

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const formatWeekLabel = (range) => {
  const options = { day: '2-digit', month: 'short' };
  return `${range.start.toLocaleDateString('nl-NL', options)} - ${range.end.toLocaleDateString('nl-NL', options)}`;
};

const ToolkitApp = () => {
  const [data, setData] = useState(createEmptyData());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeClassId, setActiveClassId] = useState('');
  const [activeLessonId, setActiveLessonId] = useState('');
  const [weekAnchor, setWeekAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [lessonMode, setLessonMode] = useState('attendance');

  useEffect(() => {
    let mounted = true;
    storage.load().then((loaded) => {
      if (!mounted) return;
      setData(loaded);
      setLoading(false);
      setActiveClassId(loaded.classes[0]?.id || '');
      setActiveLessonId(loaded.lessons[0]?.id || '');
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    storage.save(data);
  }, [data, loading]);

  const showToast = (message, tone = 'default') => {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast(null);
    }, 2600);
  };

  const updateData = (updater) => {
    setData((prev) => {
      const next = clone(prev);
      updater(next);
      next.lastUpdated = new Date().toISOString();
      return next;
    });
  };

  const classes = data.classes;
  const lessons = data.lessons;
  const skills = data.skills;

  useEffect(() => {
    if (classes.length > 0 && !classes.find((item) => item.id === activeClassId)) {
      setActiveClassId(classes[0].id);
    }
  }, [classes, activeClassId]);

  useEffect(() => {
    if (lessons.length > 0 && !lessons.find((item) => item.id === activeLessonId)) {
      setActiveLessonId(lessons[0].id);
    }
  }, [lessons, activeLessonId]);

  const selectedClass = classes.find((item) => item.id === activeClassId) || null;
  const selectedLesson = lessons.find((item) => item.id === activeLessonId) || null;
  const weekRange = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const weekLessons = useMemo(() => getLessonsForWeek(lessons, weekAnchor), [lessons, weekAnchor]);

  const handleCreateClass = (name) => {
    updateData((draft) => {
      const klass = createClass(name);
      draft.classes.push(klass);
      setActiveClassId(klass.id);
    });
    showToast('Klas toegevoegd', 'success');
  };

  const handleCreateStudent = (classId, name) => {
    updateData((draft) => {
      const klass = draft.classes.find((item) => item.id === classId);
      if (!klass) return;
      klass.students.push(createStudent(name));
    });
    showToast('Leerling toegevoegd', 'success');
  };

  const handleCreateLesson = ({ classId, date }) => {
    if (!classId) {
      showToast('Maak eerst een klas aan.', 'warning');
      return;
    }
    updateData((draft) => {
      const lesson = createLesson({ classId, date });
      draft.lessons.push(lesson);
      setActiveLessonId(lesson.id);
      setActiveTab('lessons');
    });
    showToast('Les toegevoegd', 'success');
  };

  const handleDeleteLesson = (lessonId) => {
    if (!window.confirm('Weet je zeker dat je deze les wilt verwijderen?')) return;
    updateData((draft) => {
      draft.lessons = draft.lessons.filter((item) => item.id !== lessonId);
    });
    showToast('Les verwijderd', 'warning');
  };

  const handleDeleteClass = (classId) => {
    if (!window.confirm('Deze klas en alle lessen verwijderen?')) return;
    updateData((draft) => {
      draft.classes = draft.classes.filter((item) => item.id !== classId);
      draft.lessons = draft.lessons.filter((lesson) => lesson.classId !== classId);
    });
    showToast('Klas verwijderd', 'warning');
  };

  const handleExportPdf = async () => {
    const element = document.getElementById('export-preview');
    if (!element) {
      showToast('Geen exportweergave beschikbaar.', 'danger');
      return;
    }
    try {
      await exportWeekAsPdf({ element, weekStart: weekAnchor });
      showToast('PDF gedownload', 'success');
    } catch (error) {
      showToast('Export mislukt. Probeer het opnieuw.', 'danger');
    }
  };

  const handleExportCsv = () => {
    try {
      exportWeekAsCsv({ weekStart: weekAnchor, data });
      showToast('CSV gedownload', 'success');
    } catch (error) {
      showToast('CSV export mislukt.', 'danger');
    }
  };

  const handleMapPlacement = (lessonId, row, col) => {
    if (!selectedMaterial) {
      showToast('Kies eerst een materiaal.', 'warning');
      return;
    }
    updateData((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return;
      lesson.classroomMap.placements = lesson.classroomMap.placements.filter(
        (place) => !(place.row === row && place.col === col)
      );
      lesson.classroomMap.placements.push({
        id: `place_${crypto.randomUUID()}`,
        material: selectedMaterial,
        row,
        col
      });
      lesson.updatedAt = new Date().toISOString();
    });
  };

  const handleRemovePlacement = (lessonId, row, col) => {
    updateData((draft) => {
      const lesson = draft.lessons.find((item) => item.id === lessonId);
      if (!lesson) return;
      lesson.classroomMap.placements = lesson.classroomMap.placements.filter(
        (place) => !(place.row === row && place.col === col)
      );
      lesson.updatedAt = new Date().toISOString();
    });
  };

  const renderLessonList = () => {
    if (lessons.length === 0) {
      return (
        <EmptyState
          title="Nog geen lessen"
          description="Plan je eerste LO-les om direct aanwezigheden en voortgang vast te leggen."
          action={
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => handleCreateLesson({ classId: activeClassId || classes[0]?.id, date: weekAnchor })}
            >
              <Plus size={16} />
              Nieuwe les
            </button>
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {lessons
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((lesson) => {
            const klass = classes.find((item) => item.id === lesson.classId);
            const isActive = lesson.id === activeLessonId;
            const stats = getAttendanceStats(lesson, klass?.students || []);
            return (
              <button
                key={lesson.id}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-400'
                }`}
                onClick={() => {
                  setActiveLessonId(lesson.id);
                  if (lesson.classId) {
                    setActiveClassId(lesson.classId);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(lesson.date).toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </p>
                    <p className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>{klass?.name || 'Klas'}</p>
                  </div>
                  <div className="text-xs font-semibold">
                    {stats.present}/{stats.total} aanwezig
                  </div>
                </div>
                <p className={`mt-2 text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                  {lesson.learningGoal || 'Nog geen leerdoel'}
                </p>
              </button>
            );
          })}
      </div>
    );
  };

  const renderLessonEditor = () => {
    if (!selectedLesson || !selectedClass) {
      return (
        <EmptyState
          title="Selecteer een les"
          description="Kies een les om details, aanwezigheid en voortgang in te vullen."
        />
      );
    }

    const materialList = selectedLesson.materials
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const placementMap = new Map(
      selectedLesson.classroomMap.placements.map((place) => [`${place.row}_${place.col}`, place])
    );

    const attendanceStats = getAttendanceStats(selectedLesson, selectedClass.students);
    const progressAverage = getProgressAverage(selectedLesson, selectedClass.students, skills);

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <SectionHeader
            title="Lesdetails"
            subtitle="Werk direct tijdens de les bij. Alles wordt lokaal opgeslagen."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Datum
              <input
                type="date"
                value={selectedLesson.date}
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.date = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Klas
              <select
                value={selectedLesson.classId}
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.classId = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                    setActiveClassId(event.target.value);
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              Leerdoel
              <input
                type="text"
                value={selectedLesson.learningGoal}
                placeholder="Bijv. samenwerken in tweetallen"
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.learningGoal = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              Activiteit
              <input
                type="text"
                value={selectedLesson.activity}
                placeholder="Bijv. circuit met 4 stations"
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.activity = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Materialen
              <input
                type="text"
                value={selectedLesson.materials}
                placeholder="Bijv. pionnen, ballen, matten"
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.materials = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Differentiatie
              <input
                type="text"
                value={selectedLesson.differentiationNotes}
                placeholder="Bijv. extra uitdaging of vereenvoudiging"
                onChange={(event) =>
                  updateData((draft) => {
                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                    if (!lesson) return;
                    lesson.differentiationNotes = event.target.value;
                    lesson.updatedAt = new Date().toISOString();
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatPill label="Aanwezig" value={attendanceStats.present} tone="success" />
            <StatPill label="Afwezig" value={attendanceStats.absent} tone="danger" />
            <StatPill label="Te laat" value={attendanceStats.late} tone="warning" />
            <StatPill label="Gem. voortgang" value={progressAverage || '-'} tone="info" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <SectionHeader
            title="Plattegrond met materialen"
            subtitle="Kies een materiaal en tik op een vak om het te plaatsen."
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedMaterial}
              onChange={(event) => setSelectedMaterial(event.target.value)}
              className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecteer materiaal</option>
              {materialList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600"
              onClick={() => setSelectedMaterial('')}
              type="button"
            >
              Wissen
            </button>
          </div>
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedLesson.classroomMap.cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: selectedLesson.classroomMap.rows }).map((_, row) =>
              Array.from({ length: selectedLesson.classroomMap.cols }).map((__, col) => {
                const key = `${row}_${col}`;
                const placement = placementMap.get(key);
                return (
                  <button
                    key={key}
                    className="relative flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-500"
                    onClick={() => handleMapPlacement(selectedLesson.id, row, col)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      handleRemovePlacement(selectedLesson.id, row, col);
                    }}
                    type="button"
                  >
                    {placement ? (
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] uppercase text-white">
                        {placement.material.slice(0, 8)}
                      </span>
                    ) : (
                      'Leeg'
                    )}
                  </button>
                );
              })
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">Tip: rechtermuisklik of lang indrukken om een vak te legen.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <SectionHeader
            title="Snelle invoer"
            subtitle="Registreer aanwezigheid, voortgang en notities zonder zoeken."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    lessonMode === 'attendance'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 text-slate-600'
                  }`}
                  onClick={() => setLessonMode('attendance')}
                >
                  Aanwezigheid
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    lessonMode === 'progress'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 text-slate-600'
                  }`}
                  onClick={() => setLessonMode('progress')}
                >
                  Voortgang
                </button>
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    lessonMode === 'notes'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 text-slate-600'
                  }`}
                  onClick={() => setLessonMode('notes')}
                >
                  Notities
                </button>
              </div>
            }
          />
          <div className="mt-4 space-y-4">
            {selectedClass.students.length === 0 ? (
              <EmptyState
                title="Nog geen leerlingen"
                description="Voeg leerlingen toe aan deze klas om snelle invoer te gebruiken."
                action={
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => setActiveTab('classes')}
                  >
                    Naar klasbeheer
                  </button>
                }
              />
            ) : (
              selectedClass.students.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.notes || 'Geen notitie'}</p>
                  </div>
                  {lessonMode === 'attendance' ? (
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_STATUS.map((status) => (
                        <button
                          key={status}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            selectedLesson.attendance?.[student.id] === status
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-300 text-slate-600'
                          }`}
                          onClick={() =>
                            updateData((draft) => {
                              const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                              if (!lesson) return;
                              lesson.attendance[student.id] = status;
                              lesson.updatedAt = new Date().toISOString();
                            })
                          }
                        >
                          {ATTENDANCE_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {lessonMode === 'progress' ? (
                    <div className="flex flex-wrap gap-3">
                      {skills.map((skill) => (
                        <div key={skill.id} className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">{skill.label}</span>
                          <div className="flex rounded-full border border-slate-300">
                            {[1, 2, 3].map((score) => (
                              <button
                                key={score}
                                className={`px-2 py-1 text-xs font-semibold ${
                                  selectedLesson.progress?.[student.id]?.[skill.id] === score
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-500'
                                }`}
                                onClick={() =>
                                  updateData((draft) => {
                                    const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                                    if (!lesson) return;
                                    if (!lesson.progress[student.id]) {
                                      lesson.progress[student.id] = {};
                                    }
                                    lesson.progress[student.id][skill.id] = score;
                                    lesson.updatedAt = new Date().toISOString();
                                  })
                                }
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {lessonMode === 'notes' ? (
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:max-w-[320px]"
                      placeholder="Snelle notitie"
                      value={selectedLesson.quickNotes?.[student.id] || ''}
                      onChange={(event) =>
                        updateData((draft) => {
                          const lesson = draft.lessons.find((item) => item.id === selectedLesson.id);
                          if (!lesson) return;
                          lesson.quickNotes[student.id] = event.target.value;
                          lesson.updatedAt = new Date().toISOString();
                        })
                      }
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const weekLabel = formatWeekLabel(weekRange);
    return (
      <div className="space-y-6">
        {classes.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <SectionHeader title="Welkom bij LO/PE Docent Toolkit" subtitle="Start met een klas en plan je eerste les." />
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Maak een klas aan en voeg leerlingen toe.</li>
              <li>Plan een les met leerdoel en materialen.</li>
              <li>Registreer aanwezigheid en voortgang tijdens de les.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => handleCreateClass('Nieuwe klas')}
              >
                <Plus size={16} />
                Nieuwe klas
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                onClick={() => {
                  const sample = createSampleData();
                  setData(sample);
                  setActiveClassId(sample.classes[0].id);
                  setActiveLessonId(sample.lessons[0].id);
                  setActiveTab('lessons');
                }}
              >
                Voorbeelddata laden
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <SectionHeader
            title="Deze week"
            subtitle={`Overzicht van lessen en aanwezigheid (${weekLabel}).`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={weekAnchor}
                  onChange={(event) => setWeekAnchor(event.target.value)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => handleCreateLesson({ classId: activeClassId || classes[0]?.id, date: weekAnchor })}
                >
                  <Plus size={14} />
                  Nieuwe les
                </button>
              </div>
            }
          />
          <div className="mt-4 space-y-3">
            {weekLessons.length === 0 ? (
              <EmptyState
                title="Nog geen lessen gepland"
                description="Plan een les om direct je weekoverzicht te vullen."
                action={
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => handleCreateLesson({ classId: activeClassId || classes[0]?.id, date: weekAnchor })}
                  >
                    <Plus size={16} />
                    Les plannen
                  </button>
                }
              />
            ) : (
              weekLessons.map((lesson) => {
                const klass = classes.find((item) => item.id === lesson.classId);
                const stats = getAttendanceStats(lesson, klass?.students || []);
                return (
                  <div key={lesson.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {new Date(lesson.date).toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-xs text-slate-500">{klass?.name || 'Klas'} · {lesson.learningGoal || 'Geen leerdoel'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatPill label="Aanwezig" value={stats.present} tone="success" />
                        <StatPill label="Afwezig" value={stats.absent} tone="danger" />
                        <button
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          onClick={() => {
                            setActiveLessonId(lesson.id);
                            if (lesson.classId) {
                              setActiveClassId(lesson.classId);
                            }
                            setActiveTab('lessons');
                          }}
                        >
                          Open les
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <SectionHeader
            title="Weekexport"
            subtitle="Download een overzicht van lessen, aanwezigheid en voortgang."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={handleExportPdf}
                >
                  PDF export
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  onClick={handleExportCsv}
                >
                  CSV export
                </button>
              </div>
            }
          />
          <div id="export-preview" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Weekoverzicht</p>
                <p className="text-xs text-slate-500">{weekLabel}</p>
              </div>
              <p className="text-xs text-slate-400">LO/PE Docent Toolkit</p>
            </div>
            <div className="mt-4 space-y-3">
              {weekLessons.length === 0 ? (
                <p className="text-xs text-slate-500">Geen lessen ingepland.</p>
              ) : (
                weekLessons.map((lesson) => {
                  const klass = classes.find((item) => item.id === lesson.classId);
                  const stats = getAttendanceStats(lesson, klass?.students || []);
                  const average = getProgressAverage(lesson, klass?.students || [], skills);
                  return (
                    <div key={lesson.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-800">
                        {new Date(lesson.date).toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })}{' '}
                        · {klass?.name || 'Klas'}
                      </p>
                      <p className="text-[11px] text-slate-500">{lesson.learningGoal || 'Geen leerdoel'}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>Aanwezig: {stats.present}/{stats.total}</span>
                        <span>Gem. voortgang: {average || '-'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClasses = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <SectionHeader
            title="Klasbeheer"
            subtitle="Beheer klassen en leerlingen."
            actions={
              <button
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => handleCreateClass('Nieuwe klas')}
              >
                <Plus size={14} />
                Nieuwe klas
              </button>
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              {classes.length === 0 ? (
                <EmptyState
                  title="Nog geen klassen"
                  description="Maak een klas aan om leerlingen toe te voegen."
                />
              ) : (
                classes.map((klass) => (
                  <button
                    key={klass.id}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      klass.id === activeClassId
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    onClick={() => setActiveClassId(klass.id)}
                  >
                    <p className="text-sm font-semibold">{klass.name}</p>
                    <p className={`text-xs ${klass.id === activeClassId ? 'text-white/70' : 'text-slate-500'}`}>
                      {klass.students.length} leerlingen
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="space-y-4">
              {!selectedClass ? (
                <EmptyState
                  title="Selecteer een klas"
                  description="Kies een klas om leerlingen te beheren."
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedClass.name}</p>
                      <p className="text-xs text-slate-500">{selectedClass.students.length} leerlingen</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        onClick={() => handleCreateStudent(selectedClass.id, 'Nieuwe leerling')}
                      >
                        Leerling toevoegen
                      </button>
                      <button
                        className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600"
                        onClick={() => handleDeleteClass(selectedClass.id)}
                      >
                        Klas verwijderen
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {selectedClass.students.length === 0 ? (
                      <EmptyState
                        title="Nog geen leerlingen"
                        description="Voeg leerlingen toe om aanwezigheden en voortgang te registreren."
                      />
                    ) : (
                      selectedClass.students.map((student) => (
                        <div key={student.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <input
                              className="w-full max-w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              value={student.name}
                              onChange={(event) =>
                                updateData((draft) => {
                                  const klass = draft.classes.find((item) => item.id === selectedClass.id);
                                  if (!klass) return;
                                  const item = klass.students.find((entry) => entry.id === student.id);
                                  if (!item) return;
                                  item.name = event.target.value;
                                })
                              }
                            />
                            <button
                              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                              onClick={() =>
                                updateData((draft) => {
                                  const klass = draft.classes.find((item) => item.id === selectedClass.id);
                                  if (!klass) return;
                                  klass.students = klass.students.filter((entry) => entry.id !== student.id);
                                })
                              }
                            >
                              Verwijderen
                            </button>
                          </div>
                          <textarea
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Snelle notitie over deze leerling"
                            rows={2}
                            value={student.notes}
                            onChange={(event) =>
                              updateData((draft) => {
                                const klass = draft.classes.find((item) => item.id === selectedClass.id);
                                if (!klass) return;
                                const item = klass.students.find((entry) => entry.id === student.id);
                                if (!item) return;
                                item.notes = event.target.value;
                              })
                            }
                          />
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <SectionHeader title="Voortgangscategorieën" subtitle="Pas de 1-3 schaal aan voor jouw lesdoelen." />
          <div className="mt-4 space-y-3">
            {skills.map((skill) => (
              <div key={skill.id} className="flex flex-wrap items-center gap-3">
                <input
                  className="w-full max-w-[240px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={skill.label}
                  onChange={(event) =>
                    updateData((draft) => {
                      const item = draft.skills.find((entry) => entry.id === skill.id);
                      if (!item) return;
                      item.label = event.target.value;
                    })
                  }
                />
                <button
                  className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600"
                  onClick={() =>
                    updateData((draft) => {
                      draft.skills = draft.skills.filter((entry) => entry.id !== skill.id);
                    })
                  }
                >
                  Verwijderen
                </button>
              </div>
            ))}
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
              onClick={() =>
                updateData((draft) => {
                  draft.skills.push({ id: `skill_${crypto.randomUUID()}`, label: 'Nieuwe vaardigheid' });
                })
              }
            >
              Nieuwe vaardigheid
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <SectionHeader title="Opslag & reset" subtitle="Alles wordt lokaal opgeslagen in je browser." />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600"
              onClick={() => {
                if (!window.confirm('Alle lokale data verwijderen?')) return;
                storage.clear();
                setData(createEmptyData());
                setActiveClassId('');
                setActiveLessonId('');
                showToast('Lokale opslag gewist.', 'warning');
              }}
            >
              Reset data
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Toolkit laden...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pe-pattern text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">LO/PE Docent Toolkit</p>
            <h1 className="text-lg font-semibold">Praktisch lesbeheer in je broekzak</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
            <LayoutGrid size={14} />
            Lokaal opgeslagen · Supabase-ready
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 pt-6 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <nav className="space-y-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className={`flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6">
          {activeTab === 'overview' ? renderOverview() : null}
          {activeTab === 'lessons' ? (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-4">
                <SectionHeader
                  title="Lesplanner"
                  subtitle="Plan en selecteer lessen." 
                  actions={
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => handleCreateLesson({ classId: activeClassId || classes[0]?.id, date: weekAnchor })}
                    >
                      <Plus size={14} />
                      Nieuwe les
                    </button>
                  }
                />
                {renderLessonList()}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <GraduationCap size={16} />
                    Lesdetails
                  </div>
                  {selectedLesson ? (
                    <button
                      className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600"
                      onClick={() => handleDeleteLesson(selectedLesson.id)}
                    >
                      Les verwijderen
                    </button>
                  ) : null}
                </div>
                {renderLessonEditor()}
              </div>
            </div>
          ) : null}
          {activeTab === 'classes' ? renderClasses() : null}
          {activeTab === 'settings' ? renderSettings() : null}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-3 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold ${
                  isActive ? 'text-slate-900' : 'text-slate-500'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {toast ? (
        <div
          className={`fixed bottom-20 right-4 z-30 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg ${
            toast.tone === 'success'
              ? 'bg-emerald-600'
              : toast.tone === 'warning'
                ? 'bg-amber-600'
                : toast.tone === 'danger'
                  ? 'bg-rose-600'
                  : 'bg-slate-900'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};

export default ToolkitApp;
