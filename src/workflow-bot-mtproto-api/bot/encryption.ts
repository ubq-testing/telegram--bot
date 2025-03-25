import CryptoJS from "crypto-js";

export function decrypt(privateKey: string, text: string): string {
  try {
    return CryptoJS.AES.decrypt(text, privateKey).toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.log("Failed to decrypt text", {
      error: e,
      text,
      pk: privateKey.substring(0, 10),
    });

    throw new Error("Failed to decrypt text");
  }
}

export function encrypt(privateKey: string, text: string): string {
  return CryptoJS.AES.encrypt(text, privateKey).toString();
}