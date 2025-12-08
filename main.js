const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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
app.use(express.urlencoded({ extended: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory API',
      version: '1.0.0',
      description: 'API documentation for Inventory Service'
    },
    servers: [
      { url: `http://${host}:${port}` }
    ],
  },
  apis: [__filename], // читання документації з цього ж файлу
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new item with photo
 *     tags: [Inventory]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Item created
 *       400:
 *         description: Bad Request
 */

app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) {
    return res.status(400).send('Bad Request: inventory_name is required');
  }

  const newItem = {
    id: Date.now().toString(),
    name: inventory_name,
    description: description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(newItem);
  console.log(`[REGISTER] Added item: ${newItem.name} (ID: ${newItem.id})`);
  res.status(201).send(`Item registered with ID: ${newItem.id}`);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Returns list of all inventory items
 */

app.get('/inventory', (req, res) => {
    res.status(200).json(inventory);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get item by ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item found
 *       404:
 *         description: Item not found
 */

app.get('/inventory/:id', (req, res) => {
  const { id } = req.params;
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Not found');
  }
  res.status(200).json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update inventory item by ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item updated
 *       404:
 *         description: Not found
 */

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

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get photo for an inventory item by ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the item
 *     responses:
 *       200:
 *         description: Returns the item's photo
 *       404:
 *         description: Photo or item not found
 */

app.get('/inventory/:id/photo', (req, res) => {
  const { id } = req.params;
  const item = inventory.find(i => i.id === id);
  if (!item || !item.photo) {
    return res.status(404).send('Not found');
  }
  const photoPath = path.join(uploadDir, item.photo);
  res.type('image/jpeg');
  res.sendFile(photoPath);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update photo for item
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo updated
 *       400:
 *         description: Bad request (no file)
 *       404:
 *         description: Not found
 */

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

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory item
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item deleted
 *       404:
 *         description: Not found
 */

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

app.get('/SearchForm.html', (req, res) => {
  const filePath = path.join(__dirname, 'SearchForm.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('SearchForm.html not found on server');
  }
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search for an inventory item by ID
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID of the item to search
 *               has_photo:
 *                 type: string
 *                 enum: [on, "true"]
 *                 description: Set to 'on' to include photo link
 *     responses:
 *       200:
 *         description: Item found
 *       404:
 *         description: Item not found
 */

app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).send('Not found');
  }
  if (has_photo === 'on' || has_photo === 'true' || has_photo === '1') {
     const responseItem = { ...item };
     if (item.photo) {
       responseItem.description += ` (Photo link: /inventory/${item.id}/photo)`;
     }
     return res.status(200).json(responseItem);
  }
  res.status(200).json(item);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to Inventory Service</h1>
    <ul>
      <li><a href="/RegisterForm.html">Register new item</a></li>
      <li><a href="/SearchForm.html">Search inventory</a></li>
      <li><a href="/docs">Swagger API Documentation</a></li>
    </ul>
  `);
});

app.use((req, res) => {
  res.status(405).send('Method not allowed');
});

const server = http.createServer(app);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});