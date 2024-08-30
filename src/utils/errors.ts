
export function handleUncaughtError(error: unknown) {
    console.error(error);
    const status = 500;
    return new Response(JSON.stringify({ error }), { status: status, headers: { "content-type": "application/json" } });
}