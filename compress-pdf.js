document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameDisplay = document.getElementById('fileName');
    const fileSizeDisplay = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const compressionOptions = document.getElementById('compressionOptions');
    const compressBtn = document.getElementById('compressBtn');
    const downloadSection = document.getElementById('downloadSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    const savingPercentDisplay = document.getElementById('savingPercent');
    const options = document.querySelectorAll('.compression-option');

    let currentFile = null;
    let selectedLevel = null;
    let compressedPdfBytes = null;

    // --- Configurations ---
    const COMPRESSION_CONFIG = {
        'extreme': { scale: 0.6, quality: 0.5 },    // ~50% Reduction: Low res, aggressive compression
        'recommended': { scale: 1.0, quality: 0.6 }, // ~30% Reduction: Standard res, balance
        'low': { scale: 1.5, quality: 0.6 }          // ~15% Reduction: High res (sharp), lower JPG quality
    };

    // --- Drag & Drop & File Selection ---

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-red-500', 'bg-slate-800/50');
    });

    ['dragleave', 'dragend', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, () => {
            dropZone.classList.remove('border-red-500', 'bg-slate-800/50');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Por favor, sube un archivo PDF válido.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = formatBytes(file.size);

        // Show info, hide drop
        dropZone.classList.add('hidden');
        fileInfo.classList.remove('hidden');

        // Show options
        compressionOptions.classList.remove('hidden');
    }

    removeFileBtn.addEventListener('click', () => {
        resetState();
    });

    function resetState() {
        currentFile = null;
        selectedLevel = null;
        compressedPdfBytes = null;
        fileInput.value = '';

        dropZone.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        compressionOptions.classList.add('hidden');
        downloadSection.classList.add('hidden');

        // Reset options selection
        options.forEach(opt => {
            opt.classList.remove('selected');
            opt.querySelector('.check-icon').classList.add('hidden');
        });

        compressBtn.disabled = true;
        compressBtn.classList.add('bg-slate-800', 'text-slate-500');
        compressBtn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600', 'hover:scale-105');
        compressBtn.innerHTML = '<span>⚡</span> Comprimir PDF';
    }

    // --- Compression Options Selection ---

    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(opt => {
                opt.classList.remove('selected');
                opt.querySelector('.check-icon').classList.add('hidden');
            });

            option.classList.add('selected');
            option.querySelector('.check-icon').classList.remove('hidden');

            selectedLevel = option.dataset.level;

            compressBtn.disabled = false;
            compressBtn.classList.remove('bg-slate-800', 'text-slate-500');
            compressBtn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600', 'hover:scale-105');
        });
    });

    // --- Real Composition Logic (Rasterization) ---

    compressBtn.addEventListener('click', async () => {
        if (!currentFile || !selectedLevel) return;

        compressBtn.disabled = true;
        compressBtn.innerHTML = '<span>⏳</span> Iniciando...';

        try {
            await processPdfReal(currentFile, COMPRESSION_CONFIG[selectedLevel]);
        } catch (error) {
            console.error("Compression Error:", error);
            alert('Hubo un error al procesar el PDF. Asegúrate de que el archivo no esté encriptado.');
            compressBtn.innerHTML = '<span>⚡</span> Comprimir PDF';
            compressBtn.disabled = false;
        }
    });

    async function processPdfReal(file, config) {
        // 1. Load the document using PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        // 2. Create a new PDF using PDF-Lib
        const { PDFDocument } = PDFLib;
        const newPdf = await PDFDocument.create();

        // 3. Process each page
        for (let i = 1; i <= totalPages; i++) {
            // Update UI Progress
            const progress = Math.round((i / totalPages) * 100);
            compressBtn.innerHTML = `<span>⏳</span> Procesando pág. ${i} de ${totalPages} (${progress}%)`;

            // Get Page
            const page = await pdf.getPage(i);

            // Render to Canvas
            // We use the configured scale (1.0 for extreme, 2.0 for low)
            const viewport = page.getViewport({ scale: config.scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Convert to JPEG with configured quality
            const imageUrl = canvas.toDataURL('image/jpeg', config.quality);

            // Embed JPG into new PDF
            const jpgImage = await newPdf.embedJpg(imageUrl);
            const jpgDims = jpgImage.scale(1 / config.scale); // Scale back to original PDF size units

            // Add page to new PDF matching the original dimensions
            const newPage = newPdf.addPage([jpgDims.width, jpgDims.height]);
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: jpgDims.width,
                height: jpgDims.height,
            });
        }

        compressBtn.innerHTML = '<span>💾</span> Generando archivo...';

        // 4. Save
        compressedPdfBytes = await newPdf.save();

        // 5. Calculate results
        const originalSize = file.size;
        const newSize = compressedPdfBytes.byteLength;
        const savings = originalSize - newSize;
        const savingsPercent = Math.round((savings / originalSize) * 100);

        // UI Feedback
        compressionOptions.classList.add('hidden');
        downloadSection.classList.remove('hidden');

        if (savings > 0) {
            savingPercentDisplay.textContent = `${savingsPercent}%`;
            savingPercentDisplay.classList.remove('text-red-500');
            savingPercentDisplay.classList.add('text-green-600');
        } else {
            savingPercentDisplay.textContent = `0% (Ya optimizado)`;
            savingPercentDisplay.classList.remove('text-green-600');
            savingPercentDisplay.classList.add('text-red-500');
        }

        // Setup Download
        downloadBtn.onclick = () => {
            const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `comprimido_${selectedLevel}_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
    }

    resetBtn.addEventListener('click', resetState);

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
