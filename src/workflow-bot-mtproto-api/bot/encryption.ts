import CryptoJS from "crypto-js";

export function decrypt(privateKey: string, text: string): string {
  return CryptoJS.AES.decrypt(text, privateKey).toString();
}

export function encrypt(privateKey: string, text: string): string {
  return CryptoJS.AES.encrypt(text, privateKey).toString();
}
