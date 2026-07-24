// ImgToPDF — Core Application
// jsPDF + Canvas API + Paywall + USDT TRC-20 Payment

// ═══════ DOM Elements ═══════
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filePicker = document.getElementById('filePicker');
const fileList = document.getElementById('fileList');
const filesEl = document.getElementById('files');
const fileCount = document.getElementById('fileCount');
const options = document.getElementById('options');
const pageSize = document.getElementById('pageSize');
const orientation = document.getElementById('orientation');
const margin = document.getElementById('margin');
const quality = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const convertBtn = document.getElementById('convertBtn');
const clearAll = document.getElementById('clearAll');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const counter = document.getElementById('counter');
const conversionsLeft = document.getElementById('conversionsLeft');
const paywallModal = document.getElementById('paywallModal');
const paymentClose = document.getElementById('paymentClose');
const copyBtn = document.getElementById('copyBtn');
const txidInput = document.getElementById('txidInput');
const verifyBtn = document.getElementById('verifyBtn');
const paymentStatus = document.getElementById('paymentStatus');

let images = [];
const MAX_FREE = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

// ═══════ Counter Functions ═══════
function getUsed() {
    return parseInt(localStorage.getItem('imgtopdf_used') || '0');
}

function incrementUsed() {
    const current = getUsed();
    localStorage.setItem('imgtopdf_used', String(current + 1));
    updateCounter();
}

function isUnlocked() {
    return localStorage.getItem('imgtopdf_unlocked') === 'true';
}

function updateCounter() {
    if (isUnlocked()) {
        counter.innerHTML = '<strong>Unlimited</strong> conversions';
        return;
    }
    const used = getUsed();
    const left = Math.max(0, MAX_FREE - used);
    conversionsLeft.textContent = String(left);
    if (left === 0) {
        counter.innerHTML = 'Free limit reached. <a href="#" id="unlockLink" style="color:#000;text-decoration:underline;">Unlock for $5</a>';
        const link = document.getElementById('unlockLink');
        if (link) link.addEventListener('click', (e) => { e.preventDefault(); showPaywall(); });
    }
}

// ═══════ Quality Slider ═══════
quality.addEventListener('input', () => {
    qualityValue.textContent = quality.value + '%';
});

// ═══════ Drag & Drop ═══════
dropZone.addEventListener('click', () => fileInput.click());
filePicker.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

// ═══════ File Handling ═══════
function handleFiles(fileList) {
    const valid = Array.from(fileList).filter(f =>
        ACCEPTED_TYPES.includes(f.type) || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f.name)
    );
    if (valid.length === 0) { alert('Please select image files only (JPG, PNG, WebP, GIF, BMP).'); return; }
    images = [...images, ...valid];
    renderFiles();
    convertBtn.disabled = images.length < 1;
}

function renderFiles() {
    if (images.length === 0) {
        fileList.style.display = 'none';
        options.style.display = 'none';
        convertBtn.disabled = true;
        return;
    }
    fileList.style.display = 'block';
    options.style.display = 'grid';
    fileCount.textContent = String(images.length);
    filesEl.innerHTML = images.map((file, i) =>
        '<div class="file-item">' +
            '<span class="file-icon">🖼️</span>' +
            '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
            '<span class="file-size">' + formatSize(file.size) + '</span>' +
            '<button class="file-move-up" data-index="' + i + '" title="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="file-move-down" data-index="' + i + '" title="Move down"' + (i === images.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="file-remove" data-index="' + i + '">✕</button>' +
        '</div>'
    ).join('');

    filesEl.querySelectorAll('.file-move-up').forEach(btn => {
        btn.addEventListener('click', () => moveUp(parseInt(btn.dataset.index)));
    });
    filesEl.querySelectorAll('.file-move-down').forEach(btn => {
        btn.addEventListener('click', () => moveDown(parseInt(btn.dataset.index)));
    });
    filesEl.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.index)));
    });
    convertBtn.disabled = images.length < 1;
}

function moveUp(index) {
    if (index <= 0) return;
    [images[index - 1], images[index]] = [images[index], images[index - 1]];
    renderFiles();
}

function moveDown(index) {
    if (index >= images.length - 1) return;
    [images[index], images[index + 1]] = [images[index + 1], images[index]];
    renderFiles();
}

function removeFile(index) {
    images.splice(index, 1);
    renderFiles();
}

clearAll.addEventListener('click', () => {
    images = [];
    renderFiles();
    fileInput.value = '';
});

// ═══════ Convert to PDF ═══════
convertBtn.addEventListener('click', async () => {
    if (images.length === 0) return;
    if (!isUnlocked() && getUsed() >= MAX_FREE) {
        showPaywall();
        return;
    }

    try {
        progress.style.display = 'block';
        convertBtn.disabled = true;
        progressFill.style.width = '10%';
        progressText.textContent = 'Loading images...';

        const { jsPDF } = window.jspdf;
        const qualityVal = parseInt(quality.value) / 100;
        const pageSizeVal = pageSize.value;
        const marginVal = parseInt(margin.value);
        const orientationVal = orientation.value;

        // Determine orientation
        let pdfOrientation = 'portrait';
        if (orientationVal === 'landscape') {
            pdfOrientation = 'landscape';
        }

        // For original size, use image dimensions
        let pdf;
        let isFirstPage = true;

        for (let i = 0; i < images.length; i++) {
            const file = images[i];
            const img = await loadImage(file);
            const canvas = imageToCanvas(img, qualityVal);
            const imgData = canvas.toDataURL('image/jpeg', qualityVal);

            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            const isLandscape = imgWidth > imgHeight;

            if (pageSizeVal === 'original') {
                // Original: page = image size in mm (convert px to mm at 96dpi)
                const mmW = imgWidth * 25.4 / 96;
                const mmH = imgHeight * 25.4 / 96;
                if (isFirstPage) {
                    pdf = new jsPDF({
                        orientation: mmW > mmH ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [mmW, mmH]
                    });
                    isFirstPage = false;
                } else {
                    pdf.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
                }
                pdf.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
            } else {
                // A4 or Letter
                const format = pageSizeVal === 'a4' ? 'a4' : 'letter';
                let orient = orientationVal === 'auto' ? (isLandscape ? 'landscape' : 'portrait') : orientationVal;

                if (isFirstPage) {
                    pdf = new jsPDF({ orientation: orient, unit: 'mm', format: format });
                    isFirstPage = false;
                } else {
                    pdf.addPage(format, orient);
                }

                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();
                const availW = pageW - 2 * marginVal;
                const availH = pageH - 2 * marginVal;

                // Fit image into available space, maintain aspect ratio
                const ratio = Math.min(availW / imgWidth, availH / imgHeight);
                const finalW = imgWidth * ratio;
                const finalH = imgHeight * ratio;
                const x = (pageW - finalW) / 2;
                const y = (pageH - finalH) / 2;

                pdf.addImage(imgData, 'JPEG', x, y, finalW, finalH);
            }

            const pct = 10 + Math.round(((i + 1) / images.length) * 80);
            progressFill.style.width = pct + '%';
            progressText.textContent = 'Converting image ' + (i + 1) + ' of ' + images.length + '...';
        }

        progressFill.style.width = '95%';
        progressText.textContent = 'Generating PDF...';

        const filename = images.length === 1
            ? images[0].name.replace(/\.[^/.]+$/, '') + '.pdf'
            : 'images-' + new Date().toISOString().split('T')[0] + '.pdf';

        pdf.save(filename);

        progressFill.style.width = '100%';
        progressText.textContent = 'Done! Downloading...';

        if (!isUnlocked()) incrementUsed();

        setTimeout(() => {
            progress.style.display = 'none';
            convertBtn.disabled = false;
            progressFill.style.width = '0%';
            images = [];
            renderFiles();
            fileInput.value = '';
        }, 2000);

    } catch (err) {
        console.error(err);
        progressText.textContent = 'Error: ' + (err.message || 'Could not convert images. Files may be corrupted.');
        convertBtn.disabled = false;
    }
});

// ═══════ Helper Functions ═══════
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + file.name));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
        reader.readAsDataURL(file);
    });
}

function imageToCanvas(img, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    // White background for transparency (PNG, WebP, GIF)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0);
    return canvas;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ═══════ Payment Configuration ═══════
const PAYMENT_CONFIG = {
    WORKER_URL: 'https://imgtopdf-payment.makszoom85.workers.dev',
    TRC20_ADDRESS: 'PLACEHOLDER_ADDRESS',
    PRICE: 3
};

// ═══════ Paywall ═══════
function showPaywall() { paywallModal.style.display = 'flex'; }
function closePaywall() { paywallModal.style.display = 'none'; }

paywallModal.addEventListener('click', (e) => { if (e.target === paywallModal) closePaywall(); });
if (paymentClose) paymentClose.addEventListener('click', closePaywall);

// Copy address
if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(PAYMENT_CONFIG.TRC20_ADDRESS);
            copyBtn.textContent = '✓ Copied';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (e) {
            const addrInput = document.getElementById('paymentAddress');
            addrInput.select();
            document.execCommand('copy');
            copyBtn.textContent = '✓ Copied';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }
    });
}

// Verify payment
if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
        const txId = txidInput.value.trim();

        if (!txId) {
            showStatus('Please paste your TXID first.', 'error');
            return;
        }

        if (!/^[a-fA-F0-9]{64}$/.test(txId)) {
            showStatus('Invalid TXID format. Must be 64 hex characters.', 'error');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        showStatus('<span class="payment-spinner"></span>Verifying transaction on blockchain...', 'loading');

        try {
            const response = await fetch(PAYMENT_CONFIG.WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txId })
            });

            const data = await response.json();

            if (data.verified) {
                localStorage.setItem('imgtopdf_unlocked', 'true');
                showStatus('✅ Payment verified! Unlimited conversions activated.', 'success');
                verifyBtn.textContent = '✓ Unlocked';

                setTimeout(() => {
                    closePaywall();
                    updateCounter();
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify';
                    txidInput.value = '';
                    paymentStatus.innerHTML = '';
                }, 2500);
            } else {
                showStatus('❌ ' + (data.message || 'Verification failed.'), 'error');
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify';
            }
        } catch (err) {
            showStatus('❌ Network error. Check your connection and try again.', 'error');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });
}

// Enter key in TXID field
if (txidInput) {
    txidInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyBtn.click();
        }
    });
}

function showStatus(message, type) {
    paymentStatus.className = 'payment-status ' + type;
    paymentStatus.innerHTML = message;
}

// ═══════ Init ═══════
updateCounter();
console.log('ImgToPDF loaded. jsPDF available:', typeof window.jspdf !== 'undefined');