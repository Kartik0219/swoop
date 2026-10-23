// Send visitors on the old swoop-sites.pages.dev address, and on www., to swoopsites.com (same path).
// 308 for anything that isn't a plain page view, so a form post is never turned into a GET.
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === "swoop-sites.pages.dev" || url.hostname === "www.swoopsites.com") {
    url.hostname = "swoopsites.com";
    const pageView = request.method === "GET" || request.method === "HEAD";
    return Response.redirect(url.toString(), pageView ? 301 : 308);
  }
  return next();
}
