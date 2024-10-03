

export async function createPDFFromURL(url: string): Promise<Blob> {
    try {
        const response = await fetch(url);
        const pdfData = await response.blob();
        return pdfData;
    } catch (error) {
        console.error('Error creating PDF from URL:', error);
        throw error;
    }
}