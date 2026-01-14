import type { APIRoute } from "astro";

/**
 * Dynamic catch-all redirect for all /zh/* paths to root paths
 * Handles ANY path under /zh/ including nested dynamic paths like /zh/posts/welcome
 */

// SSR mode - handle any path dynamically at runtime
export const prerender = false;

export const GET: APIRoute = ({ url, redirect }) => {
  const pathAfterZh = url.pathname.replace(/^\/zh\/?/, '');
  const redirectPath = pathAfterZh ? `/${pathAfterZh}` : '/';
  
  // Ensure trailing slash consistency (except for files with extensions)
  const finalPath = redirectPath.endsWith('/') || redirectPath.includes('.') 
    ? redirectPath 
    : `${redirectPath}/`;
  
  return redirect(finalPath, 301);
};

// Also handle other HTTP methods
export const ALL: APIRoute = ({ url, redirect }) => {
  const pathAfterZh = url.pathname.replace(/^\/zh\/?/, '');
  const redirectPath = pathAfterZh ? `/${pathAfterZh}` : '/';
  
  const finalPath = redirectPath.endsWith('/') || redirectPath.includes('.') 
    ? redirectPath 
    : `${redirectPath}/`;
  
  return redirect(finalPath, 301);
};
