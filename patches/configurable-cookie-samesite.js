#!/usr/bin/env node
'use strict'

/**
 * Build-time patch: make the session cookie's SameSite attribute configurable.
 *
 * WHY THIS PATCH EXISTS
 * ---------------------
 * The forum lives on https://jisudengbbs.zeabur.app and the main platform on
 * https://jisudeng.com. Those are different sites (not just different
 * subdomains), so when the platform embeds the forum in an <iframe> every
 * request to the forum is a cross-site request. Browsers do not attach
 * SameSite=Lax cookies to cross-site subresource requests, so the forum would
 * see every iframe visitor as a guest no matter how they logged in.
 *
 * NodeBB hardcodes the value at src/meta/configs.js and says so itself:
 *   // Ideally configurable from ACP, but cannot be "Strict" as then top-level
 *   // access will treat it as guest.
 *   cookie.sameSite = 'Lax';
 *
 * There is no config option and no plugin hook: Configs.cookie.get() reads only
 * cookieDomain, secure and relative_path from nconf. Patching this single
 * assignment is the whole change; it is the only occurrence of `sameSite` in
 * src/, and its 4 callers (the session cookie in webserver.js plus three
 * res.clearCookie calls in controllers/authentication.js) all go through it, so
 * setting and clearing stay consistent.
 *
 * SAFETY
 * ------
 * - Default stays 'Lax'. With no env var set, behaviour is byte-for-byte the
 *   upstream behaviour.
 * - 'None' is only honoured by browsers when the cookie is also Secure, so the
 *   patch forces cookie.secure = true in that branch. Without this a
 *   misconfiguration would make browsers silently drop the session cookie and
 *   lock everyone out.
 * - 'Strict' is deliberately NOT accepted; upstream's comment explains it breaks
 *   top-level access. Anything unrecognised falls back to 'Lax'.
 * - Idempotent: re-running is a no-op.
 * - Fails the BUILD (exit 1) if the expected source line is absent. A NodeBB
 *   upgrade that moves this code then breaks the image build loudly instead of
 *   silently shipping a forum whose iframe login quietly stops working.
 */

const fs = require('fs')
const path = require('path')

const TARGET = process.argv[2] || '/usr/src/app/src/meta/configs.js'
const MARKER = 'NODEBB_COOKIE_SAMESITE'

// Matches the upstream assignment regardless of indentation or quote style.
const NEEDLE = /^[ \t]*cookie\.sameSite = 'Lax';[ \t]*$/m

const REPLACEMENT = [
	"\t\t// PATCHED (sub2api deploy): upstream hardcodes 'Lax', which is not sent on",
	'\t\t// cross-site iframe requests. The main platform embeds this forum from a',
	'\t\t// different site, so the value has to be configurable.',
	`\t\tconst sub2apiSameSite = process.env.${MARKER} || 'Lax';`,
	"\t\tif (sub2apiSameSite === 'None') {",
	"\t\t\tcookie.sameSite = 'None';",
	'\t\t\t// Browsers reject SameSite=None unless the cookie is also Secure.',
	'\t\t\t// Forcing it here means a bad env var cannot silently break login.',
	'\t\t\tcookie.secure = true;',
	'\t\t} else {',
	"\t\t\tcookie.sameSite = 'Lax';",
	'\t\t}',
].join('\n')

function main() {
	const file = path.resolve(TARGET)

	if (!fs.existsSync(file)) {
		console.error(`[patch] FATAL: ${file} does not exist`)
		process.exit(1)
	}

	const original = fs.readFileSync(file, 'utf8')

	if (original.includes(MARKER)) {
		console.log('[patch] cookie sameSite already patched, skipping')
		return
	}

	if (!NEEDLE.test(original)) {
		console.error(`[patch] FATAL: could not find the \`cookie.sameSite = 'Lax';\` assignment in ${file}.`)
		console.error('[patch] NodeBB probably changed this code upstream. Re-check')
		console.error('[patch] src/meta/configs.js Configs.cookie.get() and update this patch.')
		process.exit(1)
	}

	const patched = original.replace(NEEDLE, REPLACEMENT)

	if (patched === original) {
		console.error('[patch] FATAL: replacement produced no change')
		process.exit(1)
	}

	fs.writeFileSync(file, patched, 'utf8')

	// Re-read and assert, so a truncated write can never pass as success.
	const verify = fs.readFileSync(file, 'utf8')
	if (!verify.includes(MARKER) || !verify.includes("cookie.sameSite = 'None';")) {
		console.error('[patch] FATAL: post-write verification failed')
		process.exit(1)
	}

	console.log(`[patch] cookie sameSite is now configurable via ${MARKER} (default Lax)`)
}

main()
