import express, { Express, Request, Response } from 'express';
import rootRouter from './routes';
import { PORT } from './secrets';
import './prisma';

const app: Express = express();
app.use(express.json());

app.get('/', (req:Request, res:Response) => {
    res.send('hello world');
});




app.use('/api', rootRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});