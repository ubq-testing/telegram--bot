import { drop } from "@mswjs/data";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach, it, jest } from "@jest/globals";
import { setupTests } from "./__mocks__/helpers";
import dotenv from "dotenv";
import { Env } from "../src/types";
import manifest from "../manifest.json";
import worker from "../src/worker";

dotenv.config();

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

describe("Plugin tests", () => {
  beforeEach(async () => {
    drop(db);
    await setupTests();
  });

  it("Should serve the manifest file", async () => {
    const response = await worker.fetch(new Request("http://localhost/manifest.json"), {} as Env);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(manifest);
  }, 10000);
});

/**
 * The heart of each test. This function creates a context object with the necessary data for the plugin to run.
 *
 * So long as everything is defined correctly in the db (see `./__mocks__/helpers.ts: setupTests()`),
 * this function should be able to handle any event type and the conditions that come with it.
 *
 * Refactor according to your needs.
 */
// function createContext(
//   configurableResponse: string = "Hello, world!", // we pass the plugin configurable items here
//   commentBody: string = "/Hello",
//   repoId: number = 1,
//   payloadSenderId: number = 1,
//   commentId: number = 1,
//   issueOne: number = 1
// ) {
//   const repo = db.repo.findFirst({ where: { id: { equals: repoId } } }) as unknown as Context["payload"]["repository"];
//   const sender = db.users.findFirst({ where: { id: { equals: payloadSenderId } } }) as unknown as Context["payload"]["sender"];
//   const issue1 = db.issue.findFirst({ where: { id: { equals: issueOne } } }) as unknown as Context["payload"]["issue"];

//   createComment(commentBody, commentId); // create it first then pull it from the DB and feed it to _createContext
//   const comment = db.issueComments.findFirst({ where: { id: { equals: commentId } } }) as unknown as Context["payload"]["comment"];

//   const context = createContextInner(repo, sender, issue1, comment, configurableResponse);
//   const infoSpy = jest.spyOn(context.logger, "info");
//   const errorSpy = jest.spyOn(context.logger, "error");
//   const debugSpy = jest.spyOn(context.logger, "debug");
//   const okSpy = jest.spyOn(context.logger, "ok");
//   const verboseSpy = jest.spyOn(context.logger, "verbose");

//   return {
//     context,
//     infoSpy,
//     errorSpy,
//     debugSpy,
//     okSpy,
//     verboseSpy,
//     repo,
//     issue1,
//   };
// }

/**
 * Creates the context object central to the plugin.
 *
 * This should represent the active `SupportedEvents` payload for any given event.
 */
// function createContextInner(
//   repo: Context["payload"]["repository"],
//   sender: Context["payload"]["sender"],
//   issue: Context["payload"]["issue"],
//   comment: Context["payload"]["comment"],
//   configurableResponse: string
// ): Context {
//   return {
//     eventName: "issue_comment.created",
//     payload: {
//       action: "created",
//       sender: sender,
//       repository: repo,
//       issue: issue,
//       comment: comment,
//       installation: { id: 1 } as Context["payload"]["installation"],
//       organization: { login: STRINGS.USER_1 } as Context["payload"]["organization"],
//     },
//     logger: new Logs("debug"),
//     config: {
//       configurableResponse,
//     },
//     env: {} as Env,
//     octokit: octokit,
//   };
// }
