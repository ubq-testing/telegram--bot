import { AuthHandler } from "./auth-handler";
import dotenv from "dotenv";
dotenv.config();

/**
 * Run with `yarn sms-auth`
 */
async function main() {
  const authHandler = new AuthHandler();
  await authHandler.smsLogin();
}

main().catch(console.error);
