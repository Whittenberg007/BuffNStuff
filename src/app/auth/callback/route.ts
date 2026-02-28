export const dynamic = "force-static";

export async function GET() {
  // This route is a placeholder for OAuth callback flows.
  // Currently the app uses email/password auth only.
  // For Capacitor static export, this must be statically renderable.
  // Native apps handle auth via the client-side auth guard.
  return new Response("OK", { status: 200 });
}
