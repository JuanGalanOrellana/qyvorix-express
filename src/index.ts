import http from 'http';
import app from './app';

const server = http.createServer(app);

server.listen(8080, () => {
  console.log('Server is running on http://localhost:8080');
  console.log(`Docs de Swagger en http://localhost:8080/api/docs`);
});
