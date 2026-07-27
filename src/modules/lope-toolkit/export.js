import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getLessonsForWeek } from './calculations';

const ATTENDANCE_LABELS = {
  present: 'Aanwezig',
  absent: 'Afwezig',
  late: 'Te laat',
  excused: 'Vrij'
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

export const generateWeeklyCsv = ({ weekStart, data }) => {
  const lessons = getLessonsForWeek(data.lessons, weekStart);
  const headers = [
    'Type',
    'Lesdatum',
    'Klas',
    'Leerling',
    'Aanwezigheid',
    'Notitie',
    'Vaardigheid',
    'Score',
    'Leerdoel',
    'Activiteit',
    'Materialen'
  ];

  const rows = [headers];

  lessons.forEach((lesson) => {
    const klass = data.classes.find((item) => item.id === lesson.classId);
    const className = klass?.name || 'Onbekend';

    rows.push([
      'LES',
      lesson.date,
      className,
      '',
      '',
      '',
      '',
      '',
      cleanText(lesson.learningGoal),
      cleanText(lesson.activity),
      cleanText(lesson.materials)
    ]);

    (klass?.students || []).forEach((student) => {
      const attendanceKey = lesson.attendance?.[student.id] || 'present';
      const attendance = ATTENDANCE_LABELS[attendanceKey] || attendanceKey;
      rows.push([
        'AANWEZIGHEID',
        lesson.date,
        className,
        cleanText(student.name),
        attendance,
        cleanText(lesson.quickNotes?.[student.id] || ''),
        '',
        '',
        '',
        '',
        ''
      ]);

      data.skills.forEach((skill) => {
        const score = lesson.progress?.[student.id]?.[skill.id] || '';
        if (!score) return;
        rows.push([
          'VOORTGANG',
          lesson.date,
          className,
          cleanText(student.name),
          '',
          '',
          cleanText(skill.label),
          score,
          '',
          '',
          ''
        ]);
      });
    });
  });

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = cleanText(cell);
          if (safe.includes(',') || safe.includes('"')) {
            return `"${safe.replace(/"/g, '""')}"`;
          }
          return safe;
        })
        .join(',')
    )
    .join('\n');
};

export const exportWeekAsCsv = ({ weekStart, data }) => {
  const csv = generateWeeklyCsv({ weekStart, data });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `weekoverzicht-${weekStart}.csv`);
};

export const exportWeekAsPdf = async ({ element, weekStart }) => {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#f6f3ee'
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 48;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let position = 24;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, 'PNG', 24, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position = heightLeft - imgHeight + 24;
    pdf.addImage(imgData, 'PNG', 24, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`weekoverzicht-${weekStart}.pdf`);
};
