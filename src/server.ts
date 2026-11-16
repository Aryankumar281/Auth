import dotenv from 'dotenv';
import { connectDB } from './config/db';
import http from 'http';
import app from './app';
dotenv.config();

async function startSerer() {
    await connectDB();

    const server = http.createServer(app)
    server.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`)
    })
}

startSerer().catch((error) => {
    console.error("Error starting the server:", error);
    process.exit(1); 
})