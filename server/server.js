const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.Server(app);

const publicDirectory = path.join(__dirname, '../');

app.use(express.static(publicDirectory));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'index.html'));
});

server.listen(process.env.PORT || 880, () => {
    console.log('Веб-приложение доступно по адресу: http://127.0.0.1:880');
});