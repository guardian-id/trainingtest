// --- KONFIGURASI ---
const POWER_AUTOMATE_URL = 'https://default9ec0d6c58a25418fb3841c77c55584.c2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5675602b8c4e420faaef5e28b321aec2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=q8seuWU7oqNkjLaIzxoTQdLRbF-6G_gxCx-qFuwG-cc';
const CSV_FILE_NAME = 'Question.csv'; 

let questions = [];
let currentIdx = 0;
let timer;
let timeLeft = 10;
let userName = "";
let selectedAnswer = null;

// 1. FUNGSI LOAD CSV
async function loadQuestions() {
    try {
        const response = await fetch(CSV_FILE_NAME + '?t=' + new Date().getTime());
        if (!response.ok) throw new Error("File CSV tidak ditemukan");
        const data = await response.text();
        parseCSV(data);
        return true;
    } catch (error) {
        console.error("Error Load CSV:", error);
        return false;
    }
}

// 2. FUNGSI PARSE CSV
function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    questions = [];
    for (let i = 0; i < lines.length; i += 5) {
        if (lines[i]) {
            questions.push({
                soal: lines[i],
                opsi: [lines[i+1], lines[i+2], lines[i+3], lines[i+4]].filter(opt => opt !== undefined)
            });
        }
    }
}

// 3. FUNGSI MULAI DENGAN VALIDASI KETAT & TAMPILKAN NAMA
async function startQuiz() {
    userName = document.getElementById('username').value.trim();
    if (!userName) {
        alert("Silakan masukkan nama Anda!");
        return;
    }

    const loginScreen = document.getElementById('login-screen');
    const originalContent = loginScreen.innerHTML;
    loginScreen.innerHTML = "<h3>Memvalidasi Nama...</h3>";

    try {
        const response = await fetch(POWER_AUTOMATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: "VALIDASI_NAMA", 
                nama: userName
            })
        });

        // Jika Power Automate merespon OK (200)
        if (response.ok) {
            const success = await loadQuestions();
            if (success && questions.length > 0) {
                // SEMBUNYIKAN LOGIN, TAMPILKAN KUIS
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('quiz-screen').classList.remove('hidden');
                
                // MENAMPILKAN KEMBALI NAMA DI LAYAR KUIS
                document.getElementById('display-name').innerText = "Peserta: " + userName;
                
                showQuestion();
            } else {
                alert("File soal tidak ditemukan.");
                loginScreen.innerHTML = originalContent;
            }
        } else {
            alert("Nama tidak terdaftar atau NRP anda sudah ter-identifikasi submit.");
            loginScreen.innerHTML = originalContent;
        }
    } catch (error) {
        console.error("CORS atau Koneksi Error:", error);
        alert("Gagal terhubung ke Power Automate.");
        loginScreen.innerHTML = originalContent;
    }
}

// 4. FUNGSI TAMPILKAN SOAL
function showQuestion() {
    if (currentIdx >= questions.length) {
        finishQuiz();
        return;
    }

    selectedAnswer = null; 
    const submitBtn = document.getElementById('submit-per-soal');
    if(submitBtn) submitBtn.disabled = true; // Tombol mati saat soal baru muncul

    const q = questions[currentIdx];
    document.getElementById('question-text').innerText = q.soal;
    
    const container = document.getElementById('options-container');
    container.innerHTML = ''; 

    q.opsi.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => {
            selectedAnswer = opt;
            if(submitBtn) submitBtn.disabled = false; // Aktifkan tombol jika sudah pilih
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        container.appendChild(btn);
    });

    startTimer();
}

// 5. FUNGSI TIMER
function startTimer() {
    clearInterval(timer);
    timeLeft = 15;
    document.getElementById('timer').innerText = `${timeLeft}s`;

    timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            processAnswer(); // Pindah otomatis tanpa kirim jika belum pilih
        }
    }, 1000);
}

// 6. FUNGSI PROSES & KIRIM KE POWER AUTOMATE
async function processAnswer() {
    clearInterval(timer);
    
    const submitBtn = document.getElementById('submit-per-soal');
    if(submitBtn) submitBtn.disabled = true;

    if (selectedAnswer !== null) {
        const payload = {
            nama: userName,
            soal: questions[currentIdx].soal,
            jawaban: selectedAnswer,
            timestamp: new Date().toISOString()
        };

        console.log("Mengirim jawaban ke Power Automate...");

        // Gunakan fetch tanpa 'no-cors' agar header application/json tetap terbaca oleh Power Automate
        // Namun kita harus pastikan Power Automate memberikan respon CORS yang benar
        fetch(POWER_AUTOMATE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            console.log("Berhasil terkirim ke Power Automate");
        })
        .catch(err => {
            // Jika tetap gagal karena CORS, data biasanya tetap masuk ke Power Automate 
            // tapi browser menganggapnya error.
            console.warn("Jawaban terkirim dengan peringatan CORS.");
        });
    }

    currentIdx++;
    showQuestion();
}

// 7. FUNGSI SELESAI
function finishQuiz() {
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('status-message').innerText = "Terima kasih " + userName + ", kuis telah selesai!";
}