import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getBrasiliaFormattedDateTime } from './dateUtils';

export interface FilterInfo {
  dataInicial?: string;
  dataFinal?: string;
  produto?: string;
  status?: string;
  supervisor?: string;
  operador?: string;
  responsavel?: string;
  impacto?: string;
  busca?: string;
}

export async function exportDashboardToPDF(
  containerElement: HTMLElement,
  title: string,
  fileName: string,
  filters?: FilterInfo
): Promise<void> {
  if (!containerElement) {
    throw new Error('Elemento de destino dos gráficos não encontrado.');
  }

  // Format current date and time
  const now = new Date();
  const formattedDate = getBrasiliaFormattedDateTime(now);

  // Format active filters text
  const filterList: string[] = [];
  if (filters?.dataInicial) filterList.push(`Data Inicial: ${filters.dataInicial}`);
  if (filters?.dataFinal) filterList.push(`Data Final: ${filters.dataFinal}`);
  if (filters?.produto && filters.produto !== 'Todos') filterList.push(`Produto: ${filters.produto}`);
  if (filters?.status && filters.status !== 'Todos') filterList.push(`Status: ${filters.status}`);
  if (filters?.supervisor && filters.supervisor !== 'Todos') filterList.push(`Supervisor: ${filters.supervisor}`);
  if (filters?.responsavel && filters.responsavel !== 'Todos') filterList.push(`Responsável: ${filters.responsavel}`);
  if (filters?.operador) filterList.push(`Operador: ${filters.operador}`);
  if (filters?.impacto && filters.impacto !== 'Todos') filterList.push(`Impacto: ${filters.impacto}`);
  if (filters?.busca) filterList.push(`Busca: "${filters.busca}"`);

  const filterSummary = filterList.length > 0 ? filterList.join(' | ') : 'Nenhum filtro específico aplicado (Todos os registros)';

  // Create temporary header element to prepend into live container
  const headerDiv = document.createElement('div');
  headerDiv.id = 'pdf-export-header-temp';
  headerDiv.style.backgroundColor = '#ffffff';
  headerDiv.style.padding = '16px 20px 20px 20px';
  headerDiv.style.marginBottom = '20px';
  headerDiv.style.borderBottom = '2px solid #2563eb';
  headerDiv.style.borderRadius = '12px 12px 0 0';
  headerDiv.style.fontFamily = 'sans-serif';

  headerDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; line-height: 1.2;">${title}</h1>
        <p style="font-size: 12px; color: #64748b; margin: 0;">Relatório Analítico de Gráficos e Métricas Filtradas</p>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #2563eb; background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px;">
          GERADO EM: ${formattedDate}
        </span>
      </div>
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #334155;">
      <strong>Filtros Aplicados:</strong> ${filterSummary}
    </div>
  `;

  // Prepend temporary header to live container
  containerElement.prepend(headerDiv);

  try {
    // Brief delay to ensure DOM update
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Convert container element to PNG data URL using html-to-image
    const dataUrl = await toPng(containerElement, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: 2,
    });

    // Create an Image object to measure real pixel dimensions
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Initialize A4 PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margin = 10; // 10mm margins
    const printableWidth = pdfWidth - margin * 2;
    const printableHeight = pdfHeight - margin * 2;

    const imgWidth = printableWidth;
    const imgHeight = (img.height * printableWidth) / img.width;

    let heightLeft = imgHeight;
    let position = margin;

    // Page 1
    pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printableHeight;

    // Subsequent pages if long
    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printableHeight;
    }

    pdf.save(fileName);
  } finally {
    // Always clean up the temporary header element
    if (headerDiv.parentNode) {
      headerDiv.parentNode.removeChild(headerDiv);
    }
  }
}
