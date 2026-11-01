/**
 * The reopen service worker, kept in its own module: a plain string with no
 * imports, so both the route table and the worker's own tests read it
 * without pulling in the route family.
 */

/**
 * The reopen service worker served at PAIR_PATHS.appServiceWorker. A paired
 * phone comes back to `/` from history, bookmarks, or tab restore; the
 * harness fallback seat answers that navigation with its browser-auth 401,
 * and the cookieless mobile flow never holds a browser-auth cookie. The
 * worker owns navigations to `/` instead: network-first through /pair-app
 * (which validates the device cookie and refreshes its presence), the
 * cached shell for offline opens, and a pass-through of the original
 * request when the plugin no longer answers. Plain-HTTP LAN origins are not
 * secure contexts, so the worker never registers there — the LAN reopen
 * path stays "scan a fresh QR", which is cheap in-network.
 *
 * Kept as a plain string (same pattern as the capture script): it must load
 * with no build step, run on every JS engine that ships service workers,
 * and be assertable as source in tests. Bump SHELL_CACHE when the storage
 * layout changes so old caches are pruned on activate.
 */
export function appServiceWorkerScript(): string {
  return `'use strict';
var SHELL_CACHE = 'dsh-remote-shell-v1';
var SHELL_PREFIX = 'dsh-remote-shell-';
var SHELL_KEY = '/dsh-remote-shell';
var APP_URL = '/pair-app';
self.addEventListener('install', function (event) {
  event.waitUntil(refreshShell().then(function () { return self.skipWaiting(); }));
});
/* CacheStorage is shared by every worker and page of this origin, so only the
   plugin's own namespace may be pruned: an upstream or sibling-plugin cache is
   none of this worker's business. */
self.addEventListener('activate', function (event) {
  event.waitUntil(self.caches.keys().then(function (names) {
    return Promise.all(names.map(function (name) {
      var mine = name.indexOf(SHELL_PREFIX) === 0;
      return mine && name !== SHELL_CACHE ? self.caches.delete(name) : Promise.resolve();
    }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  var path;
  try { path = new URL(request.url).pathname; } catch (error) { return; }
  if (path !== '/') return;
  event.respondWith(reopen(event));
});
/* Network-first: a live pairing gets the current shell (the /pair-app check
   refreshes lastSeenAt, so every reopen also keeps the session alive); a
   refused shell passes the original navigation through for the harness's
   own response; an unreachable server falls back to the cached shell. The
   cached shell embeds the device id, so a refusal drops it: a revoked device
   must not leave its credential in CacheStorage for a later offline open. */
function reopen(event) {
  var request = event.request;
  return fetch(APP_URL, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (!response.ok) return dropShell().then(function () { return fetch(request); });
    var copy = response.clone();
    event.waitUntil(self.caches.open(SHELL_CACHE).then(function (cache) {
      return cache.put(SHELL_KEY, copy);
    }));
    return response;
  }, function () {
    return self.caches.match(SHELL_KEY).then(function (cached) {
      return cached !== undefined ? cached : fetch(request);
    });
  });
}
/* Forgetting the shell is always safe: the next install/reopen rebuilds it. */
function dropShell() {
  return self.caches.delete(SHELL_CACHE).then(function () { return undefined; }, function () { return undefined; });
}
/* Best-effort shell warm-up and refresh; never rejects. */
function refreshShell() {
  return fetch(APP_URL, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (!response.ok) return dropShell();
    var copy = response.clone();
    return self.caches.open(SHELL_CACHE).then(function (cache) {
      return cache.put(SHELL_KEY, copy);
    });
  }, function () { return undefined; });
}`
}
