const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Railway Volume Path
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const BUILDS_DIR = path.join(DATA_DIR, 'builds');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, BUILDS_DIR, DOWNLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Setup Multer for Uploads
const upload = multer({ dest: UPLOADS_DIR });

app.use(express.static('public'));
app.use('/downloads', express.static(DOWNLOADS_DIR)); // Download link provider

app.post('/upload', upload.single('sourceCode'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.redirect(`/build.html?fileId=${req.file.filename}`);
});

io.on('connection', (socket) => {
    let buildProcess = null;

    socket.on('start_build', (fileId) => {
        const zipPath = path.join(UPLOADS_DIR, fileId);
        const extractPath = path.join(BUILDS_DIR, `${fileId}_extracted`);
        const finalApkPath = path.join(DOWNLOADS_DIR, `${fileId}.apk`);

        socket.emit('log', `[SYSTEM] Preparing to build project...\n`);

        // The Ultimate Auto-Builder Script
        const script = `
            echo "[1/4] Extracting ZIP file..."
            mkdir -p "${extractPath}"
            unzip -o -q "${zipPath}" -d "${extractPath}"

            echo "[2/4] Searching for project root..."
            # Searching for either settings.gradle or settings.gradle.kts
            PROJECT_DIR=$(find "${extractPath}" -name "settings.gradle*" -printf "%h\n" | head -n 1)

            if [ -z "$PROJECT_DIR" ]; then
                echo "ERROR: 'settings.gradle' or 'settings.gradle.kts' not found! Invalid Android Project."
                exit 1
            fi

            echo "[SYSTEM] Project root found at: $PROJECT_DIR"
            cd "$PROJECT_DIR"

            echo "[3/4] Compiling APK (This may take a while)..."
            # Using global gradle instead of local gradlew
            gradle assembleDebug --no-daemon

            echo "[4/4] Searching for generated APK..."
            APK_PATH=$(find . -name "*.apk" | head -n 1)

            if [ -z "$APK_PATH" ]; then
                echo "ERROR: APK compilation failed or APK not found."
                exit 1
            fi

            echo "[SYSTEM] APK generated successfully! Moving to downloads..."
            cp "$APK_PATH" "${finalApkPath}"
        `;

        buildProcess = spawn('bash', ['-c', script]);

        buildProcess.stdout.on('data', (data) => socket.emit('log', data.toString()));
        buildProcess.stderr.on('data', (data) => socket.emit('log', data.toString())); 

        buildProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(finalApkPath)) {
                socket.emit('log', '\n--- BUILD COMPLETED SUCCESSFULLY ---\n');
                socket.emit('build_done', `/downloads/${fileId}.apk`);
            } else {
                socket.emit('log', `\n--- BUILD FAILED (Exit Code: ${code}) ---\n`);
                socket.emit('build_error');
            }
        });
    });

    socket.on('stop_build', () => {
        if (buildProcess) {
            buildProcess.kill();
            socket.emit('log', '\n--- BUILD STOPPED BY USER ---\n');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
