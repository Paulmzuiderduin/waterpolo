export const DEFAULT_SKILLS = [
  { id: 'basis', label: 'Basisvaardigheid' },
  { id: 'motoriek', label: 'Motoriek' },
  { id: 'samenwerken', label: 'Samenwerken' }
];

export const createEmptyData = () => ({
  version: 1,
  classes: [],
  lessons: [],
  skills: DEFAULT_SKILLS,
  lastUpdated: new Date().toISOString()
});

export const createClass = (name) => ({
  id: `class_${crypto.randomUUID()}`,
  name: name?.trim() || 'Nieuwe klas',
  students: [],
  createdAt: new Date().toISOString()
});

export const createStudent = (name) => ({
  id: `student_${crypto.randomUUID()}`,
  name: name?.trim() || 'Nieuwe leerling',
  notes: '',
  createdAt: new Date().toISOString()
});

export const createLesson = ({ classId, date }) => ({
  id: `lesson_${crypto.randomUUID()}`,
  classId,
  date,
  learningGoal: '',
  activity: '',
  materials: '',
  differentiationNotes: '',
  classroomMap: {
    rows: 4,
    cols: 6,
    placements: []
  },
  attendance: {},
  progress: {},
  quickNotes: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const ensureDataShape = (raw) => {
  if (!raw || typeof raw !== 'object') return createEmptyData();
  const safe = {
    version: 1,
    classes: Array.isArray(raw.classes) ? raw.classes : [],
    lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    skills: Array.isArray(raw.skills) && raw.skills.length > 0 ? raw.skills : DEFAULT_SKILLS,
    lastUpdated: raw.lastUpdated || new Date().toISOString()
  };

  safe.classes = safe.classes.map((item) => ({
    id: item.id || `class_${crypto.randomUUID()}`,
    name: item.name || 'Onbekende klas',
    students: Array.isArray(item.students) ? item.students : [],
    createdAt: item.createdAt || new Date().toISOString()
  }));

  safe.classes = safe.classes.map((item) => ({
    ...item,
    students: item.students.map((student) => ({
      id: student.id || `student_${crypto.randomUUID()}`,
      name: student.name || 'Leerling',
      notes: student.notes || '',
      createdAt: student.createdAt || new Date().toISOString()
    }))
  }));

  safe.lessons = safe.lessons.map((lesson) => ({
    id: lesson.id || `lesson_${crypto.randomUUID()}`,
    classId: lesson.classId || safe.classes[0]?.id || '',
    date: lesson.date || new Date().toISOString().slice(0, 10),
    learningGoal: lesson.learningGoal || '',
    activity: lesson.activity || '',
    materials: lesson.materials || '',
    differentiationNotes: lesson.differentiationNotes || '',
    classroomMap: {
      rows: lesson.classroomMap?.rows || 4,
      cols: lesson.classroomMap?.cols || 6,
      placements: Array.isArray(lesson.classroomMap?.placements) ? lesson.classroomMap.placements : []
    },
    attendance: lesson.attendance || {},
    progress: lesson.progress || {},
    quickNotes: lesson.quickNotes || {},
    createdAt: lesson.createdAt || new Date().toISOString(),
    updatedAt: lesson.updatedAt || new Date().toISOString()
  }));

  return safe;
};

export const createSampleData = () => {
  const klas = createClass('LO/PE 2A');
  klas.students = [
    createStudent('Mila'),
    createStudent('Sam'),
    createStudent('Youssef'),
    createStudent('Noa'),
    createStudent('Finn')
  ];

  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const les = createLesson({ classId: klas.id, date });
  les.learningGoal = 'Basisbalvaardigheden in tweetallen.';
  les.activity = 'Circuit met dribbelen, passen en mikken.';
  les.materials = 'Basketballen, pionnen, scoreborden.';
  les.differentiationNotes = 'Kleinere ballen voor starters, extra uitdaging met tijdsdruk.';
  les.classroomMap.placements = [
    { id: `place_${crypto.randomUUID()}`, material: 'Basketballen', row: 1, col: 2 },
    { id: `place_${crypto.randomUUID()}`, material: 'Pionnen', row: 2, col: 4 }
  ];

  return {
    version: 1,
    classes: [klas],
    lessons: [les],
    skills: DEFAULT_SKILLS,
    lastUpdated: new Date().toISOString()
  };
};
