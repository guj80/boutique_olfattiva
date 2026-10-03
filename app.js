// Constants and Keys
const SUPABASE_URL = 'https://xmkpldgaawwsafbsjmhz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EZly6tJde5GD3jsGDXVqvg_nXy6qCDs';
const GEMINI_API_KEY = '';// Sp

// Fallback data
const fallbackPerfumes = [
    { brand: 'Xerjoff', nome: 'Naxos', famiglia_olfattiva: 'Aromatico Speziato', prezzo: 220 },
    { brand: 'Lorenzo Pazzaglia', nome: 'Megamare', famiglia_olfattiva: 'Acquatico Legnoso', prezzo: 145 },
    { brand: 'Kajal', nome: 'Lamar', famiglia_olfattiva: 'Orientale Floreale', prezzo: 185 },
    { brand: 'Nasomatto', nome: 'Black Afgano', famiglia_olfattiva: 'Legnoso Aromatico', prezzo: 130 }
];

// Initialize Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const sotdText = document.getElementById('sotd-text');
const sotdDisplay = document.getElementById('sotd-display');
const sotdEdit = document.getElementById('sotd-edit');
const sotdInput = document.getElementById('sotd-input');
const editSotdBtn = document.getElementById('edit-sotd-btn');
const saveSotdBtn = document.getElementById('save-sotd-btn');
const perfumeGrid = document.getElementById('perfume-grid');

// Camera Elements
const cameraFab = document.getElementById('camera-fab');
const cameraModal = document.getElementById('camera-modal');
const videoElement = document.getElementById('camera-video');
const canvasElement = document.getElementById('camera-canvas');
const captureBtn = document.getElementById('capture-btn');
const closeCameraBtn = document.getElementById('close-camera-btn');
const cameraStatus = document.getElementById('camera-status');

let stream = null;

// --- App Initialization ---
async function initApp() {
    loadSOTD();
    await loadPerfumes();
}

// --- SOTD Logic ---
function loadSOTD() {
    const savedSOTD = localStorage.getItem('sotd');
    if (savedSOTD) {
        sotdText.textContent = savedSOTD;
    }
}

editSotdBtn.addEventListener('click', () => {
    sotdInput.value = sotdText.textContent !== 'Non impostato' ? sotdText.textContent : '';
    sotdDisplay.classList.add('hidden');
    sotdEdit.classList.remove('hidden');
    sotdInput.focus();
});

saveSotdBtn.addEventListener('click', () => {
    const newSotd = sotdInput.value.trim();
    if (newSotd) {
        sotdText.textContent = newSotd;
        localStorage.setItem('sotd', newSotd);
    }
    sotdEdit.classList.add('hidden');
    sotdDisplay.classList.remove('hidden');
});

// --- Perfume Collection Logic ---
async function loadPerfumes() {
    try {
        const { data, error } = await supabaseClient
            .from('profumi')
            .select('*');
        
        if (error) {
            console.error('Error fetching from Supabase:', error);
            renderPerfumes(fallbackPerfumes);
            return;
        }

        if (data && data.length > 0) {
            renderPerfumes(data);
        } else {
            renderPerfumes(fallbackPerfumes);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        renderPerfumes(fallbackPerfumes);
    }
}

function renderPerfumes(perfumes) {
    perfumeGrid.innerHTML = '';
    perfumes.forEach(p => {
        const card = document.createElement('div');
        card.className = 'perfume-card';
        
        // Handle variations in field names (prezzo vs prezzo_stimato_euro)
        const price = p.prezzo || p.prezzo_stimato_euro || 0;
        const formattedPrice = price > 0 ? `€${price}` : 'N/D';

        card.innerHTML = `
            <div class="card-brand">${p.brand || 'Sconosciuto'}</div>
            <div class="card-name">${p.nome || 'Sconosciuto'}</div>
            <div class="card-family">${p.famiglia_olfattiva || ''}</div>
            <div class="card-price">${formattedPrice}</div>
        `;
        perfumeGrid.appendChild(card);
    });
}

// --- Camera & Scanner Logic ---
cameraFab.addEventListener('click', openCamera);
closeCameraBtn.addEventListener('click', closeCamera);
captureBtn.addEventListener('click', takePictureAndAnalyze);

async function openCamera() {
    cameraModal.classList.remove('hidden');
    cameraStatus.textContent = "Avvio fotocamera...";
    captureBtn.disabled = true;

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        videoElement.srcObject = stream;
        cameraStatus.textContent = "Inquadra la boccetta e scatta.";
        captureBtn.disabled = false;
    } catch (err) {
        console.error("Camera error:", err);
        cameraStatus.textContent = "Errore: Impossibile accedere alla fotocamera.";
    }
}

function closeCamera() {
    cameraModal.classList.add('hidden');
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraStatus.textContent = "";
}

async function takePictureAndAnalyze() {
    captureBtn.disabled = true;
    cameraStatus.textContent = "Scatto in corso...";

    // Draw video frame to canvas
    const context = canvasElement.getContext('2d');
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Get Base64 image
    const imageData = canvasElement.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    cameraStatus.textContent = "Analisi con Gemini in corso...";
    
    try {
        const result = await analyzeWithGemini(imageData);
        if (result) {
            cameraStatus.textContent = "Analisi completata!";
            
            // Add to grid temporarily for demonstration
            const card = document.createElement('div');
            card.className = 'perfume-card';
            card.style.borderColor = 'var(--accent-gold)';
            
            const price = result.prezzo_stimato_euro || result.prezzo || 0;
            const formattedPrice = price > 0 ? `€${price}` : 'N/D';
            
            card.innerHTML = `
                <div class="card-brand">${result.brand || 'Sconosciuto'}</div>
                <div class="card-name">${result.nome || 'Sconosciuto'}</div>
                <div class="card-family">${result.famiglia_olfattiva || ''}</div>
                <div class="card-price">${formattedPrice}</div>
            `;
            perfumeGrid.prepend(card);
            
            setTimeout(() => {
                closeCamera();
            }, 2000);
        } else {
            cameraStatus.textContent = "Errore nell'analisi. Riprova.";
            captureBtn.disabled = false;
        }
    } catch (err) {
        console.error("Analysis error:", err);
        cameraStatus.textContent = "Errore durante l'analisi.";
        captureBtn.disabled = false;
    }
}

async function analyzeWithGemini(base64Image) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = "Analizza questo flacone di profumo. Restituiscimi un JSON con: brand, nome, famiglia_olfattiva, e prezzo_stimato_euro.";
    
    const requestBody = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json"
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    try {
        const text = data.candidates[0].content.parts[0].text;
        // Parse the JSON. We asked for JSON, and used response_mime_type.
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Gemini response", e);
        return null;
    }
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
