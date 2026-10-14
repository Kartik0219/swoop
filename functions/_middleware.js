// Send visitors on the old swoop-sites.pages.dev address to swoopsites.com (same path).
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === "swoop-sites.pages.dev") {
    url.hostname = "swoopsites.com";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
