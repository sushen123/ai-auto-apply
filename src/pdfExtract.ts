import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

// Set worker for pdfjs
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;

// Function to download the PDF from the given URL
async function downloadPdf(pdfUrl: string): Promise<Blob> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return await response.blob();
}

// Function to extract text from the PDF
async function extractTextFromPdf(pdfBlob: Blob): Promise<string> {
  const pdf = await getDocument({ data: await pdfBlob.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}

// Function to create a download link for the PDF
function downloadPdfFile(pdfBlob: Blob, fileName: string) {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Main function to handle the process
async function processPdf(pdfUrl: string) {
  try {
    // Step 1: Download the PDF
    const pdfBlob = await downloadPdf(pdfUrl);
    
    // Step 2: Extract the text from the PDF
    const extractedText = await extractTextFromPdf(pdfBlob);
    console.log('Extracted Text:', extractedText);
    
    // Step 3: Create a download link for the PDF
    downloadPdfFile(pdfBlob, 'resume.pdf');
  } catch (error) {
    console.error('Error processing PDF:', error);
  }
}

// Example usage
const cloudinaryPdfUrl = 'https://res.cloudinary.com/dv9ijnrfs/raw/upload/fl_attachment/v1/resume/file_rejdvx.pdf';
processPdf(cloudinaryPdfUrl);
