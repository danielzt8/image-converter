// --- DOM Elements ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileNameDisplay = document.getElementById('fileName');
const fileStatusDisplay = document.getElementById('fileStatus');
const removeFileBtn = document.getElementById('removeFileBtn');

const unlockSection = document.getElementById('unlockSection');
// Removed passwordInput, unlockBtn, errorMsg references as they no longer exist in HTML

const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

let currentFile = null;
let unlockedPdfBytes = null;

// --- Drag & Drop ---
// dropZone.addEventListener('click', ...); // REMOVED: Using HTML overlay

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-red-500', 'bg-slate-800/50');
});

['dragleave', 'dragend', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('border-red-500', 'bg-slate-800/50'));
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

// --- Main Logic ---
async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Por favor sube un archivo PDF.');
        return;
    }

    currentFile = file;
    fileNameDisplay.textContent = file.name;

    // Show Info, hide drop
    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    fileStatusDisplay.textContent = "Analizando...";

    // Hide other sections just in case
    unlockSection.classList.add('hidden');
    document.getElementById('notProtectedSection').classList.add('hidden');
    downloadSection.classList.add('hidden');

    try {
        // Attempt to load WITHOUT password to check encryption
        const arrayBuffer = await file.arrayBuffer();

        // We use a small trick: try load. If it fails with "EncryptedPDFError", it's locked.
        try {
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
            // If we got here, it loaded fine without password.
            // It might have an OWNER password (permissions), so we allow "Unlocking" (Sanitizing) it anyway.
            showPermissionsUnlock();
        } catch (error) {
            // Check for various indicators of an encrypted file
            const errorStr = (error.message || error.toString()).toLowerCase();

            if (
                errorStr.includes('encrypt') ||
                errorStr.includes('password') ||
                error.name === 'EncryptedPDFError'
            ) {
                // Start the UI-driven cracking process
                showLocked();
            } else {
                console.error(error);
                alert(`No se pudo procesar el archivo. El sistema reportó: ${error.message}`);
                resetState();
            }
        }

    } catch (e) {
        console.error(e);
        resetState();
    }
}

// Updated to remove manual password input relying only on auto-cracking
function showLocked() {
    unlockSection.classList.remove('hidden');

    // UI Elements
    const title = document.getElementById('unlockTitle');
    const msg = document.getElementById('unlockMessage');
    const spinner = document.getElementById('unlockSpinner');
    const icon = document.getElementById('unlockStatusIcon');
    const failMsg = document.getElementById('cantUnlockMsg');

    // Reset UI ensure elements exist
    if (!title) return;

    title.innerText = "Encriptación Detectada";
    msg.innerHTML = "Iniciando secuencia de desbloqueo inteligente...<br>Probando claves comunes y patrones.";
    spinner.classList.remove('hidden');
    icon.classList.add('hidden');
    failMsg.classList.add('hidden');

    // Extended Dictionary
    const commonPasswords = [
        '', '1234', '12345', '123456', '0000', 'password', 'admin', 'user', '12345678', '000000', '1111', '123123',
        '123456789', '1234567890', 'preview', 'public', 'secret', 'confidential', 'pdf', 'adobe', 'test', 'prueba'
    ];

    // Add filename variants
    if (currentFile) {
        const nameBase = currentFile.name.replace('.pdf', '');
        commonPasswords.push(nameBase);
        commonPasswords.push(nameBase.toLowerCase());
        commonPasswords.push(nameBase.toUpperCase());
    }

    let crackedPdf = null;
    let foundPassword = null;

    // Async Cracking Loop
    (async () => {
        const arrayBuffer = await currentFile.arrayBuffer();

        // Slower loop to allow UI updates (fake effort)
        for (let i = 0; i < commonPasswords.length; i++) {
            const pass = commonPasswords[i];

            // Update UI text occasionally
            if (i % 3 === 0) {
                msg.textContent = `Probando patrón ${i + 1} de ${commonPasswords.length}...`;
                await new Promise(r => setTimeout(r, 100)); // Small delay for visual effect
            }

            try {
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer, { password: pass });
                crackedPdf = pdf;
                foundPassword = pass;
                break; // Success!
            } catch (ignore) { }
        }

        spinner.classList.add('hidden');
        icon.classList.remove('hidden');

        if (crackedPdf) {
            // SUCCESS
            title.innerText = "¡Contraseña Eliminada!";
            title.className = "text-green-400 font-bold text-xl mb-2";
            msg.textContent = "El archivo ha sido desbloqueado exitosamente.";
            icon.innerText = "🔓";

            fileStatusDisplay.textContent = "¡Desbloqueo exitoso!";
            fileStatusDisplay.classList.remove('text-red-400');
            fileStatusDisplay.classList.add('text-green-400');

            // Store for download
            currentFile.autoLoadedPdf = crackedPdf;

            // Trigger the 'simple' unlock since we have the PDF open
            showSimpleUnlockUI(foundPassword);
            // Hide the progress box itself after a moment if simple UI takes over
            setTimeout(() => unlockSection.classList.add('hidden'), 1500);

        } else {
            // FAILURE
            title.innerText = "Protección Alta";
            title.className = "text-red-400 font-bold text-xl mb-2";
            msg.textContent = "Finalizado.";
            icon.innerText = "🔒";
            failMsg.classList.remove('hidden');
            fileStatusDisplay.textContent = "Falló el desbloqueo";
        }
    })();
}

function showPermissionsUnlock() {
    fileStatusDisplay.innerHTML = "🔓 legible (Posibles restricciones de Permisos)";
    fileStatusDisplay.classList.remove('text-red-400');
    fileStatusDisplay.classList.add('text-green-400');

    // Use the permissions section to allow processing
    const section = document.getElementById('notProtectedSection');
    section.classList.remove('hidden');

    // Update text to indicate we can clean it
    section.innerHTML = `
            <div class="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                <p class="text-blue-400 font-medium text-sm">El archivo se puede leer</p>
                <p class="text-slate-400 text-xs mt-1 mb-3">Si tienes problemas para imprimir o editar, pulsa abajo para limpiar los permisos.</p>
                <button id="forceUnlockBtn" class="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors text-sm">
                    Replicar y Limpiar
                </button>
            </div>
        `;

    document.getElementById('forceUnlockBtn').addEventListener('click', async () => {
        await processUnlock('');
    });
}

function showSimpleUnlockUI(passwordUsed = '') {
    // Use the permissions section to show the easy button
    const section = document.getElementById('notProtectedSection');
    section.classList.remove('hidden');

    section.innerHTML = `
            <div class="p-6 bg-green-500/10 rounded-xl border border-green-500/20 text-center animate-fade-in">
                <div class="mb-3 text-3xl">🔓</div>
                <h3 class="text-green-400 font-bold text-lg mb-1">¡Contraseña Encontrada!</h3>
                <p class="text-slate-400 text-sm mb-4">El sistema rompió la seguridad.<br>Ya puedes descargar tu archivo.</p>
                <button id="easyUnlockBtn" class="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/20 text-md w-full">
                    Descargar Ahora
                </button>
            </div>
        `;

    document.getElementById('easyUnlockBtn').addEventListener('click', async () => {
        await processUnlock(passwordUsed);
    });
}

// --- Unified Unlock Action ---
async function processUnlock(password) {

    // Visual feedback based on context
    const simpleBtn = document.getElementById('easyUnlockBtn');
    const forceBtn = document.getElementById('forceUnlockBtn');
    const btnToUpdate = simpleBtn || forceBtn;

    if (btnToUpdate) {
        btnToUpdate.disabled = true;
        btnToUpdate.innerHTML = "⏳ Generando PDF...";
    }

    try {
        let originalPdf;

        // OPTIMIZATION: Use the pre-loaded PDF if we auto-unlocked it earlier
        if (currentFile.autoLoadedPdf) {
            originalPdf = currentFile.autoLoadedPdf;
        } else {
            const arrayBuffer = await currentFile.arrayBuffer();
            originalPdf = await PDFLib.PDFDocument.load(arrayBuffer, { password: password });
        }

        // --- REPLICATION STRATEGY ---
        // Instead of just saving the original (which might keep some metadata),
        // We create a BRAND NEW PDF and copy the pages over.
        // This guarantees a fresh structure free of legacy restrictions.
        const newPdf = await PDFLib.PDFDocument.create();

        // Copy all pages
        const pages = await newPdf.copyPages(originalPdf, originalPdf.getPageIndices());
        pages.forEach(page => newPdf.addPage(page));

        // Save the fresh copy
        unlockedPdfBytes = await newPdf.save();

        // Show success
        unlockSection.classList.add('hidden');
        document.getElementById('notProtectedSection').classList.add('hidden');
        downloadSection.classList.remove('hidden');

        setupDownload(currentFile.name);

    } catch (error) {
        console.log(error);
        alert("Error inesperado al replicar el archivo PDF.");
        if (btnToUpdate) btnToUpdate.disabled = false;
    }
}

function setupDownload(originalName) {
    downloadBtn.onclick = () => {
        const blob = new Blob([unlockedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unlocked_${originalName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
}

// --- Reset ---
removeFileBtn.addEventListener('click', resetState);
resetBtn.addEventListener('click', resetState);

function resetState() {
    currentFile = null;
    unlockedPdfBytes = null;
    fileInput.value = '';

    dropZone.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    unlockSection.classList.add('hidden');
    document.getElementById('notProtectedSection').classList.add('hidden');
    downloadSection.classList.add('hidden');
}
    });
