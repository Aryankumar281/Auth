import express from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.routes';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health",(request, response) => {
    response.status(200).json({message: "Server is running fine!"})
})
app.use("/api/auth", authRouter);
export default app;