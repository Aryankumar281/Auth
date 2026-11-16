"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
dotenv_1.default.config();
async function startSerer() {
    await (0, db_1.connectDB)();
    const server = http_1.default.createServer(app_1.default);
    server.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
}
startSerer().catch((error) => {
    console.error("Error starting the server:", error);
    process.exit(1);
});
