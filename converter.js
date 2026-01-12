// --- Referencias al DOM ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileCountDisplay = document.getElementById('fileCount');
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
// Controles
// Controles
const controls = document.getElementById('controls');
const formatSelect = document.getElementById('formatSelect');
const compressionButtons = document.querySelectorAll('.compression-btn');
const compressionContainer = document.getElementById('compressionOptions');
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
let currentQuality = 0.8; // Default value

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
        disableCompression: false
    },
    'image/webp': {
        text: "WebP: Estándar moderno. Mantiene transparencia y ahorra mucho peso.",
        colorClass: "bg-green-50 border-green-100 text-green-800",
        icon: "✨",
        disableCompression: false
    },
    'image/jpeg': {
        text: "JPEG: Clásico para fotos. El fondo transparente se volverá BLANCO.",
        colorClass: "bg-blue-50 border-blue-100 text-blue-800",
        icon: "📸",
        disableCompression: false
    },
    'image/png': {
        text: "PNG: Formato 'sin pérdida'. La opción de nivel de compresión no afectará la calidad visual.",
        colorClass: "bg-orange-50 border-orange-100 text-orange-800",
        icon: "⚠️",
        disableCompression: true
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

    // Habilitar/Deshabilitar Opciones de Compresión
    if (config.disableCompression) {
        compressionContainer.classList.add('opacity-40', 'pointer-events-none');
    } else {
        compressionContainer.classList.remove('opacity-40', 'pointer-events-none');
    }
}

// Listeners de cambios en UI
formatSelect.addEventListener('change', updateFormatInfo);

// Compression Buttons Logic
compressionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        compressionButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked
        btn.classList.add('active');
        // Update state
        currentQuality = parseFloat(btn.dataset.quality);
    });
});

// --- Lógica Drag & Drop y Carga ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-slate-800', 'border-blue-500');
});

['dragleave', 'dragend', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => {
    dropZone.classList.remove('bg-slate-800', 'border-blue-500');
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

    // Inicializar estado
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
    const quality = currentQuality;
    const ext = format.split('/')[1];

    // === CAMINO A: SOLO 1 IMAGEN ===
    if (selectedFiles.length === 1) {
        progressContainer.classList.add('hidden');
        const file = selectedFiles[0];

        // Procesar
        processSingleImage(file, format, quality)
            .then(blob => {
                outputBlob = blob;
                outputFilename = file.name.split('.')[0] + `-opt.${ext}`;

                updateResultsUI(file.size, blob.size);
                readyToDownload("📥 Descargar Imagen");
            })
            .catch(error => {
                console.error('Error procesando imagen:', error);
                alert(`Error al procesar la imagen: ${error.message}\n\nIntenta con otro formato o imagen.`);
                processBtn.disabled = false;
                processBtn.innerHTML = "<span>⚡</span> Procesar Imágenes";
            });
    }
    // === CAMINO B: MÚLTIPLES (ZIP) ===
    else {
        progressContainer.classList.remove('hidden');
        const zip = new JSZip();
        let totalOriginalSize = 0;
        let processedCount = 0;

        // Optimización: Procesar en lotes pequeños para no bloquear la UI
        const BATCH_SIZE = 3;

        for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
            const batch = selectedFiles.slice(i, i + BATCH_SIZE);

            // Crear promesas para el lote actual
            const batchPromises = batch.map(file => {
                totalOriginalSize += file.size;
                return processSingleImage(file, format, quality)
                    .then(blob => {
                        const newName = file.name.split('.')[0] + `-opt.${ext}`;
                        zip.file(newName, blob);

                        // Actualizar Barra
                        processedCount++;
                        progressBar.style.width = `${(processedCount / selectedFiles.length) * 100}%`;

                        // Pequeña pausa para permitir que la UI se renderice
                        return new Promise(resolve => setTimeout(() => resolve(), 10));
                    })
                    .catch(err => {
                        console.error(`Error procesando ${file.name}`, err);
                        // No interrumpimos todo el proceso por un error, pero lo logueamos
                    });
            });

            // Esperar a que termine este lote antes de comenzar el siguiente
            await Promise.all(batchPromises);
        }

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
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onerror = () => reject(new Error('Error al leer el archivo'));

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onerror = () => reject(new Error('Error al cargar la imagen'));

            img.onload = () => {
                try {
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

                    // Conversión final con manejo de errores
                    canvas.toBlob((blob) => {
                        if (blob) {
                            console.log(`Blob creado: ${blob.size} bytes, tipo: ${blob.type}`);
                            resolve(blob);
                        } else {
                            reject(new Error(`No se pudo crear blob para formato ${format}`));
                        }
                    }, format, quality);
                } catch (error) {
                    reject(error);
                }
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
downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();

    if (!outputBlob) return;

    // Crear URL del blob
    const url = URL.createObjectURL(outputBlob);

    // Crear elemento <a> temporal
    const link = document.createElement('a');
    link.href = url;
    link.download = outputFilename;

    // IMPORTANTE PARA CHROME: 
    // Añadir al DOM, hacer click y remover inmediatamente.
    document.body.appendChild(link);
    link.click();

    // Limpieza inmediata
    document.body.removeChild(link);

    // Liberar la URL después de un pequeño delay para que el navegador inicie la descarga
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
});

// Prevenir comportamiento por defecto
e.preventDefault();

console.log('Creando URL del blob...');
// Crear URL temporal del blob
const url = URL.createObjectURL(outputBlob);
console.log('URL creada:', url);

// Crear elemento <a> temporal para descarga
const link = document.createElement('a');
link.href = url;
link.download = outputFilename;

console.log('Link creado:', link);
console.log('  - href:', link.href);
console.log('  - download:', link.download);

// Usar requestAnimationFrame para asegurar que el click está en contexto de usuario
requestAnimationFrame(() => {
    document.body.appendChild(link);
    console.log('Link agregado al DOM');

    // Disparar click
    link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    }));
    console.log('Click ejecutado');

    // Limpiar después de un breve delay
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('Link removido y URL liberada');
        console.log('=== FIN DESCARGA ===');
    }, 200);
});

