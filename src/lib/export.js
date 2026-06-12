import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Exporta um relatório em PDF com uma ou mais tabelas.
// sections: [{ title, columns: ['A','B'], rows: [[..],[..]] }]
export const exportPDF = ({ filename, title, subtitle = '', sections = [] }) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(120);
  doc.text(subtitle || `Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);
  doc.setTextColor(0);

  let y = 30;
  for (const sec of sections) {
    if (sec.title) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(sec.title, 14, y);
      y += 4;
    }
    autoTable(doc, {
      startY: y,
      head: [sec.columns],
      body: sec.rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
    y = (doc.lastAutoTable?.finalY || y) + 12;
    if (y > 260 && sections.indexOf(sec) < sections.length - 1) {
      doc.addPage();
      y = 16;
    }
  }
  doc.save(`${filename}.pdf`);
};

// Exporta planilha Excel com uma ou mais abas.
// sheets: [{ name, columns: ['A','B'], rows: [[..],[..]] }]
export const exportExcel = ({ filename, sheets = [] }) => {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.columns, ...sheet.rows]);
    ws['!cols'] = sheet.columns.map((c, i) => ({
      wch: Math.max(
        String(c).length + 2,
        ...sheet.rows.map((r) => String(r[i] ?? '').length + 2),
        10
      ),
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// Backup completo dos dados em JSON
export const exportJSON = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
