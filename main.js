const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

program
  .requiredOption('-h, --host <address>', 'Server address')
  .requiredOption('-p, --port <number>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Path to cache directory');

program.parse(process.argv);
const options = program.opts();
const host = options.host;
const port = options.port;
const cache = options.cache;

const uploadDir = path.resolve(cache);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[INFO] Created upload directory: ${uploadDir}`);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const app = express();
const inventory = [];

app.use(express.json());

app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) {
    return res.status(400).send('Bad Request: inventory_name is required');
  }

  const newItem = {
    id: Date.now().toString(), // Генеруємо ID
    name: inventory_name,
    description: description || '', // Якщо опис не задано, буде пустий рядок
    photo: req.file ? req.file.filename : null // Ім'я файлу фото (якщо є)
  };

  inventory.push(newItem);
  console.log(`[REGISTER] Added item: ${newItem.name} (ID: ${newItem.id})`);
  res.status(201).send(`Item registered with ID: ${newItem.id}`);
});

app.get('/inventory', (req, res) => {
    res.status(200).json(inventory);
});

app.get('/inventory/:id', (req, res) => {
  const { id } = req.params;
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Not found');
  }
  res.status(200).json(item);
});

app.put('/inventory/:id', (req, res) => {
  const { id } = req.params;
  const { inventory_name, description } = req.body;
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Not found');
  }
  if (inventory_name) {
    item.name = inventory_name;
  }
  if (description) {
    item.description = description;
  }
  console.log(`[UPDATE] Updated item ID: ${id}`);
  res.status(200).json(item);
});

app.get('/inventory/:id/photo', (req, res) => {
  const { id } = req.params;
  const item = inventory.find(i => i.id === id);
  if (!item || !item.photo) {
    return res.status(404).send('Not found');
  }
  const photoPath = path.join(uploadDir, item.photo);
  res.sendFile(photoPath);
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const { id } = req.params;
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Not found');
  }
  if (req.file) {
    item.photo = req.file.filename;
    console.log(`[UPDATE PHOTO] Updated photo for item ID: ${id}`);
    res.status(200).json(item);
  } else {
    res.status(400).send('Bad Request: photo file is required');
  }
});

app.delete('/inventory/:id', (req, res) => {
  const { id } = req.params;
  const index = inventory.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).send('Not found');
  }
  const deletedItem = inventory.splice(index, 1)[0];
  console.log(`[DELETE] Deleted item ID: ${id}`);
  res.status(200).send(`Item with ID ${id} was deleted`);
});

app.get('/RegisterForm.html', (req, res) => {
  const filePath = path.join(__dirname, 'RegisterForm.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('RegisterForm.html not found on server');
  }
});

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
  console.log(`Photos will be saved to: ${uploadDir}`);
});