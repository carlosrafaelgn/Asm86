"use strict";

// Change this value to force the browser to install the
// service worker again, and recreate the cache (this technique
// works because the browser reinstalls the service worker
// whenever it detects a change in the source code of the
// service worker).
const CACHE_PREFIX = "asm86-static-cache";
const CACHE_VERSION = "-20210811";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

self.addEventListener("install", (event) => {
	// skipWaiting() will force the browser to start using
	// this version of the service worker as soon as its
	// installation finishes.
	// It does not really matter when we call skipWaiting(),
	// as long as we perform all other operations inside
	// event.waitUntil(). Calling event.waitUntil() forces
	// the installation process to be marked as finished
	// only when all promises passed to waitUntil() finish.

	self.skipWaiting();

	event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
		// According to the spec, the service worker file
		// is handled differently by the browser and needs
		// not to be added to the cache. I tested it and I
		// confirm the service worker works offline even when
		// not present in the cache (despite the error message
		// displayed by the browser when trying to fetch it).
		//
		// Also, there is no need to worry about max-age and
		// other cache-control headers/settings, because the
		// CacheStorage API ignores them.
		//
		// Nevertheless, even though CacheStorage API ignores
		// them, tests showed that a in few occasions, when
		// the browser was fetching these files, the file
		// being added to the cache actually came from the
		// browser's own cache... Therefore, I switched from
		// cache.addAll() to this.
		const files = [
			"/Asm86/",
			"/Asm86/?language=en",
			"/Asm86/?language=pt-br",
			"/Asm86/Asm86.js",
			"/Asm86/Asm86Language.js",
			"/Asm86/Asm86Sample.txt",
			"/Asm86/Asm86SampleEn.txt",
			"/Asm86/main.js",
			"/Asm86/mainnr.css",
			"/Asm86/favicons/favicon.ico",
			"/Asm86/favicons/favicon.png",
			"/Asm86/favicons/favicon-512x512.png",
			"/Asm86/favicons/manifest.webmanifest"
		];
		const promises = new Array(files.length);
		for (let i = files.length - 1; i >= 0; i--)
			promises.push(cache.add(new Request(files[i], { cache: "no-store" })));
		return Promise.all(promises);
	}));
});

self.addEventListener("activate", (event) => {
	// claim() is used to ask the browser to use this instance
	// of the service worker with all possible clients, including
	// any pages that might have been opened before this service
	// worker was downloaded/activated.

	self.clients.claim();

	event.waitUntil(
		// List all cache storages in our domain.
		caches.keys().then(function (keyList) {
			// Create one Promise for deleting each cache storage that is not
			// our current cache storage, taking care not to delete other
			// cache storages from the domain by checking the key prefix (we
			// are not using map() to avoid inserting undefined into the array).
			const oldCachesPromises = [];

			for (let i = keyList.length - 1; i >= 0; i--) {
				const key = keyList[i];
				if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
					oldCachesPromises.push(caches.delete(key));
			}

			return Promise.all(oldCachesPromises);
		})
	);
});

function fixResponseHeaders(response) {
	if (!response)
		return;
	let headers = response.headers;
	if (!headers) {
		headers = new Headers();
		response.headers = headers;
	}
	headers.set("Cache-Control", "private, no-store");
}

function cacheMatchAndFixResponse(url, cache) {
	return cache ? cache.match(url).then((response) => {
		fixResponseHeaders(response);
		return response;
	}) : caches.open(CACHE_NAME).then((cache) => {
		return cacheMatchAndFixResponse(url, cache);
	});
}

self.addEventListener("fetch", (event) => {
	// https://developer.mozilla.org/en-US/docs/Web/API/Request
	// mode is navigate only for the document itself (/neon/ or
	// index.html), whereas for all other requests, mode is cors,
	// no-cors and so on. So, in order to make the entire game
	// work offline we must handle all kinds of requests!

	// This will speed up the loading time after the first
	// time the user loads the game. The downside of this
	// technique is that we will work with an outdated
	// version of the resource if it has been changed at
	// the server, but has not yet been updated in our
	// local cache (which, right now, will only happen
	// when the service worker is reinstalled).

	const url = event.request.url;

	// Try to always use a fresh copy of the main pages
	if (url.endsWith("/Asm86/") ||
		url.endsWith("/Asm86/?pwa") ||
		url.endsWith("/Asm86/?language=en") ||
		url.endsWith("/Asm86/?language=pt-br") ||
		// Debug only
		url.startsWith("http://localhost")) {
		event.respondWith(fetch(url).then((response) => {
			return response || cacheMatchAndFixResponse(url);
		}, () => {
			return cacheMatchAndFixResponse(url);
		}));
		return;
	}

	event.respondWith(caches.open(CACHE_NAME).then((cache) => {
		return cache.match(event.request).then((response) => {
			// Return the resource if it has been found.
			if (response)
				return response;

			// When the resource was not found in the cache,
			// try to fetch it from the network. We are cloning the
			// request because requests are streams, and fetch will
			// consume this stream, rendering event.request unusable
			// (but we will need a usable request later, for cache.put)
			return fetch(event.request.clone()).then((response) => {
				// If this fetch succeeds, store it in the cache for
				// later! (This means we probably forgot to add a file
				// to the cache during the installation phase)

				// Just as requests, responses are streams and we will
				// need two usable streams: one to be used by the cache
				// and one to be returned to the browser! So, we send a
				// clone of the response to the cache.
				if (response && response.status === 200)
					cache.put(event.request, response.clone());
				return response;
			}, () => {
				// The request was neither in our cache nor was it
				// available from the network (maybe we are offline).
				// Therefore, try to fulfill requests for favicons with
				// the largest favicon we have available in our cache.
				if (event.request.url.indexOf("favicon") >= 0)
					return cache.match("/Asm86/favicons/favicon-512x512.png");

				// The resource was not in our cache, was not available
				// from the network and was also not a favicon...
				// Unfortunately, there is nothing else we can do :(
				return null;
			});
		});
	}));

});

// References:
// https://developers.google.com/web/fundamentals/primers/service-workers/?hl=en-us
// https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle?hl=en-us
// https://developers.google.com/web/fundamentals/codelabs/offline/?hl=en-us
// https://web.dev/service-workers-cache-storage
