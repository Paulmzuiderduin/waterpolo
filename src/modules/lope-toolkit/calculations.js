export const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'excused'];

export const getAttendanceStats = (lesson, students = []) => {
  const stats = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: students.length
  };
  students.forEach((student) => {
    const status = lesson?.attendance?.[student.id] || 'present';
    if (stats[status] !== undefined) {
      stats[status] += 1;
    }
  });
  return stats;
};

export const getProgressAverage = (lesson, students = [], skills = []) => {
  if (!lesson || students.length === 0 || skills.length === 0) return 0;
  let sum = 0;
  let count = 0;
  students.forEach((student) => {
    const record = lesson.progress?.[student.id] || {};
    skills.forEach((skill) => {
      const value = Number(record[skill.id]);
      if (Number.isFinite(value) && value > 0) {
        sum += value;
        count += 1;
      }
    });
  });
  return count === 0 ? 0 : Number((sum / count).toFixed(2));
};

export const getWeekRange = (anchorDate) => {
  const date = new Date(anchorDate);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday,
    end: sunday
  };
};

export const isDateInRange = (dateString, range) => {
  const date = new Date(dateString);
  return date >= range.start && date <= range.end;
};

export const getLessonsForWeek = (lessons, weekStart) => {
  const range = getWeekRange(weekStart);
  return lessons.filter((lesson) => isDateInRange(lesson.date, range));
};
