import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FullSubmission, SubmissionPhoto } from '../types/database';

// Extended response type with joined labels
interface ResponseWithLabels {
  id: string;
  submission_id: string;
  checklist_item_id: string;
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  value_image_url: string | null;
  item_label: string;
  section_name: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatResponseValue(r: ResponseWithLabels): string {
  if (r.value_boolean !== null) return r.value_boolean ? 'Yes' : 'No';
  if (r.value_text !== null) return r.value_text;
  if (r.value_number !== null) return String(r.value_number);
  return '—';
}

/**
 * Load an image URL as a base64 data URL for embedding in the PDF.
 * Returns null if the image fails to load.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generate a PDF report for a submission and trigger browser download.
 */
export async function generateSubmissionPdf(
  submission: FullSubmission & { responses: ResponseWithLabels[] },
  onProgress?: (msg: string) => void
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Helper: check if we need a new page ──
  const checkPage = (needed: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Inspection Report', margin, y + 6);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Greythorn Contract Logistics', margin, y + 4);
  doc.text(`Report generated: ${formatDate(new Date().toISOString())}`, pageWidth - margin, y + 4, { align: 'right' });
  y += 8;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  // ── Vehicle & Driver Info Table ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle & Driver Information', margin, y + 4);
  y += 8;

  const infoRows = [
    ['Vehicle Registration', submission.vehicle_registration],
    ['Mileage', submission.mileage != null ? submission.mileage.toLocaleString() : '—'],
    ['Make & Model', submission.make_model ?? '—'],
    ['Colour', submission.colour ?? '—'],
    ['Contractor ID', submission.contractor_id ?? '—'],
    ['Contractor Name', submission.contractor_name ?? '—'],
    ['Site', submission.site_code ?? '—'],
    ['Location', submission.latitude != null && submission.longitude != null
      ? `${submission.latitude.toFixed(6)}, ${submission.longitude.toFixed(6)}`
      : '—'],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: infoRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] },
      1: { cellWidth: contentWidth - 45 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Timeline ──
  checkPage(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Timeline', margin, y + 4);
  y += 8;

  const timeRows = [
    ['Form Started', formatDate(submission.ts_form_started)],
    ['Form Reviewed', formatDate(submission.ts_form_reviewed)],
    ['Form Submitted', formatDate(submission.ts_form_submitted)],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: timeRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] },
      1: { cellWidth: contentWidth - 45 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Checklist Responses ──
  const responses = submission.responses as ResponseWithLabels[];
  if (responses.length > 0) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Checklist Responses', margin, y + 4);
    y += 8;

    // Group by section
    const sections = new Map<string, ResponseWithLabels[]>();
    responses.forEach((r) => {
      const name = r.section_name || 'General';
      if (!sections.has(name)) sections.set(name, []);
      sections.get(name)!.push(r);
    });

    for (const [sectionName, items] of sections) {
      checkPage(15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(sectionName, margin, y + 4);
      y += 6;
      doc.setTextColor(0, 0, 0);

      const responseRows = items.map((r) => {
        const value = formatResponseValue(r);
        // Determine if this is a fail
        const isFail = r.value_boolean === false;
        return [r.item_label, value, isFail];
      });

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Response']],
        body: responseRows.map(([label, value]) => [label, value]),
        theme: 'striped',
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [55, 65, 81], fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.7 },
          1: { cellWidth: contentWidth * 0.3, halign: 'center' },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          // Highlight fail values in red
          if (data.section === 'body' && data.column.index === 1) {
            const rowData = responseRows[data.row.index];
            if (rowData && rowData[2]) {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }
  }

  // ── Defects ──
  if (submission.defects.length > 0) {
    checkPage(20);
    y += 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`Defects (${submission.defects.length})`, margin, y + 4);
    y += 8;
    doc.setTextColor(0, 0, 0);

    for (const defect of submission.defects) {
      checkPage(40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Defect #${defect.defect_number}`, margin, y + 4);
      y += 6;

      if (defect.details) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(defect.details, contentWidth);
        doc.text(lines, margin, y + 3);
        y += lines.length * 4 + 4;
      }

      if (defect.image_url) {
        onProgress?.('Loading defect image…');
        const imgData = await loadImageAsBase64(defect.image_url);
        if (imgData) {
          checkPage(55);
          try {
            doc.addImage(imgData, 'JPEG', margin, y, 50, 37.5);
            y += 40;
          } catch {
            // skip if image can't be embedded
          }
        }
      }
      y += 4;
    }
  }

  // ── Vehicle Photos ──
  if (submission.photos.length > 0) {
    onProgress?.('Loading vehicle photos…');
    checkPage(20);
    y += 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Vehicle Photos (${submission.photos.length})`, margin, y + 4);
    y += 10;

    // Load all photos in parallel
    const photoEntries: { photo: SubmissionPhoto; data: string }[] = [];
    const loadPromises = submission.photos.map(async (photo) => {
      onProgress?.(`Loading ${photo.photo_type.replace(/_/g, ' ')}…`);
      const data = await loadImageAsBase64(photo.storage_url);
      if (data) {
        photoEntries.push({ photo, data });
      }
    });
    await Promise.all(loadPromises);

    // Sort to match original order
    const photoOrder = submission.photos.map((p) => p.id);
    photoEntries.sort((a, b) => photoOrder.indexOf(a.photo.id) - photoOrder.indexOf(b.photo.id));

    // Layout: 2 columns, 3 rows per page
    const imgW = (contentWidth - 6) / 2;
    const imgH = imgW * 0.75;
    let col = 0;

    for (const entry of photoEntries) {
      checkPage(imgH + 12);
      const x = margin + col * (imgW + 6);

      try {
        doc.addImage(entry.data, 'JPEG', x, y, imgW, imgH);
      } catch {
        // skip unembeddable images
      }

      // Label below image
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const label = entry.photo.photo_type.replace(/_/g, ' ');
      doc.text(label, x + imgW / 2, y + imgH + 4, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      col++;
      if (col >= 2) {
        col = 0;
        y += imgH + 10;
      }
    }

    // If we ended on the first column, advance y
    if (col === 1) {
      y += imgH + 10;
    }
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Cheklistr — ${submission.vehicle_registration} — ${formatDate(submission.ts_form_submitted)}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // ── Save ──
  const dateStr = submission.ts_form_submitted
    ? new Date(submission.ts_form_submitted).toISOString().slice(0, 10)
    : 'draft';
  const filename = `inspection_${submission.vehicle_registration}_${dateStr}.pdf`;
  doc.save(filename);
}
