import { AuthHandler } from "./auth-handler";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const authHandler = new AuthHandler();
    await authHandler.smsLogin();
}

main().catch(console.error);