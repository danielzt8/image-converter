// --- DOM References ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const controls = document.getElementById('controls');
const mergeBtn = document.getElementById('mergeBtn');
const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

// --- State ---
let selectedFiles = []; // Array of File objects
let mergedPdfBytes = null;

// --- Drag & Drop / Selection Logic ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-slate-800', 'border-red-500');
});

['dragleave', 'dragend', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => {
    dropZone.classList.remove('bg-slate-800', 'border-red-500');
}));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
    // Reset input so selecting the same file again works if needed
    fileInput.value = '';
});

function handleFiles(files) {
    // Robust check: MIME type OR extension
    const newFiles = Array.from(files).filter(f => {
        return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    });

    // Check if any valida files were found
    if (newFiles.length === 0 && files.length > 0) {
        alert("Por favor sube solo archivos PDF válidos.");
        return;
    }

    selectedFiles = [...selectedFiles, ...newFiles];
    updateUI();
}

function updateUI() {
    // 1. Show/Hide controls
    if (selectedFiles.length > 0) {
        fileList.classList.remove('hidden');
        controls.classList.remove('hidden');
        controls.classList.add('flex');
    } else {
        fileList.classList.add('hidden');
        controls.classList.add('hidden');
    }

    // 2. Render List
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = "flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 group hover:border-red-300 transition-colors";

        item.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <span class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold shrink-0">${index + 1}</span>
                <span class="text-sm text-slate-700 font-medium truncate">${file.name}</span>
                <span class="text-xs text-slate-400 shrink-0">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button onclick="removeFile(${index})" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Eliminar">
                ✕
            </button>
        `;
        fileList.appendChild(item);
    });

    // 3. Update Button State
    if (selectedFiles.length < 2) {
        mergeBtn.disabled = true;
        mergeBtn.classList.add('opacity-50', 'cursor-not-allowed');
        mergeBtn.innerHTML = `<span>⚠️</span> Selecciona al menos 2 PDFs`;
    } else {
        mergeBtn.disabled = false;
        mergeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        mergeBtn.innerHTML = `Unir ${selectedFiles.length} PDFs`;
    }

    // Hide download if we changed files
    downloadSection.classList.add('hidden');
}

// Global function for remove button
window.removeFile = function (index) {
    selectedFiles.splice(index, 1);
    updateUI();
};

// --- MERGE LOGIC ---
mergeBtn.addEventListener('click', async () => {
    if (selectedFiles.length < 2) return;

    // Check if library is loaded
    if (typeof PDFLib === 'undefined') {
        alert("Error crítico: La librería PDF-Lib no se ha cargado. Verifica tu conexión a internet o el bloqueo de scripts.");
        return;
    }

    // Loading State
    mergeBtn.disabled = true;
    mergeBtn.innerHTML = `<span>⏳</span> Procesando...`;

    try {
        const { PDFDocument } = PDFLib;

        // Create a new PDF Document
        const mergedPdf = await PDFDocument.create();

        // Process each file
        for (const file of selectedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        // Serialize the PDFDocument to bytes (a Uint8Array)
        mergedPdfBytes = await mergedPdf.save();

        // Show Success
        downloadSection.classList.remove('hidden');
        mergeBtn.innerHTML = `<span>✅</span> ¡Completado!`;

    } catch (error) {
        console.error(error);
        alert("Ocurrió un error al unir los PDFs. Puede que uno de los archivos esté corrupto o protegido con contraseña.");
        mergeBtn.innerHTML = `<span>❌</span> Error`;

        // Reset button after error
        setTimeout(() => {
            updateUI();
        }, 2000);
    }
});

downloadBtn.addEventListener('click', () => {
    if (!mergedPdfBytes) return;

    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `unido_optilocal_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

resetBtn.addEventListener('click', () => {
    selectedFiles = [];
    mergedPdfBytes = null;
    fileInput.value = ''; // Reset input
    updateUI();
});
