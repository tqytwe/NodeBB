#!/usr/bin/env node
'use strict'

/**
 * Build-time patch: stop helmet from emitting X-Frame-Options when this deploy
 * is configured to be embedded cross-site.
 *
 * WHY THIS PATCH EXISTS
 * ---------------------
 * Two independent pieces of NodeBB write framing headers, and they disagree.
 *
 * 1. src/webserver.js -> setupHelmet(app) runs `app.use(helmet(options))`.
 *    `options` disables contentSecurityPolicy but says nothing about frame
 *    options, so helmet applies its default: `X-Frame-Options: SAMEORIGIN`.
 *
 * 2. src/middleware/headers.js -> addHeaders() runs later and does:
 *        if (meta.config['csp-frame-ancestors']) {
 *            headers['Content-Security-Policy'] = `frame-ancestors ${...}`;
 *            if (meta.config['csp-frame-ancestors'] === "'none'") {
 *                headers['X-Frame-Options'] = 'DENY';
 *            }
 *        } else {
 *            headers['Content-Security-Policy'] = "frame-ancestors 'self'";
 *            headers['X-Frame-Options'] = 'SAMEORIGIN';
 *        }
 *
 * When csp-frame-ancestors is set to a real origin list, branch 2 only *omits*
 * X-Frame-Options. It never clears the one helmet already set, so the response
 * ships both:
 *        Content-Security-Policy: frame-ancestors 'self' https://jisudeng.com
 *        X-Frame-Options: SAMEORIGIN
 *
 * Per CSP Level 2 a browser must ignore X-Frame-Options when an enforced
 * frame-ancestors directive is present, so current browsers still allow the
 * embed. Shipping two contradictory headers and relying on that precedence rule
 * is a bad bet: it is invisible in the response, it confuses anyone debugging a
 * blocked iframe, and any intermediate proxy or stricter client that honours
 * X-Frame-Options first will break the embed. Removing the wrong header is
 * cheaper than depending on it being disregarded.
 *
 * SAFETY
 * ------
 * - Gated on SUB2API_FRAME_ANCESTORS, the same variable the SSO plugin uses to
 *   populate csp-frame-ancestors. Unset => untouched upstream behaviour.
 * - This does not widen who may frame the forum. Framing is still decided by
 *   csp-frame-ancestors. If the plugin failed to write that setting, branch 2
 *   falls back to `frame-ancestors 'self'` and the cross-site embed is refused
 *   by CSP regardless of this patch.
 * - Idempotent: re-running is a no-op.
 * - Fails the BUILD (exit 1) if the expected source line is absent, so a NodeBB
 *   upgrade that moves setupHelmet breaks the image build loudly instead of
 *   silently reintroducing the contradictory header.
 */

const fs = require('fs')
const path = require('path')

const TARGET = process.argv[2] || '/usr/src/app/src/webserver.js'
const MARKER = 'SUB2API_FRAME_ANCESTORS'

// The single `app.use(helmet(options));` call inside setupHelmet().
const NEEDLE = /^([ \t]*)app\.use\(helmet\(options\)\);[ \t]*$/m

function main() {
	const file = path.resolve(TARGET)

	if (!fs.existsSync(file)) {
		console.error(`[patch] FATAL: ${file} does not exist`)
		process.exit(1)
	}

	const original = fs.readFileSync(file, 'utf8')

	if (original.includes(MARKER)) {
		console.log('[patch] helmet X-Frame-Options already patched, skipping')
		return
	}

	const matches = original.match(new RegExp(NEEDLE.source, 'gm')) || []
	if (matches.length !== 1) {
		console.error(`[patch] FATAL: expected exactly 1 \`app.use(helmet(options));\` in ${file}, found ${matches.length}.`)
		console.error('[patch] NodeBB probably changed setupHelmet() upstream. Re-check')
		console.error('[patch] src/webserver.js and update this patch.')
		process.exit(1)
	}

	const patched = original.replace(NEEDLE, (line, indent) => [
		`${indent}// PATCHED (sub2api deploy): helmet defaults to X-Frame-Options: SAMEORIGIN,`,
		`${indent}// and middleware/headers.js only omits that header when csp-frame-ancestors`,
		`${indent}// is set instead of clearing it. That leaves the response advertising both a`,
		`${indent}// permissive frame-ancestors and a restrictive X-Frame-Options. Framing stays`,
		`${indent}// governed by csp-frame-ancestors; this just drops the contradictory header.`,
		`${indent}if ((process.env.${MARKER} || '').trim()) {`,
		`${indent}\toptions.xFrameOptions = false;`,
		`${indent}}`,
		line,
	].join('\n'))

	if (patched === original) {
		console.error('[patch] FATAL: replacement produced no change')
		process.exit(1)
	}

	fs.writeFileSync(file, patched, 'utf8')

	// Re-read and assert, so a truncated write can never pass as success.
	const verify = fs.readFileSync(file, 'utf8')
	if (!verify.includes(MARKER) || !verify.includes('options.xFrameOptions = false;')) {
		console.error('[patch] FATAL: post-write verification failed')
		process.exit(1)
	}

	console.log(`[patch] helmet X-Frame-Options disabled when ${MARKER} is set`)
}

main()
