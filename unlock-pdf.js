document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameDisplay = document.getElementById('fileName');
    const fileStatusDisplay = document.getElementById('fileStatus');
    const removeFileBtn = document.getElementById('removeFileBtn');

    const unlockSection = document.getElementById('unlockSection');
    const passwordInput = document.getElementById('passwordInput');
    const unlockBtn = document.getElementById('unlockBtn');
    const errorMsg = document.getElementById('errorMsg');

    const downloadSection = document.getElementById('downloadSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let currentFile = null;
    let unlockedPdfBytes = null;

    // --- Drag & Drop ---
    dropZone.addEventListener('click', () => fileInput.click());
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
        errorMsg.classList.add('hidden');
        passwordInput.value = '';

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
                    showLocked();
                } else {
                    console.error(error);
                    // Show a more descriptive error instead of just "Damaged"
                    // giving the user a hint of what went wrong (e.g. "Index out of bounds", "Invalid header")
                    alert(`No se pudo procesar el archivo. El sistema reportó: ${error.message}`);
                    resetState();
                }
            }

        } catch (e) {
            console.error(e);
            resetState();
        }
    }

    function showLocked() {
        fileStatusDisplay.innerHTML = "🔒 Encriptado (Contraseña de Apertura)";
        fileStatusDisplay.classList.add('text-red-400');
        unlockSection.classList.remove('hidden');
        passwordInput.focus();
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
            // Process without password
            unlockBtn.click(); // Trigger the main logic, but password input will be empty
        });
    }

    // --- Unlock Action ---
    unlockBtn.addEventListener('click', async () => {
        // If hidden/locked section is active, grab password. If permissions section active, password is empty.
        const password = passwordInput.value || '';

        // Visual feedback based on context
        const btnToUpdate = password ? unlockBtn : document.getElementById('forceUnlockBtn') || unlockBtn;
        const originalText = btnToUpdate.innerText;

        btnToUpdate.disabled = true;
        btnToUpdate.innerHTML = "⏳ Procesando...";
        errorMsg.classList.add('hidden');

        try {
            const arrayBuffer = await currentFile.arrayBuffer();

            // Try load (WITH or WITHOUT password depending on input)
            // If password is empty string, pdf-lib treats it as "no password" load attempt
            const originalPdf = await PDFLib.PDFDocument.load(arrayBuffer, { password: password });

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
            // Likely wrong password (if we provided one)
            btnToUpdate.disabled = false;
            btnToUpdate.innerHTML = originalText;

            if (password) {
                errorMsg.classList.remove('hidden');
                const container = unlockSection.querySelector('div');
                container.classList.add('shake');
                setTimeout(() => container.classList.remove('shake'), 500);
            } else {
                alert("Error al intentar replicar el archivo. Puede tener una encriptación avanzada.");
            }
        }
    });

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

        unlockBtn.disabled = false;
        unlockBtn.innerHTML = "Desbloquear";
    }
});
