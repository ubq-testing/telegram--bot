import { AuthHandler } from '../auth-handler';

async function userAuth() {
    const authHandler = new AuthHandler();
    await authHandler.userLoginWithToken();
}

userAuth().catch(console.error);