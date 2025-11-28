const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- MÁGICA AQUI ---
// Serve os arquivos estáticos (HTML, CSS, JS, Imagens) da pasta atual
app.use(express.static(__dirname));
// -------------------

app.use('/uploads', express.static('uploads'));

const DB_FILE = 'db.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

// Configuração do Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, Date.now() + '-' + cleanName);
  }
});

const upload = multer({ storage: storage });

// Rota para entregar o site caso acessem a raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/tracks', (req, res) => {
  const tracks = JSON.parse(fs.readFileSync(DB_FILE));
  res.json(tracks);
});

app.post('/api/upload', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  try {
    const { title, artist, genre, twitter, tipAddress } = req.body;
    
    if (!req.files || !req.files['audio']) {
      return res.status(400).json({ error: 'Arquivo de áudio obrigatório' });
    }

    const audioFile = req.files['audio'][0];
    const coverFile = req.files['cover'] ? req.files['cover'][0] : null;

    // Ajuste para garantir HTTPS na produção se necessário, ou usar relativo
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
});
