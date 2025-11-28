const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000; // Ou a porta do seu servidor

// Configuração básica
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Torna a pasta pública

// Banco de dados simples em arquivo JSON (para persistir se reiniciar)
const DB_FILE = 'db.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

// Configuração do Multer (Upload de arquivos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Nome único: data + nome original limpo
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

// Rota: Pegar todas as músicas
app.get('/api/tracks', (req, res) => {
  const tracks = JSON.parse(fs.readFileSync(DB_FILE));
  res.json(tracks);
});

// Rota: Fazer Upload
app.post('/api/upload', upload, (req, res) => {
  try {
    const { title, artist, genre, twitter, tipAddress } = req.body;
    const audioFile = req.files['audio'][0];
    const coverFile = req.files['cover'] ? req.files['cover'][0] : null;

    // URL base do seu servidor (se for rodar local use localhost, se for online use seu IP/Domínio)
    // Exemplo produção: const BASE_URL = 'https://meu-site-api.com';
    const BASE_URL = `${req.protocol}://${req.get('host')}`;

    const newTrack = {
      id: Date.now(),
      title,
      artist,
      genre,
      twitter,
      tipAddress,
      // Salva o link direto para o arquivo
      audio: `${BASE_URL}/uploads/${audioFile.filename}`,
      cover: coverFile ? `${BASE_URL}/uploads/${coverFile.filename}` : null,
      likesCount: 0,
      playCount: 0,
      createdAt: new Date()
    };

    // Salvar no JSON
    const tracks = JSON.parse(fs.readFileSync(DB_FILE));
    tracks.unshift(newTrack); // Adiciona no começo
    fs.writeFileSync(DB_FILE, JSON.stringify(tracks, null, 2));

    res.json({ success: true, track: newTrack });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no upload' });
  }
});

// Rota: Dar Like/Play (Simples atualização no JSON)
app.post('/api/interaction', (req, res) => {
  const { trackId, type } = req.body; // type = 'like' ou 'play'
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
