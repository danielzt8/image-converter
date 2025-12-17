// --- Referencias al DOM ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileCountDisplay = document.getElementById('fileCount');
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
// Controles
const controls = document.getElementById('controls');
const formatSelect = document.getElementById('formatSelect');
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');
const sliderContainer = document.getElementById('sliderContainer');
const formatInfo = document.getElementById('formatInfo');
const infoText = document.getElementById('infoText');

// Resultados y Botones
const processBtn = document.getElementById('processBtn');
const results = document.getElementById('results');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const finalSizeDisplay = document.getElementById('finalSize');
const savingsTag = document.getElementById('savingsTag');
const downloadBtn = document.getElementById('downloadBtn');
const resultLabel = document.getElementById('resultLabel');

// --- Estado Global ---
let selectedFiles = [];
let outputBlob = null;
let outputFilename = "";

// --- Utilidad: Formatear Bytes ---
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Mensajes Educativos y Configuración de Formatos ---
const messages = {
    'image/avif': {
        text: isSafari
            ? "⚠️ AVIF: Es probable que no funcione en Safari. Si el proceso se detiene, por favor usa WebP."
            : "AVIF (Nuevo): La mejor compresión actual. Menor peso que WebP y gran calidad.",
        colorClass: isSafari ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-purple-50 border-purple-100 text-purple-800",
        icon: isSafari ? "⚠️" : "💎",
        disableSlider: false
    },
    'image/webp': {
        text: "WebP: Estándar moderno. Mantiene transparencia y ahorra mucho peso.",
        colorClass: "bg-green-50 border-green-100 text-green-800",
        icon: "✨",
        disableSlider: false
    },
    'image/jpeg': {
        text: "JPEG: Clásico para fotos. El fondo transparente se volverá BLANCO.",
        colorClass: "bg-blue-50 border-blue-100 text-blue-800",
        icon: "📸",
        disableSlider: false
    },
    'image/png': {
        text: "PNG: Formato 'sin pérdida'. El selector de calidad NO afectará el peso.",
        colorClass: "bg-orange-50 border-orange-100 text-orange-800",
        icon: "⚠️",
        disableSlider: true
    }
};

// Actualizar UI cuando cambia el formato
function updateFormatInfo() {
    const format = formatSelect.value;
    const config = messages[format];

    // Texto e Icono
    infoText.textContent = config.text;
    formatInfo.querySelector('span').textContent = config.icon;

    // Colores
    formatInfo.className = `text-sm p-4 rounded-lg border flex items-start gap-3 transition-colors duration-300 shadow-sm ${config.colorClass}`;

    // Habilitar/Deshabilitar Slider
    if (config.disableSlider) {
        sliderContainer.classList.add('opacity-40', 'pointer-events-none');
        qualityValue.textContent = "Máxima";
    } else {
        sliderContainer.classList.remove('opacity-40', 'pointer-events-none');
        qualityValue.textContent = Math.round(qualityRange.value * 100) + "%";
    }
}

// Listeners de cambios en UI
formatSelect.addEventListener('change', updateFormatInfo);
qualityRange.addEventListener('input', (e) => qualityValue.textContent = Math.round(e.target.value * 100) + "%");

// --- Lógica Drag & Drop y Carga ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-blue-50', 'border-blue-400');
});

['dragleave', 'dragend', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => {
    dropZone.classList.remove('bg-blue-50', 'border-blue-400');
}));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(fileInput.files);
});

function handleFiles(files) {
    // Filtrar solo imágenes
    selectedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (selectedFiles.length === 0) return alert("Por favor, sube solo archivos de imagen válidos.");

    // Actualizar texto según cantidad
    if (selectedFiles.length === 1) {
        fileCountDisplay.textContent = `1 archivo: ${selectedFiles[0].name}`;
        resultLabel.textContent = "Peso Imagen";
    } else {
        fileCountDisplay.textContent = `${selectedFiles.length} archivos seleccionados`;
        resultLabel.textContent = "Peso Total ZIP";
    }

    // Mostrar elementos
    fileCountDisplay.classList.remove('hidden');
    controls.classList.remove('hidden');
    controls.classList.add('flex');

    // Ocultar resultados previos si los hubo
    results.classList.add('hidden');

    // Inicializar estado del slider
    updateFormatInfo();
}


// --- MOTOR DE PROCESAMIENTO ---
processBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // Bloquear UI mientras trabaja
    processBtn.disabled = true;
    processBtn.innerHTML = "<span>⏳</span> Procesando...";
    results.classList.remove('hidden');

    // Reset Botón de descarga
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Espere...";
    downloadBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600', 'shadow-lg');
    downloadBtn.classList.add('bg-slate-300', 'text-slate-500', 'cursor-not-allowed', 'shadow-none');

    // Obtener configuración
    const format = formatSelect.value;
    const quality = parseFloat(qualityRange.value);
    const ext = format.split('/')[1];

    // === CAMINO A: SOLO 1 IMAGEN ===
    if (selectedFiles.length === 1) {
        progressContainer.classList.add('hidden');
        const file = selectedFiles[0];

        // Procesar
        processSingleImage(file, format, quality).then(blob => {
            outputBlob = blob;
            outputFilename = file.name.split('.')[0] + `-opt.${ext}`;

            updateResultsUI(file.size, blob.size);
            readyToDownload("📥 Descargar Imagen");
        });
    }
    // === CAMINO B: MÚLTIPLES (ZIP) ===
    else {
        progressContainer.classList.remove('hidden');
        const zip = new JSZip();
        let totalOriginalSize = 0;
        let processedCount = 0;

        // Crear array de promesas
        const promises = selectedFiles.map(file => {
            totalOriginalSize += file.size;
            return processSingleImage(file, format, quality).then(blob => {
                const newName = file.name.split('.')[0] + `-opt.${ext}`;
                zip.file(newName, blob);

                // Actualizar Barra
                processedCount++;
                progressBar.style.width = `${(processedCount / selectedFiles.length) * 100}%`;
            });
        });

        // Esperar a todos
        await Promise.all(promises);

        processBtn.innerHTML = "<span>📦</span> Empaquetando ZIP...";

        // Generar ZIP
        zip.generateAsync({
            type: "blob"
        }).then(content => {
            outputBlob = content;
            outputFilename = "imagenes-optimizadas.zip";

            updateResultsUI(totalOriginalSize, content.size);
            readyToDownload("📥 Descargar ZIP");
        });
    }
});

// --- Función: Procesar 1 Imagen (Canvas) ---
function processSingleImage(file, format, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Fondo blanco solo para JPEG
                if (format === 'image/jpeg') {
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                // Conversión final
                canvas.toBlob(blob => resolve(blob), format, quality);
            };
        };
    });
}

// --- Función: Mostrar Resultados Numéricos ---
function updateResultsUI(original, final) {
    finalSizeDisplay.textContent = formatBytes(final);
    const diff = original - final;
    const pct = ((diff / original) * 100).toFixed(1);

    // Estilos dinámicos para la etiqueta de ahorro
    if (diff > 0) {
        savingsTag.textContent = `-${pct}% AHORRO`;
        savingsTag.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500 uppercase tracking-wide shadow-sm animate-fade-in";
    } else {
        savingsTag.textContent = `+${Math.abs(pct)}% PESO`;
        savingsTag.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-500 uppercase tracking-wide shadow-sm animate-fade-in";
    }
}

// --- Función: Activar Botón Descarga ---
function readyToDownload(text) {
    downloadBtn.textContent = text;
    downloadBtn.disabled = false;

    // Estilos de botón activo
    downloadBtn.classList.remove('bg-slate-300', 'text-slate-500', 'cursor-not-allowed', 'shadow-none');
    downloadBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600', 'shadow-lg');

    processBtn.disabled = false;
    processBtn.innerHTML = "<span>⚡</span> Procesar de Nuevo";
}

// --- Evento: Descargar ---
downloadBtn.addEventListener('click', () => {
    if (outputBlob) saveAs(outputBlob, outputFilename);
});

