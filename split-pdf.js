document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const editorInterface = document.getElementById('editorInterface');
    const pagesGrid = document.getElementById('pagesGrid');

    // Header Info
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const pageCountDisplay = document.getElementById('pageCountDisplay');

    // Tabs
    const tabManual = document.getElementById('tabManual');
    const tabSize = document.getElementById('tabSize');
    const tabRange = document.getElementById('tabRange');

    // Panels
    const controlsManual = document.getElementById('controlsManual');
    const controlsSize = document.getElementById('controlsSize');
    const controlsRange = document.getElementById('controlsRange');

    // Controls: Manual
    const selectionModeRadios = document.querySelectorAll('input[name="selectionMode"]');
    const specificSelectionControls = document.getElementById('specificSelectionControls');
    const rangeStart = document.getElementById('rangeStart');
    const rangeEnd = document.getElementById('rangeEnd');
    const applyRangeBtn = document.getElementById('applyRangeBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selectedCountDisplay = document.getElementById('selectedCount');
    const splitBtn = document.getElementById('splitBtn');
    const manualActions = document.getElementById('manualActions');

    // Controls: Size
    const totalSizeDisplay = document.getElementById('totalSizeDisplay');
    const maxSizeInput = document.getElementById('maxSizeInput');
    const sizeUnitRadios = document.querySelectorAll('input[name="sizeUnit"]');
    const splitSizeBtn = document.getElementById('splitSizeBtn');

    // Controls: Range
    const subTabCustom = document.getElementById('subTabCustom');
    const subTabFixed = document.getElementById('subTabFixed');
    const rangeFixedControls = document.getElementById('rangeFixedControls');
    const rangeCustomControls = document.getElementById('rangeCustomControls');

    const fixedPageCount = document.getElementById('fixedPageCount');
    const fixedSplitSummary = document.getElementById('fixedSplitSummary');

    // New Custom Range Elements
    const customRangesContainer = document.getElementById('customRangesContainer');
    const addRangeBtn = document.getElementById('addRangeBtn');
    const mergeRangesCheckbox = document.getElementById('mergeRangesCheckbox');

    const splitRangeBtn = document.getElementById('splitRangeBtn');

    // --- State ---
    let currentFile = null;
    let pdfDoc = null;
    let numPages = 0;

    let currentMode = 'manual'; // 'manual' | 'size' | 'range'
    let manualSelectionMode = 'all'; // 'all' | 'specific'
    let rangeSubMode = 'custom'; // 'custom' | 'fixed'

    let selectedPages = new Set();
    let fixedChunkSize = 1;
    let pageElementsCache = [];

    let customRanges = []; // [{id: 1, start: 1, end: 1}]
    let nextRangeId = 1;

    // --- Init ---

    // --- Event Listeners ---

    // File Handling
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('bg-slate-800', 'border-red-500'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('bg-slate-800', 'border-red-500'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-slate-800', 'border-red-500');
        if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type === 'application/pdf') {
            handleFile(e.dataTransfer.files[0]);
        } else {
            alert('Por favor, sube un archivo PDF válido.');
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    // Tab Switching
    tabManual.addEventListener('click', () => switchMode('manual'));
    tabSize.addEventListener('click', () => switchMode('size'));
    tabRange.addEventListener('click', () => switchMode('range'));

    // Manual Logic
    selectionModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            manualSelectionMode = e.target.value;
            updateManualControls();
        });
    });
    selectAllBtn.addEventListener('click', () => {
        for (let i = 0; i < numPages; i++) selectedPages.add(i);
        updateUI();
    });
    deselectAllBtn.addEventListener('click', () => {
        selectedPages.clear();
        updateUI();
    });
    applyRangeBtn.addEventListener('click', () => {
        const start = parseInt(rangeStart.value);
        const end = parseInt(rangeEnd.value);
        if (isNaN(start) || isNaN(end) || start < 1 || end > numPages || start > end) {
            alert(`Por favor ingresa un rango válido (1 - ${numPages}).`);
            return;
        }
        selectedPages.clear();
        for (let i = start; i <= end; i++) selectedPages.add(i - 1);
        updateUI();
    });
    splitBtn.addEventListener('click', extractSelectedPages);

    // Size Logic
    splitSizeBtn.addEventListener('click', splitBySize);

    // Range Logic
    subTabCustom.addEventListener('click', () => switchRangeSubMode('custom'));
    subTabFixed.addEventListener('click', () => switchRangeSubMode('fixed'));

    fixedPageCount.addEventListener('input', () => {
        let val = parseInt(fixedPageCount.value);
        if (val < 1) { val = 1; fixedPageCount.value = 1; }
        if (val > numPages) { val = numPages; fixedPageCount.value = numPages; }
        fixedChunkSize = val;
        updateUI();
    });

    addRangeBtn.addEventListener('click', () => {
        addRangeItem();
        updateUI();
    });

    splitRangeBtn.addEventListener('click', splitByRange);

    // --- Core Functions ---

    async function handleFile(file) {
        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.title = file.name;

        const sizeKB = (file.size / 1024).toFixed(2);
        let sizeText = `${sizeKB} KB`;
        if (file.size > 1024 * 1024) sizeText = `${(file.size / (1024 * 1024)).toFixed(2)} MB (${sizeKB} KB)`;
        if (totalSizeDisplay) totalSizeDisplay.textContent = sizeText;

        // Update Layout to Full Screen
        const pageTitle = document.getElementById('pageTitle');
        const mainContainer = document.getElementById('mainContainer');

        if (pageTitle) pageTitle.style.display = 'none'; // Instant hide to save space

        // Expand Container
        mainContainer.className = "w-full h-full max-w-[1920px] mx-auto glass-effect rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden relative transition-all duration-500";
        // Remove padding that was used for the small box
        mainContainer.classList.remove('p-2', 'md:p-6');

        dropZone.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        editorInterface.classList.add('hidden');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            pdfDoc = await loadingTask.promise;
            numPages = pdfDoc.numPages;

            pageCountDisplay.textContent = `${numPages} páginas | ${sizeText}`;

            await preparePageCache();
            renderGridStandard();

            // Default State
            selectedPages.clear();
            rangeStart.max = numPages;
            rangeEnd.max = numPages;

            if (manualSelectionMode === 'all') {
                for (let i = 0; i < numPages; i++) selectedPages.add(i);
            }

            fixedChunkSize = 1;

            // Reset Custom Ranges
            customRanges = [];
            customRangesContainer.innerHTML = '';
            nextRangeId = 1;
            addRangeItem(); // Add first item by default

            loadingIndicator.classList.add('hidden');
            editorInterface.classList.remove('hidden');

            updateManualControls();

        } catch (error) {
            console.error(error);
            alert('Error al leer el PDF: ' + (error.message || error));
            location.reload();
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const index = parseInt(el.dataset.pageIndex);
                if (el.dataset.rendered === "false") {
                    renderPageThumbnail(index, el);
                    el.dataset.rendered = "true";
                }
                observer.unobserve(el);
            }
        });
    }, { root: pagesGridWrapper, rootMargin: "200px" });

    async function preparePageCache() {
        pageElementsCache = [];
        for (let i = 1; i <= numPages; i++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'relative group cursor-pointer transition-all duration-200 p-2 rounded-xl border-2 border-transparent';

            // Mark as not rendered
            pageContainer.dataset.pageIndex = i - 1;
            pageContainer.dataset.rendered = "false";

            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'relative rounded-lg overflow-hidden shadow-sm bg-slate-800 pointer-events-none min-h-[150px] flex items-center justify-center';

            // Placeholder visuals
            canvasWrapper.innerHTML = `
                <div class="absolute inset-0 flex items-center justify-center text-slate-700">
                    <svg class="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
            `;

            const checkOverlay = document.createElement('div');
            checkOverlay.className = 'absolute inset-0 bg-red-500/10 opacity-0 transition-opacity flex items-center justify-center manual-indicator z-20';
            checkOverlay.innerHTML = '<span class="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transform scale-90 transition-transform"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg></span>';

            const badge = document.createElement('div');
            badge.className = 'absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-none z-20';
            badge.textContent = `${i}`;

            canvasWrapper.appendChild(checkOverlay);
            canvasWrapper.appendChild(badge);
            pageContainer.appendChild(canvasWrapper);

            // Click listener should work even if not rendered
            pageContainer.addEventListener('click', () => handlePageClick(i - 1));

            // Start observing for lazy load
            observer.observe(pageContainer);

            pageElementsCache.push(pageContainer);
        }
    }

    async function renderPageThumbnail(index, container) {
        try {
            const page = await pdfDoc.getPage(index + 1);
            const viewport = page.getViewport({ scale: 0.35 });

            const canvas = document.createElement('canvas');
            canvas.className = 'w-full h-auto block relative z-10 fadeIn';
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const wrapper = container.querySelector('div'); // canvasWrapper
            // Remove placeholder icon
            const placeholder = wrapper.querySelector('div.absolute');
            if (placeholder) placeholder.remove();

            wrapper.insertBefore(canvas, wrapper.firstChild); // Insert before overlay
            wrapper.classList.remove('min-h-[150px]', 'flex', 'items-center', 'justify-center', 'bg-slate-800');
            wrapper.classList.add('bg-white');

        } catch (e) {
            console.error("Error rendering page " + index, e);
        }
    }

    function renderGridStandard() {
        pagesGrid.innerHTML = '';
        pagesGrid.className = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 content-start pb-10';
        pageElementsCache.forEach(el => {
            el.className = 'relative group cursor-pointer transition-all duration-200 p-2 rounded-xl border-2 border-transparent';
            pagesGrid.appendChild(el);
        });
    }

    function renderGridGrouped(groups) {
        pagesGrid.innerHTML = '';
        pagesGrid.className = 'flex flex-wrap gap-6 content-start pb-10';

        groups.forEach((group, groupIdx) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'flex flex-col bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm min-w-[150px] relative transition-all hover:shadow-md';

            // Header
            const header = document.createElement('div');
            header.className = 'text-xs uppercase font-bold text-slate-400 mb-3 flex justify-between items-center';
            header.innerHTML = `<span>Rango ${groupIdx + 1}</span> <span class="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">${group.indices.length} pág</span>`;
            groupContainer.appendChild(header);

            // Mini grid
            const internalGrid = document.createElement('div');
            internalGrid.className = 'grid grid-cols-2 gap-2 mt-1';

            group.indices.forEach(pageIndex => {
                if (pageIndex >= 0 && pageIndex < pageElementsCache.length) {
                    const pageEl = pageElementsCache[pageIndex];
                    pageEl.className = 'relative rounded-lg overflow-hidden border border-slate-700';
                    internalGrid.appendChild(pageEl);
                }
            });

            groupContainer.appendChild(internalGrid);
            pagesGrid.appendChild(groupContainer);
        });
    }

    // --- Custom Range Input Logic ---

    function addRangeItem() {
        const id = nextRangeId++;
        const rangeObj = { id, start: 1, end: numPages };
        customRanges.push(rangeObj);

        const div = document.createElement('div');
        div.className = 'bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-sm flex items-end gap-3 animate-fade-in';
        div.dataset.id = id;

        div.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded uppercase">Rango ${customRanges.length}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-1 border border-slate-600 rounded-lg overflow-hidden flex items-center">
                        <span class="bg-slate-700 text-slate-300 text-xs px-2 py-2 border-r border-slate-600">De</span>
                        <input type="number" class="w-full p-1.5 text-sm font-bold text-center outline-none input-start bg-slate-900/50 text-white" value="1" min="1" max="${numPages}">
                    </div>
                    <div class="flex-1 border border-slate-600 rounded-lg overflow-hidden flex items-center">
                        <span class="bg-slate-700 text-slate-300 text-xs px-2 py-2 border-r border-slate-600">A</span>
                        <input type="number" class="w-full p-1.5 text-sm font-bold text-center outline-none input-end bg-slate-900/50 text-white" value="${numPages}" min="1" max="${numPages}">
                    </div>
                </div>
            </div>
            <button class="mb-1 text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:bg-slate-700 rounded-lg btn-remove" title="Eliminar rango">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;

        customRangesContainer.appendChild(div);

        // Listeners for inputs
        const startInput = div.querySelector('.input-start');
        const endInput = div.querySelector('.input-end');
        const removeBtn = div.querySelector('.btn-remove');

        const updateObj = () => {
            let s = parseInt(startInput.value);
            let e = parseInt(endInput.value);

            // Validate limits visual only, logic handles safe clamping
            if (s < 1) s = 1;
            if (e > numPages) e = numPages;

            rangeObj.start = s;
            rangeObj.end = e;
            updateUI();
        };

        startInput.addEventListener('input', updateObj);
        endInput.addEventListener('input', updateObj);

        removeBtn.addEventListener('click', () => {
            customRanges = customRanges.filter(r => r.id !== id);
            div.remove();
            // Re-number labels visually? A bit complex, let's keep it simple.
            // Or update labels:
            updateRangeLabels();
            updateUI();
        });

        updateRangeLabels();
    }

    function updateRangeLabels() {
        const items = customRangesContainer.children;
        for (let i = 0; i < items.length; i++) {
            const label = items[i].querySelector('span.uppercase');
            if (label) label.textContent = `Rango ${i + 1}`;
        }
    }

    function switchMode(mode) {
        currentMode = mode;
        const tabs = { manual: tabManual, size: tabSize, range: tabRange };
        const controls = { manual: controlsManual, size: controlsSize, range: controlsRange };

        // Toggle Tabs State
        Object.keys(tabs).forEach(k => {
            if (k === mode) {
                tabs[k].setAttribute('data-active', 'true');
            } else {
                tabs[k].removeAttribute('data-active');
            }
            controls[k].classList.add('hidden');
        });

        // Toggle Footer Actions
        if (manualActions) manualActions.classList.add('hidden');
        if (splitSizeBtn) splitSizeBtn.classList.add('hidden');
        if (splitRangeBtn) splitRangeBtn.classList.add('hidden');

        if (mode === 'manual') {
            if (manualActions) manualActions.classList.remove('hidden');
            renderGridStandard();
            updateManualControls();
        } else if (mode === 'range') {
            if (splitRangeBtn) splitRangeBtn.classList.remove('hidden');
            switchRangeSubMode(rangeSubMode);
        } else if (mode === 'size') {
            if (splitSizeBtn) splitSizeBtn.classList.remove('hidden');
            renderGridStandard();
            updateUI();
        }

        controls[mode].classList.remove('hidden');
    }

    function switchRangeSubMode(subMode) {
        rangeSubMode = subMode;
        if (subMode === 'custom') {
            subTabCustom.className = 'flex-1 py-1.5 text-xs font-bold rounded shadow-sm bg-slate-600 text-white transition-all';
            subTabFixed.className = 'flex-1 py-1.5 text-xs font-bold rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all';
            rangeCustomControls.classList.remove('hidden');
            rangeFixedControls.classList.add('hidden');
        } else {
            subTabFixed.className = 'flex-1 py-1.5 text-xs font-bold rounded shadow-sm bg-slate-600 text-white transition-all';
            subTabCustom.className = 'flex-1 py-1.5 text-xs font-bold rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all';
            rangeFixedControls.classList.remove('hidden');
            rangeCustomControls.classList.add('hidden');
        }
        updateUI();
    }

    function updateManualControls() {
        if (manualSelectionMode === 'all') {
            specificSelectionControls.classList.add('hidden');
            for (let i = 0; i < numPages; i++) selectedPages.add(i);
            updateUI();
        } else {
            specificSelectionControls.classList.remove('hidden');
            updateUI();
        }
    }

    function handlePageClick(index) {
        if (currentMode === 'manual') {
            if (manualSelectionMode === 'all') {
                manualSelectionMode = 'specific';
                document.querySelector('input[name="selectionMode"][value="specific"]').checked = true;
                specificSelectionControls.classList.remove('hidden');
            }
            if (selectedPages.has(index)) selectedPages.delete(index);
            else selectedPages.add(index);
            updateUI();
        }
    }

    function calculateFixedGroups() {
        const groups = [];
        const totalFiles = Math.ceil(numPages / fixedChunkSize);
        for (let i = 0; i < totalFiles; i++) {
            const startIdx = i * fixedChunkSize;
            let endIdx = startIdx + fixedChunkSize;
            if (endIdx > numPages) endIdx = numPages;
            const indices = [];
            for (let j = startIdx; j < endIdx; j++) indices.push(j);
            groups.push({ indices });
        }
        return groups;
    }

    function calculateCustomGroups() {
        const groups = [];
        customRanges.forEach(r => {
            const indices = [];
            // Clamp values
            let start = Math.max(1, Math.min(r.start, numPages));
            let end = Math.max(1, Math.min(r.end, numPages));

            // Handle reverse range? Usually user means 1-5. If 5-1, should we flip? Yes.
            if (start > end) [start, end] = [end, start];

            for (let k = start; k <= end; k++) {
                indices.push(k - 1);
            }
            if (indices.length > 0) groups.push({ indices });
        });
        return groups;
    }

    function updateUI() {
        if (currentMode === 'manual') {
            selectedCountDisplay.textContent = selectedPages.size;
            splitBtn.disabled = selectedPages.size === 0;
            const containers = pagesGrid.children;
            for (let i = 0; i < containers.length; i++) {
                const container = containers[i];
                const idx = parseInt(container.dataset.pageIndex);
                const isSelected = selectedPages.has(idx);
                const checkOverlay = container.querySelector('.manual-indicator');

                if (isSelected) {
                    container.classList.add('bg-red-900/30', 'border-red-500');
                    container.classList.remove('border-transparent');
                    checkOverlay.classList.remove('opacity-0');
                } else {
                    container.classList.remove('bg-red-900/30', 'border-red-500');
                    container.classList.add('border-transparent');
                    checkOverlay.classList.add('opacity-0');
                }
            }
        }
        else if (currentMode === 'range') {
            let groups = [];
            if (rangeSubMode === 'fixed') {
                groups = calculateFixedGroups();
                fixedSplitSummary.textContent = `Se crearán ${groups.length} archivos PDF.`;
            } else {
                groups = calculateCustomGroups();
            }
            renderGridGrouped(groups);
        }
        else if (currentMode === 'size') {
            const containers = pagesGrid.children;
            for (let i = 0; i < containers.length; i++) {
                containers[i].classList.remove('bg-red-900/30', 'border-red-500', 'border-transparent');
                containers[i].classList.add('border-transparent');
                const checkOverlay = containers[i].querySelector('.manual-indicator');
                if (checkOverlay) checkOverlay.classList.add('opacity-0');
            }
        }
    }

    async function splitByRange() {
        let groups = [];
        if (rangeSubMode === 'fixed') groups = calculateFixedGroups();
        else groups = calculateCustomGroups();

        if (groups.length === 0) {
            alert("No hay rangos válidos para dividir.");
            return;
        }

        const originalText = splitRangeBtn.innerHTML;
        splitRangeBtn.innerHTML = '⏳ Procesando...';
        splitRangeBtn.disabled = true;

        const shouldMerge = mergeRangesCheckbox.checked;

        try {
            const fileBuffer = await currentFile.arrayBuffer();
            const pdfDocLib = await PDFLib.PDFDocument.load(fileBuffer);

            if (shouldMerge) {
                // Merge all groups into ONE SINGLE file
                const newDoc = await PDFLib.PDFDocument.create();

                for (const group of groups) {
                    if (group.indices.length === 0) continue;
                    const copiedPages = await newDoc.copyPages(pdfDocLib, group.indices);
                    copiedPages.forEach(p => newDoc.addPage(p));
                }

                const pdfBytes = await newDoc.save();
                downloadBlob(pdfBytes, `${currentFile.name.replace('.pdf', '')}_rangos_unidos`, 'pdf');

            } else {
                // Standard ZIP behavior
                const zip = new JSZip();
                const rootFolderName = currentFile.name.replace('.pdf', '_rango_split');
                const folder = zip.folder(rootFolderName);
                folder.file("LEEME.txt", "Archivos generados por OptiLocal.");

                for (let i = 0; i < groups.length; i++) {
                    const indices = groups[i].indices;
                    if (indices.length === 0) continue;

                    const newDoc = await PDFLib.PDFDocument.create();
                    const copiedPages = await newDoc.copyPages(pdfDocLib, indices);
                    copiedPages.forEach(p => newDoc.addPage(p));

                    const pdfBytes = await newDoc.save({ useObjectStreams: false });
                    const fileName = `${currentFile.name.replace('.pdf', '')}_rango_${i + 1}.pdf`;
                    folder.file(fileName, pdfBytes);
                }

                const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
                downloadBlob(content, `split_rango_${currentFile.name.replace('.pdf', '')}`, 'zip');
            }

        } catch (error) {
            console.error(error);
            alert('Error: ' + error.message);
        } finally {
            splitRangeBtn.innerHTML = originalText;
            splitRangeBtn.disabled = false;
        }
    }

    async function extractSelectedPages() {
        if (selectedPages.size === 0) return;
        const originalText = splitBtn.innerHTML;
        splitBtn.innerHTML = '⏳ Procesando...';
        splitBtn.disabled = true;
        try {
            const fileBuffer = await currentFile.arrayBuffer();
            const pdfDocLib = await PDFLib.PDFDocument.load(fileBuffer);
            const newPdf = await PDFLib.PDFDocument.create();
            const sortedIndices = Array.from(selectedPages).sort((a, b) => a - b);
            const copiedPages = await newPdf.copyPages(pdfDocLib, sortedIndices);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            downloadBlob(pdfBytes, `seleccion_${currentFile.name}`, 'pdf');
        } catch (error) {
            console.error(error);
            alert('Error: ' + error.message);
        } finally {
            splitBtn.innerHTML = originalText;
            splitBtn.disabled = false;
        }
    }

    async function splitBySize() {
        const val = parseFloat(maxSizeInput.value);
        if (isNaN(val) || val <= 0) { alert('Tamaño inválido'); return; }

        const originalText = splitSizeBtn.innerHTML;
        splitSizeBtn.innerHTML = '⏳ Procesando...';
        splitSizeBtn.disabled = true;

        let unit = 'kb';
        sizeUnitRadios.forEach(r => { if (r.checked) unit = r.value; });
        const maxBytes = unit === 'kb' ? val * 1024 : val * 1024 * 1024;

        try {
            const fileBuffer = await currentFile.arrayBuffer();
            const pdfDocLib = await PDFLib.PDFDocument.load(fileBuffer);
            const zip = new JSZip();
            const folder = zip.folder(currentFile.name.replace('.pdf', '_size'));

            let partIndex = 1;
            let currentDoc = await PDFLib.PDFDocument.create();
            let pagesInCurrentDoc = 0;

            for (let i = 0; i < numPages; i++) {
                const [copiedPage] = await currentDoc.copyPages(pdfDocLib, [i]);
                currentDoc.addPage(copiedPage);
                pagesInCurrentDoc++;
                const pdfBytes = await currentDoc.save();

                if (pdfBytes.byteLength > maxBytes) {
                    if (pagesInCurrentDoc === 1) {
                        const fileName = `${currentFile.name.replace('.pdf', '')}_parte_${partIndex}.pdf`;
                        folder.file(fileName, pdfBytes);
                        partIndex++;
                        currentDoc = await PDFLib.PDFDocument.create();
                        pagesInCurrentDoc = 0;
                    } else {
                        currentDoc.removePage(pagesInCurrentDoc - 1);
                        const safeBytes = await currentDoc.save();
                        const fileName = `${currentFile.name.replace('.pdf', '')}_parte_${partIndex}.pdf`;
                        folder.file(fileName, safeBytes);
                        partIndex++;

                        currentDoc = await PDFLib.PDFDocument.create();
                        const [retryPage] = await currentDoc.copyPages(pdfDocLib, [i]);
                        currentDoc.addPage(retryPage);
                        pagesInCurrentDoc = 1;
                    }
                }
            }
            if (pagesInCurrentDoc > 0) {
                const pdfBytes = await currentDoc.save();
                const fileName = `${currentFile.name.replace('.pdf', '')}_parte_${partIndex}.pdf`;
                folder.file(fileName, pdfBytes);
            }
            const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
            downloadBlob(content, `split_size_${currentFile.name.replace('.pdf', '')}`, 'zip');
        } catch (e) {
            console.error(e);
            alert(e.message);
        } finally {
            splitSizeBtn.innerHTML = originalText;
            splitSizeBtn.disabled = false;
        }
    }

    function downloadBlob(data, fileName, ext) {
        let blob;
        if (data instanceof Blob) {
            blob = data;
        } else {
            blob = new Blob([data], { type: ext === 'zip' ? 'application/zip' : 'application/pdf' });
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
});
