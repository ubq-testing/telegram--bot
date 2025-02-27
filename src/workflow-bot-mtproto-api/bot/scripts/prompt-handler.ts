// @ts-expect-error no types
import input from "input";

const passwords = [
  "APP_PRIVATE_KEY",
  "TELEGRAM_BOT_WEBHOOK_SECRET",
  "REPO_ADMIN_ACCESS_TOKEN",
  "TELEGRAM_API_HASH",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_APP_ID",
  "SUPABASE_SERVICE_KEY",
  "VOYAGEAI_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
];

export async function promptUser(question: { name: string; message: string; optional?: boolean }) {
  if (question.optional) {
    const shouldSet = await input.confirm(`Do you want to set ${question.name}?\n>  `);
    if (!shouldSet) return;
  }

  if (passwords.includes(question.name)) {
    return await input.password(`  ${question.message}\n>  `);
  }
  return await input.text(`  ${question.message}\n>  `);
}
