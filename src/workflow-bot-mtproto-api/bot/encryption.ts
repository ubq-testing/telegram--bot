import CryptoJS from "crypto-js";

export function decrypt(privateKey: string, text?: string): string {
  if (!text) {
    return "";
  }
  return CryptoJS.AES.decrypt(text, privateKey).toString(CryptoJS.enc.Utf8);
}

export function encrypt(privateKey: string, text: string): string {
  return CryptoJS.AES.encrypt(text, privateKey).toString();
}
