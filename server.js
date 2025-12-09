const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from root directory (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname), {
  index: 'index.html'
}));

// Health check endpoint for future monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
