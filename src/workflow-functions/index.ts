export const WORKFLOW_FUNCTIONS = {
    CREATE_CHAT: "create-telegram-chat",
} as const;

export type WorkflowFunction = typeof WORKFLOW_FUNCTIONS[keyof typeof WORKFLOW_FUNCTIONS];