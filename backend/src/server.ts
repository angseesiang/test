import express from 'express';
import api from './routes/api';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api', api);

app.listen(4000, () => console.log('API listening on http://localhost:4000'));
