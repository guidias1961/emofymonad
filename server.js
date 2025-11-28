const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve o site (index.html, css, js) da raiz
app.use(express.static(__dirname));

// --- CONFIGURAÇÃO DE PERSISTÊNCIA (VOLUME) ---
// Define a pasta 'data' como local seguro. 
// No Railway, isso será o Volume montado em /app/data
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Garante que as pastas e arquivos existem ao iniciar
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
// ---------------------------------------------

// Serve os arquivos de upload a partir da pasta segura
app.use('/uploads', express.static(UPLOADS_DIR));

// Configuração do Multer para salvar na pasta segura
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, Date.now() + '-' + cleanName);
  }
});

const upload = multer({ storage: storage });

// Rota Principal (Site)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota: Listar Tracks
app.get('/api/tracks', (req, res) => {
  try {
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    const tracks = fileData ? JSON.parse(fileData) : [];
    res.json(tracks);
  } catch (error) {
    console.error("Erro ao ler DB:", error);
    res.json([]);
  }
});

// Rota: Upload
app.post('/api/upload', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  try {
    const { title, artist, genre, twitter, tipAddress } = req.body;
    
    if (!req.files || !req.files['audio']) {
      return res.status(400).json({ error: 'Arquivo de áudio obrigatório' });
    }

    const audioFile = req.files['audio'][0];
    const coverFile = req.files['cover'] ? req.files['cover'][0] : null;

    // Constrói a URL usando o caminho relativo /uploads
    const BASE_URL = `${req.protocol}://${req.get('host')}`;

    const newTrack = {
      id: Date.now(),
      title,
      artist,
      genre,
      twitter,
      tipAddress,
      audio: `${BASE_URL}/uploads/${audioFile.filename}`,
      cover: coverFile ? `${BASE_URL}/uploads/${coverFile.filename}` : null,
      likesCount: 0,
      playCount: 0,
      createdAt: new Date()
    };

    const tracks = JSON.parse(fs.readFileSync(DB_FILE));
    tracks.unshift(newTrack);
    fs.writeFileSync(DB_FILE, JSON.stringify(tracks, null, 2));

    res.json({ success: true, track: newTrack });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no upload' });
  }
});

// Rota: Interação (Like/Play)
app.post('/api/interaction', (req, res) => {
  const { trackId, type } = req.body;
  const tracks = JSON.parse(fs.readFileSync(DB_FILE));
  const trackIndex = tracks.findIndex(t => String(t.id) === String(trackId));
  
  if (trackIndex > -1) {
    if (type === 'play') tracks[trackIndex].playCount++;
    if (type === 'like') tracks[trackIndex].likesCount++;
    fs.writeFileSync(DB_FILE, JSON.stringify(tracks, null, 2));
    res.json({ success: true, track: tracks[trackIndex] });
  } else {
    res.status(404).json({ error: 'Track not found' });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Emofy Backend rodando na porta ${PORT}`);
  console.log(`💾 Persistência configurada em: ${DATA_DIR}`);
});
