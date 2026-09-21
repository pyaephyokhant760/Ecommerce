import express, { Express, Request, Response } from 'express';
import rootRouter from './routes';
import { PORT } from './secrets';
import './prisma';
import { errorMiddleware } from './middlewares/error';

const app: Express = express();
app.use(express.json());

app.get('/', (req:Request, res:Response) => {
    res.send('hello world');
});




app.use('/api', rootRouter);


app.use(errorMiddleware);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});