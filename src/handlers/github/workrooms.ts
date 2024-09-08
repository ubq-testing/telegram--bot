import { CallbackResult } from "#root/types/proxy.js";
import { Context, SupportedEvents } from "../../types";
import { repositoryDispatch } from "../repository-dispatch";

export async function createWorkroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    await repositoryDispatch(context, "create-telegram-chat").catch(console.error);
    return { status: 200, reason: "workflow_dispatched" };
}

export async function closeWorkroom(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
    await repositoryDispatch(context, "close-telegram-chat").catch(console.error);
    return { status: 200, reason: "workflow_dispatched" };
}

export async function reOpenWorkroom(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
    await repositoryDispatch(context, "reopen-telegram-chat").catch(console.error);
    return { status: 200, reason: "workflow_dispatched" };
}
