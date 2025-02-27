import { Octokit } from "@octokit/rest";

// @ts-expect-error no types
import sodium from "libsodium-wrappers";
import { logger } from "../../../utils/logger";

export async function encryptSecret(secret: string | object | number, key: string) {
    await sodium.ready;
    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(secret);
    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
}

export async function storeSecret(key: string, value: string | object | number, repoFullName: string, token: string) {
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = repoFullName.split("/");

    const pubKey = await octokit.rest.actions.getRepoPublicKey({ owner, repo });
    const encryptedSecret = await encryptSecret(value, pubKey.data.key);

    await octokit.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: key,
        encrypted_value: encryptedSecret,
        key_id: pubKey.data.key_id,
    });

    logger.ok(`Secret ${key} stored successfully`);
}